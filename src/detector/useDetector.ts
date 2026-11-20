import { useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { analyze } from "./analyze";
import {
  BUFFER_SIZE,
  MOTION_THRESHOLD,
  buildContactSheet,
  captureFrame,
  meanDiff,
  toGrey,
} from "./frames";
import { MIRROR_INTERVAL_MS, openMirror, type MirrorPublisher } from "./mirror";
import { loadObjectDetector, startOverlay, type OverlayAction } from "./objects";
import type { AnalysisResult, DetectorEvent, DetectorStatus, LastResult, LogKind } from "./types";
import { useCamera } from "./useCamera";

const FRAME_INTERVAL_MS = 1_000;
const CALL_INTERVAL_MS = 3_000;
const ERROR_BACKOFF_MS = 10_000;
const MAX_RUN_MS = 5 * 60_000;
const ALERT_MIN_CONFIDENCE = 0.7;
const ALERT_COOLDOWN_MS = 10_000;

const NO_ALERT_REASON: Record<Exclude<DetectorEvent, "concealed">, string> = {
  none: "nothing taken from the table",
  picked_up: "item picked up, still watching",
  returned: "item put back",
};

// Mutable state for one Start..Stop run; late async results check they still own the run.
interface Run {
  video: HTMLVideoElement;
  frames: HTMLCanvasElement[];
  prevGrey: Uint8Array | null;
  isBusy: boolean;
  nextCallAt: number;
  alertUntil: number;
  mockStep: number | null;
  lastAnalysis: AnalysisResult | null;
  tickTimer?: number;
  mirrorTimer?: number;
  stopTimer?: number;
  stopOverlay?: () => void;
}

function percent(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** Whether a result raises an alert, with the reason shown in the decision log. */
export function decide(
  result: AnalysisResult,
  now: number,
  alertUntil: number,
): { isAlert: boolean; why: string } {
  if (result.event !== "concealed") {
    return { isAlert: false, why: `No alert: ${NO_ALERT_REASON[result.event]}` };
  }
  if (result.confidence < ALERT_MIN_CONFIDENCE) {
    const why = `No alert: confidence ${percent(result.confidence)} is below ${percent(ALERT_MIN_CONFIDENCE)}`;
    return { isAlert: false, why };
  }
  if (now < alertUntil) {
    return { isAlert: false, why: "No alert: already alerted in the last 10 s" };
  }
  const why = `ALERT: concealed with ${percent(result.confidence)} confidence (min ${percent(ALERT_MIN_CONFIDENCE)})`;
  return { isAlert: true, why };
}

function overlayAction(run: Run): OverlayAction {
  const r = run.lastAnalysis;
  const text = r && r.event !== "none" ? `${r.event.toUpperCase()}: ${r.item}` : null;
  return { text, isAlert: Date.now() < run.alertUntil };
}

function describe(r: AnalysisResult): string {
  const what = [r.item, r.location].filter(Boolean).join(" @ ");
  return `${r.event}${what ? ` · ${what}` : ""} · ${percent(r.confidence)} — ${r.reason}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useDetector() {
  const camera = useCamera();
  const runRef = useRef<Run | null>(null);
  const mirrorRef = useRef<MirrorPublisher | null>(null);
  const statusRef = useRef<DetectorStatus>("Idle");
  const [status, setStatus] = useState<DetectorStatus>("Idle");
  const [lastResult, setLastResult] = useState<LastResult | null>(null);

  function showStatus(next: DetectorStatus) {
    statusRef.current = next;
    setStatus(next);
  }

  function log(kind: LogKind, text: string, sheet: string | null = null) {
    mirrorRef.current?.log({ at: Date.now(), kind, text, sheet });
  }

  const idleStatus = (run: Run): DetectorStatus =>
    Date.now() < run.alertUntil ? "Alert" : "Watching";

  async function reportIncident(result: AnalysisResult, sheet: string) {
    const { error } = await supabase.from("incidents").insert({
      item: result.item,
      location: result.location,
      confidence: result.confidence,
      reason: result.reason,
      evidence: sheet,
      status: "new",
    });
    if (error) {
      setLastResult({ line: `ALERT not saved: ${error.message}`, sheet });
      log("error", `Incident not saved: ${error.message}`);
      return;
    }
    log("alert", "Incident saved, guard notified");
  }

  async function check(run: Run, sheet: string) {
    run.isBusy = true;
    run.nextCallAt = Date.now() + CALL_INTERVAL_MS;
    showStatus("Checking");
    try {
      const result = await analyze(sheet, run.mockStep === null ? undefined : run.mockStep++);
      if (runRef.current !== run) return;
      run.lastAnalysis = result;
      setLastResult({ line: describe(result), sheet });
      log("ai", `AI: ${describe(result)}`, sheet);
      const now = Date.now();
      const decision = decide(result, now, run.alertUntil);
      log(decision.isAlert ? "alert" : "decision", decision.why);
      if (decision.isAlert) {
        run.alertUntil = now + ALERT_COOLDOWN_MS;
        await reportIncident(result, sheet);
      }
    } catch (error) {
      run.nextCallAt = Date.now() + ERROR_BACKOFF_MS;
      if (runRef.current === run) {
        setLastResult({ line: `Check failed, retrying in 10 s: ${errorMessage(error)}`, sheet });
        log("error", `AI check failed (${errorMessage(error)}), retrying in 10 s`);
      }
    } finally {
      run.isBusy = false;
      if (runRef.current === run) showStatus(idleStatus(run));
    }
  }

  function tick(run: Run) {
    // Once the buffer is full, the oldest frame's canvas is redrawn and moves to the end.
    const oldest = run.frames.length === BUFFER_SIZE ? run.frames[0] : undefined;
    const frame = captureFrame(run.video, oldest);
    if (!frame) return;
    run.frames = [...run.frames, frame].slice(-BUFFER_SIZE);
    const grey = toGrey(frame);
    const motion = run.prevGrey ? meanDiff(run.prevGrey, grey) : 0;
    run.prevGrey = grey;
    if (run.isBusy) return;
    showStatus(idleStatus(run));
    const isReady = run.frames.length === BUFFER_SIZE && Date.now() >= run.nextCallAt;
    if (motion <= MOTION_THRESHOLD || !isReady) return;
    log("motion", `Motion ${motion.toFixed(1)} > ${MOTION_THRESHOLD}: sending last 4 frames to AI`);
    void check(run, buildContactSheet(run.frames));
  }

  function stop() {
    const run = runRef.current;
    if (!run) return;
    window.clearInterval(run.tickTimer);
    window.clearInterval(run.mirrorTimer);
    window.clearTimeout(run.stopTimer);
    run.stopOverlay?.();
    runRef.current = null;
    camera.stop();
    showStatus("Idle");
    log("info", "Camera stopped");
  }

  // Boxes are optional: if the model fails to load, detection still runs without them.
  async function attachOverlay(run: Run, canvas: HTMLCanvasElement) {
    try {
      const detector = await loadObjectDetector();
      if (runRef.current !== run) return;
      run.stopOverlay = startOverlay(detector, run.video, canvas, () => overlayAction(run));
    } catch (error) {
      if (runRef.current !== run) return;
      setLastResult({ line: `Object boxes unavailable: ${errorMessage(error)}`, sheet: null });
    }
  }

  async function start(video: HTMLVideoElement, overlay: HTMLCanvasElement) {
    if (runRef.current) return;
    const isMock = new URLSearchParams(window.location.search).get("mock") === "1";
    const run: Run = {
      video,
      frames: [],
      prevGrey: null,
      isBusy: false,
      nextCallAt: 0,
      alertUntil: 0,
      mockStep: isMock ? 0 : null,
      lastAnalysis: null,
    };
    runRef.current = run;
    // One channel per page: reopening the same topic while the old one closes reuses the closing channel.
    mirrorRef.current ??= openMirror();
    try {
      await camera.start(video);
    } catch (error) {
      if (runRef.current === run) runRef.current = null;
      camera.stop();
      setLastResult({ line: `Camera error: ${errorMessage(error)}`, sheet: null });
      return;
    }
    // Stop was pressed while the camera permission prompt was open.
    if (runRef.current !== run) return camera.stop();
    run.tickTimer = window.setInterval(() => tick(run), FRAME_INTERVAL_MS);
    run.mirrorTimer = window.setInterval(
      () => mirrorRef.current?.sendFrame(video, overlay, statusRef.current),
      MIRROR_INTERVAL_MS,
    );
    run.stopTimer = window.setTimeout(stop, MAX_RUN_MS);
    showStatus("Watching");
    log("info", `Camera started${isMock ? " (mock AI)" : ""}, watching for motion`);
    void attachOverlay(run, overlay);
  }

  // Refs and state setters are stable, so the first render's functions are safe to use on unmount.
  useEffect(
    () => () => {
      stop();
      mirrorRef.current?.close();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return { status, lastResult, start, stop };
}

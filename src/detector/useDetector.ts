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
import type { AnalysisResult, DetectorStatus, LastResult } from "./types";
import { useCamera } from "./useCamera";

const FRAME_INTERVAL_MS = 1_000;
const CALL_INTERVAL_MS = 3_000;
const ERROR_BACKOFF_MS = 10_000;
const MAX_RUN_MS = 5 * 60_000;
const ALERT_MIN_CONFIDENCE = 0.7;
const ALERT_COOLDOWN_MS = 10_000;

// Mutable state for one Start..Stop run; late async results check they still own the run.
interface Run {
  video: HTMLVideoElement;
  frames: HTMLCanvasElement[];
  prevGrey: Uint8Array | null;
  isBusy: boolean;
  nextCallAt: number;
  alertUntil: number;
  mockStep: number | null;
  tickTimer?: number;
  stopTimer?: number;
}

function describe(r: AnalysisResult): string {
  const pct = `${Math.round(r.confidence * 100)}%`;
  const what = [r.item, r.location].filter(Boolean).join(" @ ");
  return `${r.event}${what ? ` · ${what}` : ""} · ${pct} — ${r.reason}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useDetector() {
  const camera = useCamera();
  const runRef = useRef<Run | null>(null);
  const [status, setStatus] = useState<DetectorStatus>("Idle");
  const [lastResult, setLastResult] = useState<LastResult | null>(null);

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
    if (error) setLastResult({ line: `ALERT not saved: ${error.message}`, sheet });
  }

  async function check(run: Run, sheet: string) {
    run.isBusy = true;
    run.nextCallAt = Date.now() + CALL_INTERVAL_MS;
    setStatus("Checking");
    try {
      const result = await analyze(sheet, run.mockStep === null ? undefined : run.mockStep++);
      if (runRef.current !== run) return;
      setLastResult({ line: describe(result), sheet });
      const now = Date.now();
      const isAlert =
        result.event === "concealed" &&
        result.confidence >= ALERT_MIN_CONFIDENCE &&
        now >= run.alertUntil;
      if (isAlert) {
        run.alertUntil = now + ALERT_COOLDOWN_MS;
        await reportIncident(result, sheet);
      }
    } catch (error) {
      run.nextCallAt = Date.now() + ERROR_BACKOFF_MS;
      if (runRef.current === run) {
        setLastResult({ line: `Check failed, retrying in 10 s: ${errorMessage(error)}`, sheet });
      }
    } finally {
      run.isBusy = false;
      if (runRef.current === run) setStatus(idleStatus(run));
    }
  }

  function tick(run: Run) {
    const frame = captureFrame(run.video);
    if (!frame) return;
    run.frames = [...run.frames, frame].slice(-BUFFER_SIZE);
    const grey = toGrey(frame);
    const isActive = run.prevGrey !== null && meanDiff(run.prevGrey, grey) > MOTION_THRESHOLD;
    run.prevGrey = grey;
    if (run.isBusy) return;
    setStatus(idleStatus(run));
    const isReady = run.frames.length === BUFFER_SIZE && Date.now() >= run.nextCallAt;
    if (isActive && isReady) void check(run, buildContactSheet(run.frames));
  }

  function stop() {
    const run = runRef.current;
    if (!run) return;
    window.clearInterval(run.tickTimer);
    window.clearTimeout(run.stopTimer);
    runRef.current = null;
    camera.stop();
    setStatus("Idle");
  }

  async function start(video: HTMLVideoElement) {
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
    };
    runRef.current = run;
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
    run.stopTimer = window.setTimeout(stop, MAX_RUN_MS);
    setStatus("Watching");
  }

  // Refs and state setters are stable, so the first render's stop is safe to use on unmount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => stop, []);

  return { status, lastResult, start, stop };
}

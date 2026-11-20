import { useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { analyze, scanShelf } from "./analyze";
import { MAX_EVENT_MS, createEventTracker } from "./events";
import {
  MIN_CHANGED_CELLS,
  buildContactSheet,
  captureFrame,
  changedCells,
  motionBounds,
  snapshot,
  toGrey,
} from "./frames";
import { MIRROR_INTERVAL_MS, openMirror, type MirrorPublisher } from "./mirror";
import { loadObjectDetector, startOverlay, type OverlayAction } from "./objects";
import { buildCheckInstruction } from "./prompt";
import { setItemState } from "./shelf";
import type {
  AnalysisResult,
  DetectorEvent,
  DetectorStatus,
  ItemState,
  LastResult,
  LogKind,
  ShelfItem,
} from "./types";
import { useCamera } from "./useCamera";

const CAPTURE_INTERVAL_MS = 333;
const ERROR_BACKOFF_MS = 10_000;
const MAX_RUN_MS = 5 * 60_000;
const ALERT_MIN_CONFIDENCE = 0.7;
const ALERT_COOLDOWN_MS = 10_000;
const SCAN_WIDTH = 960;
// Camera exposure settles during the first second, so the shelf is scanned after it.
const SCAN_DELAY_MS = 1_000;
// More canvases than an open action can hold, so a pooled canvas is never redrawn while in use.
const FRAME_POOL_SIZE = Math.ceil(MAX_EVENT_MS / CAPTURE_INTERVAL_MS) + 4;

const NO_ALERT_REASON: Record<Exclude<DetectorEvent, "concealed">, string> = {
  none: "nothing taken from the table",
  picked_up: "item picked up, still watching",
  returned: "item put back",
};

const ITEM_STATE: Record<Exclude<DetectorEvent, "none">, ItemState> = {
  picked_up: "picked_up",
  returned: "returned",
  concealed: "concealed",
};

interface PendingCheck {
  sheet: string;
  frameCount: number;
}

// Mutable state for one Start..Stop run; late async results check they still own the run.
interface Run {
  video: HTMLVideoElement;
  pool: HTMLCanvasElement[];
  poolNext: number;
  tracker: ReturnType<typeof createEventTracker<HTMLCanvasElement>>;
  prevGrey: Uint8Array | null;
  isScanning: boolean;
  isBusy: boolean;
  pending: PendingCheck | null;
  backoffUntil: number;
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

function secondsSince(startedAt: number): string {
  return `${((performance.now() - startedAt) / 1000).toFixed(1)} s`;
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
  const shelfRef = useRef<ShelfItem[]>([]);
  const [status, setStatus] = useState<DetectorStatus>("Idle");
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const [shelf, setShelf] = useState<ShelfItem[]>([]);

  function showStatus(next: DetectorStatus) {
    statusRef.current = next;
    setStatus(next);
  }

  function showShelf(next: ShelfItem[]) {
    shelfRef.current = next;
    setShelf(next);
  }

  function log(kind: LogKind, text: string, sheet: string | null = null) {
    mirrorRef.current?.log({ at: Date.now(), kind, text, sheet });
  }

  const idleStatus = (run: Run): DetectorStatus =>
    Date.now() < run.alertUntil ? "Alert" : "Watching";

  function trackItem(result: AnalysisResult, isAlert: boolean) {
    if (result.event === "none") return;
    // An unconfirmed concealment leaves the list alone, so it never claims more than the alert did.
    if (result.event === "concealed" && !isAlert) return;
    showShelf(setItemState(shelfRef.current, result.item, ITEM_STATE[result.event]));
  }

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

  async function check(run: Run, { sheet, frameCount }: PendingCheck) {
    run.isBusy = true;
    showStatus("Checking");
    const startedAt = performance.now();
    try {
      const items = shelfRef.current.map((item) => item.name);
      const instruction = buildCheckInstruction(items, frameCount);
      const mockStep = run.mockStep === null ? undefined : run.mockStep++;
      const result = await analyze(sheet, instruction, mockStep);
      if (runRef.current !== run) return;
      const took = secondsSince(startedAt);
      run.lastAnalysis = result;
      setLastResult({ line: `${describe(result)} (${took})`, sheet });
      log("ai", `AI replied in ${took}: ${describe(result)}`, sheet);
      if (result.track.length) log("ai", `Item track: ${result.track.join(" → ")}`);
      const now = Date.now();
      const decision = decide(result, now, run.alertUntil);
      log(decision.isAlert ? "alert" : "decision", decision.why);
      trackItem(result, decision.isAlert);
      if (decision.isAlert) {
        run.alertUntil = now + ALERT_COOLDOWN_MS;
        await reportIncident(result, sheet);
      }
    } catch (error) {
      run.backoffUntil = Date.now() + ERROR_BACKOFF_MS;
      if (runRef.current === run) {
        setLastResult({ line: `Check failed, retrying in 10 s: ${errorMessage(error)}`, sheet });
        log("error", `AI check failed (${errorMessage(error)}), pausing checks for 10 s`);
      }
    } finally {
      run.isBusy = false;
      if (runRef.current === run) {
        showStatus(idleStatus(run));
        const next = run.pending;
        run.pending = null;
        if (next && Date.now() >= run.backoffUntil) void check(run, next);
      }
    }
  }

  function tick(run: Run) {
    const frame = captureFrame(run.video, run.pool[run.poolNext]);
    if (!frame) return;
    run.pool[run.poolNext] = frame;
    run.poolNext = (run.poolNext + 1) % FRAME_POOL_SIZE;
    const grey = toGrey(frame);
    const mask = run.prevGrey ? changedCells(run.prevGrey, grey) : new Uint8Array(grey.length);
    run.prevGrey = grey;
    if (run.isScanning) return;
    if (!run.isBusy) showStatus(idleStatus(run));
    const changed = mask.reduce((sum, cell) => sum + cell, 0);
    const action = run.tracker.push(frame, mask, changed >= MIN_CHANGED_CELLS, Date.now());
    if (!action) return;
    if (Date.now() < run.backoffUntil) {
      log("error", "Action skipped: checks are paused after an AI error");
      return;
    }
    const job = {
      sheet: buildContactSheet(action.frames, motionBounds(action.mask)),
      frameCount: action.frames.length,
    };
    const took = (action.durationMs / 1000).toFixed(1);
    log(
      "motion",
      `Action finished (${took} s): sending ${job.frameCount} frames, cropped to the movement`,
    );
    // Never two calls at once: the latest action waits for the current one.
    if (run.isBusy) {
      run.pending = job;
      log("motion", "AI busy: action queued");
      return;
    }
    void check(run, job);
  }

  async function scan(run: Run) {
    run.isScanning = true;
    showStatus("Scanning");
    log("info", "Scanning the shelf");
    await new Promise((resolve) => window.setTimeout(resolve, SCAN_DELAY_MS));
    if (runRef.current !== run) return;
    const startedAt = performance.now();
    try {
      const image = snapshot(run.video, SCAN_WIDTH);
      if (!image) throw new Error("no video frame yet");
      const items = await scanShelf(image, run.mockStep !== null);
      if (runRef.current !== run) return;
      showShelf(items.map((name) => ({ name, state: "on_shelf" })));
      const found = items.join(", ") || "no items found";
      setLastResult({ line: `Shelf: ${found}`, sheet: image });
      log("info", `Shelf scanned in ${secondsSince(startedAt)}: ${found}`, image);
    } catch (error) {
      if (runRef.current !== run) return;
      showShelf([]);
      setLastResult({ line: `Shelf scan failed: ${errorMessage(error)}`, sheet: null });
      log("error", `Shelf scan failed (${errorMessage(error)}), watching without an item list`);
    } finally {
      run.isScanning = false;
      if (runRef.current === run) showStatus("Watching");
    }
  }

  function stop() {
    const run = runRef.current;
    if (!run) return;
    window.clearInterval(run.tickTimer);
    window.clearInterval(run.mirrorTimer);
    window.clearTimeout(run.stopTimer);
    run.stopOverlay?.();
    run.video.onended = null;
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

  /** Starts the rear camera, or plays `clip` through the same pipeline when given. */
  async function start(video: HTMLVideoElement, overlay: HTMLCanvasElement, clip?: File) {
    if (runRef.current) return;
    const isMock = new URLSearchParams(window.location.search).get("mock") === "1";
    const run: Run = {
      video,
      pool: [],
      poolNext: 0,
      tracker: createEventTracker<HTMLCanvasElement>(),
      prevGrey: null,
      isScanning: false,
      isBusy: false,
      pending: null,
      backoffUntil: 0,
      alertUntil: 0,
      mockStep: isMock ? 0 : null,
      lastAnalysis: null,
    };
    runRef.current = run;
    showShelf([]);
    // One channel per page: reopening the same topic while the old one closes reuses the closing channel.
    mirrorRef.current ??= openMirror();
    try {
      await camera.start(video, clip);
    } catch (error) {
      if (runRef.current === run) runRef.current = null;
      camera.stop();
      setLastResult({ line: `Camera error: ${errorMessage(error)}`, sheet: null });
      return;
    }
    // Stop was pressed while the camera permission prompt was open.
    if (runRef.current !== run) return camera.stop();
    video.onended = () => stop();
    run.tickTimer = window.setInterval(() => tick(run), CAPTURE_INTERVAL_MS);
    run.mirrorTimer = window.setInterval(
      () =>
        mirrorRef.current?.sendFrame(video, overlay, {
          status: statusRef.current,
          shelf: shelfRef.current,
        }),
      MIRROR_INTERVAL_MS,
    );
    run.stopTimer = window.setTimeout(stop, MAX_RUN_MS);
    const source = clip ? `Test clip "${clip.name.slice(0, 60)}"` : "Camera";
    log("info", `${source} started${isMock ? " (mock AI)" : ""}`);
    void attachOverlay(run, overlay);
    await scan(run);
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

  return { status, lastResult, shelf, start, stop };
}

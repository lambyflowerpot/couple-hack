import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import {
  DETECTOR_STATUSES,
  ITEM_STATES,
  LOG_KINDS,
  type LogEntry,
  type MirrorFrame,
} from "./types";

// shortcut: one fixed channel, so every viewer sees every camera; add a room code if several cameras run at once.
const CHANNEL = "camera-mirror";
const MIRROR_WIDTH = 640;
const MIRROR_QUALITY = 0.6;
const STALE_AFTER_MS = 3_000;
const LOG_LIMIT = 40;
export const MIRROR_INTERVAL_MS = 200;

// Anyone with the public key can broadcast on the channel, so the viewer validates what it renders.
const jpegDataUrl = z.string().startsWith("data:image/jpeg;base64,");
const frameSchema = z.object({
  image: jpegDataUrl,
  status: z.enum(DETECTOR_STATUSES),
  // A phone tab opened before the shelf list existed sends none; show its video anyway.
  shelf: z
    .array(z.object({ name: z.string().max(80), state: z.enum(ITEM_STATES) }))
    .max(20)
    .catch([]),
});
const logSchema = z.object({
  at: z.number(),
  kind: z.enum(LOG_KINDS),
  text: z.string().max(500),
  sheet: jpegDataUrl.nullable(),
});

export interface MirrorPublisher {
  sendFrame(
    video: HTMLVideoElement,
    overlay: HTMLCanvasElement,
    state: Omit<MirrorFrame, "image">,
  ): void;
  log(entry: LogEntry): void;
  close(): void;
}

/** Phone side: broadcasts log entries, and video frames with boxes while a viewer is open. */
export function openMirror(): MirrorPublisher {
  let isReady = false;
  let hasViewer = false;
  const canvas = document.createElement("canvas");
  const channel = supabase.channel(CHANNEL);
  channel
    .on("presence", { event: "sync" }, () => {
      hasViewer = Object.keys(channel.presenceState()).length > 0;
    })
    .subscribe((status) => {
      isReady = status === "SUBSCRIBED";
    });

  const send = (event: string, payload: MirrorFrame | LogEntry) => {
    if (isReady) void channel.send({ type: "broadcast", event, payload });
  };

  return {
    sendFrame(video, overlay, state) {
      if (!hasViewer || !video.videoWidth) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = MIRROR_WIDTH;
      canvas.height = Math.round((MIRROR_WIDTH * video.videoHeight) / video.videoWidth);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.drawImage(overlay, 0, 0, canvas.width, canvas.height);
      send("frame", { image: canvas.toDataURL("image/jpeg", MIRROR_QUALITY), ...state });
    },
    log: (entry) => send("log", entry),
    close: () => void supabase.removeChannel(channel),
  };
}

/** Laptop side: the latest frame and the decision log, newest first. */
export function useMirrorView() {
  const [frame, setFrame] = useState<MirrorFrame | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [isLive, setIsLive] = useState(false);
  const lastFrameAt = useRef(0);

  useEffect(() => {
    const channel = supabase.channel(CHANNEL);
    channel
      // Presence must be enabled before subscribing for track() to reach the phone.
      .on("presence", { event: "sync" }, () => {})
      .on("broadcast", { event: "frame" }, ({ payload }) => {
        const parsed = frameSchema.safeParse(payload);
        if (!parsed.success) return;
        lastFrameAt.current = Date.now();
        setFrame(parsed.data);
        setIsLive(true);
      })
      .on("broadcast", { event: "log" }, ({ payload }) => {
        const parsed = logSchema.safeParse(payload);
        if (parsed.success) setLog((prev) => [parsed.data, ...prev].slice(0, LOG_LIMIT));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track({ role: "viewer" });
      });
    const staleTimer = window.setInterval(
      () => setIsLive(Date.now() - lastFrameAt.current < STALE_AFTER_MS),
      1_000,
    );
    return () => {
      window.clearInterval(staleTimer);
      void supabase.removeChannel(channel);
    };
  }, []);

  return { frame, log, isLive };
}

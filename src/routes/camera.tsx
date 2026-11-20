import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMirrorView } from "@/detector/mirror";
import type { LogKind } from "@/detector/types";
import { useDetector } from "@/detector/useDetector";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/camera")({
  head: () => ({
    meta: [
      { title: "Camera — Shoplifting Detection Demo" },
      { name: "description", content: "Camera view of the shoplifting detection demo." },
      { property: "og:title", content: "Camera — Shoplifting Detection Demo" },
      { property: "og:description", content: "Camera view of the shoplifting detection demo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // ?view=1 turns this page into the laptop mirror of the phone camera.
  // The router rewrites it to ?view=true, so both spellings must match.
  validateSearch: (search: Record<string, unknown>): { view?: true } =>
    [1, "1", true, "true"].includes(search["view"] as never) ? { view: true } : {},
  component: Page,
});

const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  Idle: "secondary",
  Watching: "default",
  Checking: "outline",
  Alert: "destructive",
};

const LOG_STYLE: Record<LogKind, string> = {
  info: "text-muted-foreground",
  motion: "text-muted-foreground",
  ai: "bg-muted font-medium",
  decision: "bg-secondary text-secondary-foreground",
  alert: "bg-destructive font-semibold text-destructive-foreground",
  error: "border border-destructive text-destructive",
};

function Page() {
  return Route.useSearch().view ? <MirrorView /> : <CameraView />;
}

function CameraView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const { status, lastResult, start, stop } = useDetector();
  const isRunning = status !== "Idle";

  const onStart = () => {
    if (videoRef.current && overlayRef.current) void start(videoRef.current, overlayRef.current);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 bg-background p-4 text-foreground">
      {/* The box takes the video's own shape (portrait on phones); the overlay matches it exactly. */}
      <div className="relative w-full overflow-hidden rounded-lg bg-black">
        <video
          ref={videoRef}
          className="block max-h-[70vh] w-full object-contain"
          playsInline
          muted
          autoPlay
        />
        <canvas
          ref={overlayRef}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          aria-hidden
        />
      </div>
      <div className="flex items-center gap-3">
        {isRunning ? (
          <Button variant="outline" onClick={stop}>
            Stop
          </Button>
        ) : (
          <Button onClick={onStart}>Start</Button>
        )}
        <Badge variant={STATUS_VARIANT[status]} role="status">
          {status}
        </Badge>
      </div>
      <p className="truncate text-sm text-muted-foreground" title={lastResult?.line}>
        {lastResult?.line ?? "No result yet"}
      </p>
      {lastResult?.sheet && (
        <img src={lastResult.sheet} alt="Latest contact sheet" className="w-48 rounded border" />
      )}
    </main>
  );
}

function MirrorView() {
  const { frame, log, isLive } = useMirrorView();
  const sheet = log.find((entry) => entry.sheet)?.sheet;

  return (
    <main className="min-h-screen bg-background p-4 text-foreground lg:p-6">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[3fr_2fr]">
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Live camera</h1>
            <Badge
              variant={isLive && frame ? STATUS_VARIANT[frame.status] : "secondary"}
              role="status"
            >
              {isLive && frame ? frame.status : "Offline"}
            </Badge>
          </div>
          <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-black">
            {isLive && frame ? (
              <img
                src={frame.image}
                alt="Live camera view with detection boxes"
                className="h-full w-full object-contain"
              />
            ) : (
              <p className="p-6 text-center text-sm text-white/70">
                Waiting for the camera: open /camera on the phone and tap Start.
              </p>
            )}
          </div>
          {sheet && (
            <figure className="flex flex-col gap-2">
              <figcaption className="text-sm text-muted-foreground">
                Last 4 frames the AI checked, oldest first
              </figcaption>
              <img
                src={sheet}
                alt="Latest frames sent to the AI"
                className="w-full max-w-md rounded border"
              />
            </figure>
          )}
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Decision log</h2>
          {log.length === 0 && <p className="text-sm text-muted-foreground">No events yet.</p>}
          <ol
            role="log"
            aria-live="polite"
            className="flex flex-col gap-1.5 lg:max-h-[80vh] lg:overflow-y-auto"
          >
            {log.map((entry) => (
              <li
                key={`${entry.at}-${entry.kind}-${entry.text}`}
                className={cn("rounded-md px-3 py-2 text-sm", LOG_STYLE[entry.kind])}
              >
                <time className="mr-2 font-mono text-xs opacity-70">
                  {new Date(entry.at).toLocaleTimeString()}
                </time>
                {entry.text}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}

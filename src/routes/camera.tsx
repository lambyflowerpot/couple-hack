import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, Play, ShieldCheck, Square } from "lucide-react";
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
      { title: "Camera — TheftWatch Detection Demo" },
      {
        name: "description",
        content: "TheftWatch live camera demo with shoplifting detection and evidence snapshots.",
      },
      { property: "og:title", content: "Camera — TheftWatch Detection Demo" },
      {
        property: "og:description",
        content: "TheftWatch live camera demo with shoplifting detection and evidence snapshots.",
      },
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
    <main className="dark min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="brand-strip h-1" aria-hidden="true" />
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:py-5">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img src="/logo-mark.png" alt="" className="h-12 w-auto shrink-0 sm:h-14" />
            <span className="truncate text-2xl font-extrabold sm:text-3xl">TheftWatch</span>
          </Link>
          <Button
            asChild
            variant="destructive"
            className="btn-shine h-11 shrink-0 px-3 sm:h-12 sm:px-5"
          >
            <Link to="/guard" aria-label="Guard demo">
              <ShieldCheck aria-hidden="true" />
              <span className="hidden sm:inline">Guard demo</span>
              <span className="sm:hidden">Guard</span>
            </Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-primary">Detection demo</p>
            <h1 className="text-3xl font-extrabold sm:text-4xl">Camera</h1>
          </div>
          <Badge
            variant={STATUS_VARIANT[status]}
            role="status"
            className="gap-2 px-3 py-1.5 text-sm"
          >
            <span
              className={`h-2 w-2 rounded-full ${status === "Alert" ? "bg-destructive-foreground" : isRunning ? "bg-primary-foreground" : "bg-muted-foreground"}`}
              aria-hidden="true"
            />
            {status}
          </Badge>
        </div>

        {/* The active video's own shape and matching overlay stay unchanged. */}
        <div
          className={`relative w-full overflow-hidden rounded-lg border bg-background ${status === "Alert" ? "border-destructive" : isRunning ? "border-primary/50" : "border-border"} ${isRunning ? "" : "aspect-video"}`}
        >
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
          {!isRunning && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card text-muted-foreground">
              <Camera className="h-10 w-10 text-primary" strokeWidth={1.5} aria-hidden="true" />
              <span className="text-sm">Camera offline</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-border py-4">
          <span className="text-sm text-muted-foreground">Camera feed</span>
          {isRunning ? (
            <Button
              variant="destructive"
              className="btn-shine h-12 min-w-32 font-semibold"
              onClick={stop}
            >
              <Square aria-hidden="true" /> Stop
            </Button>
          ) : (
            <Button className="btn-shine h-12 min-w-32 font-semibold" onClick={onStart}>
              <Play aria-hidden="true" /> Start
            </Button>
          )}
        </div>

        <div className="pt-5">
          <h2 className="mb-2 text-sm font-semibold">Latest result</h2>
          <p className="break-words text-sm leading-relaxed text-muted-foreground" role="log">
            {lastResult?.line ?? "No result yet"}
          </p>
          {lastResult?.sheet && (
            <img
              src={lastResult.sheet}
              alt="Latest contact sheet"
              className="mt-4 w-full max-w-sm rounded-lg border border-border"
            />
          )}
        </div>
      </section>
    </main>
  );
}

function MirrorView() {
  const { frame, log, isLive } = useMirrorView();
  const sheet = log.find((entry) => entry.sheet)?.sheet;

  return (
    <main className="dark min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="brand-strip h-1" aria-hidden="true" />
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 lg:px-6">
          <img src="/logo-mark.png" alt="" className="h-10 w-auto" />
          <span className="text-2xl font-extrabold">TheftWatch</span>
          <span className="text-sm text-muted-foreground">Live detection</span>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 p-4 lg:grid-cols-[3fr_2fr] lg:p-6">
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

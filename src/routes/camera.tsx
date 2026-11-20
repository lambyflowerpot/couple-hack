import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDetector } from "@/detector/useDetector";

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
  component: Page,
});

const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  Idle: "secondary",
  Watching: "default",
  Checking: "outline",
  Alert: "destructive",
};

function Page() {
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

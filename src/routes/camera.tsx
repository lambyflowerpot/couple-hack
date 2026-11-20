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
  const { status, lastResult, start, stop } = useDetector();
  const isRunning = status !== "Idle";

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 bg-background p-4 text-foreground">
      <video
        ref={videoRef}
        className="aspect-video w-full rounded-lg bg-black object-contain"
        playsInline
        muted
        autoPlay
      />
      <div className="flex items-center gap-3">
        {isRunning ? (
          <Button variant="outline" onClick={stop}>
            Stop
          </Button>
        ) : (
          <Button onClick={() => videoRef.current && void start(videoRef.current)}>Start</Button>
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

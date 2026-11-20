import { useCallback, useEffect, useRef } from "react";

async function openStream(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotAllowedError") throw error;
    return navigator.mediaDevices.getUserMedia({ video: true });
  }
}

export function useCamera() {
  const streamRef = useRef<MediaStream | null>(null);
  const clipUrlRef = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
    if (video && clipUrlRef.current) {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(clipUrlRef.current);
    }
    clipUrlRef.current = null;
  }, []);

  /** Plays the rear camera, or `clip` (a recorded test video) when given. */
  const start = useCallback(async (video: HTMLVideoElement, clip?: File) => {
    videoRef.current = video;
    if (clip) {
      clipUrlRef.current = URL.createObjectURL(clip);
      video.srcObject = null;
      video.src = clipUrlRef.current;
      await video.play();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera needs HTTPS (or localhost) and a supported browser");
    }
    const stream = await openStream();
    streamRef.current = stream;
    video.srcObject = stream;
    await video.play();
  }, []);

  useEffect(() => stop, [stop]);

  return { start, stop };
}

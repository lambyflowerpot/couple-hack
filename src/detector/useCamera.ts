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
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const start = useCallback(async (video: HTMLVideoElement) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera needs HTTPS (or localhost) and a supported browser");
    }
    const stream = await openStream();
    streamRef.current = stream;
    videoRef.current = video;
    video.srcObject = stream;
    await video.play();
  }, []);

  useEffect(() => stop, [stop]);

  return { start, stop };
}

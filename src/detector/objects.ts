import type { Detection, ObjectDetector } from "@mediapipe/tasks-vision";

// Must match the exact @mediapipe/tasks-vision version in package.json.
const MEDIAPIPE_VERSION = "1.2.2";
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite";
const MIN_SCORE = 0.4;
const MAX_BOXES = 5;
// Detection is synchronous on the main thread, so cap it at ~10 fps to keep the page responsive.
const DETECT_INTERVAL_MS = 100;

const COLOR_PERSON = "#22c55e";
const COLOR_ITEM = "#3b82f6";
const COLOR_ALERT = "#ef4444";

export interface OverlayAction {
  text: string | null;
  isAlert: boolean;
}

let loading: Promise<ObjectDetector> | null = null;

function personScore(d: Detection): number {
  const category = d.categories[0];
  return category?.categoryName === "person" ? category.score : 0;
}

/** Loads the model once per page; a failed load is retried on the next call. */
export function loadObjectDetector(): Promise<ObjectDetector> {
  loading ??= (async () => {
    const { FilesetResolver, ObjectDetector } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
    const options = (delegate: "GPU" | "CPU") => ({
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: "VIDEO" as const,
      scoreThreshold: MIN_SCORE,
      maxResults: MAX_BOXES,
    });
    try {
      return await ObjectDetector.createFromOptions(fileset, options("GPU"));
    } catch {
      return ObjectDetector.createFromOptions(fileset, options("CPU"));
    }
  })().catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}

/** Draws labelled boxes over the video until the returned stop function is called. */
export function startOverlay(
  detector: ObjectDetector,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  getAction: () => OverlayAction,
): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  let frameId = 0;
  let lastAt = 0;

  const draw = (now: number) => {
    frameId = requestAnimationFrame(draw);
    if (now - lastAt < DETECT_INTERVAL_MS || !video.videoWidth) return;
    lastAt = now;
    // Resizing also clears the canvas; it matches the video so box pixels line up.
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const { detections } = detector.detectForVideo(video, now);
    const action = getAction();
    // The AI's action goes on the most confident person only.
    const lead = detections.reduce<Detection | undefined>(
      (best, d) => (personScore(d) > (best ? personScore(best) : 0) ? d : best),
      undefined,
    );
    const unit = video.videoWidth / 160;
    ctx.lineWidth = unit / 2;
    ctx.font = `bold ${unit * 4}px sans-serif`;
    ctx.textBaseline = "top";
    for (const detection of detections) {
      const { boundingBox: box, categories } = detection;
      const category = categories[0];
      if (!box || !category) continue;
      const isPerson = category.categoryName === "person";
      const color = action.isAlert ? COLOR_ALERT : isPerson ? COLOR_PERSON : COLOR_ITEM;
      const score = `${category.categoryName} ${Math.round(category.score * 100)}%`;
      const label = detection === lead && action.text ? `${score} · ${action.text}` : score;
      const labelWidth = ctx.measureText(label).width + unit * 2;
      const labelX = Math.max(0, Math.min(box.originX, canvas.width - labelWidth));
      const labelY = Math.max(0, box.originY);
      ctx.strokeStyle = color;
      ctx.strokeRect(box.originX, box.originY, box.width, box.height);
      ctx.fillStyle = color;
      ctx.fillRect(labelX, labelY, labelWidth, unit * 5);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, labelX + unit, labelY + unit / 2);
    }
  };

  frameId = requestAnimationFrame(draw);
  return () => {
    cancelAnimationFrame(frameId);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
}

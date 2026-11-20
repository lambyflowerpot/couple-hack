export const FRAME_WIDTH = 480;
export const BUFFER_SIZE = 4;
// Mean absolute greyscale difference (0-255) above which the scene counts as active.
export const MOTION_THRESHOLD = 8;

const GREY_WIDTH = 32;
const GREY_HEIGHT = 18;
const SHEET_WIDTH = 960;
const SHEET_HEIGHT = 540;
const SHEET_QUALITY = 0.6;
const CELL_WIDTH = SHEET_WIDTH / 2;
const CELL_HEIGHT = SHEET_HEIGHT / 2;
const LABEL_SIZE = 32;

// iOS Safari caps total canvas memory and frees dropped canvases slowly, so canvases are reused.
const scratch: { grey?: HTMLCanvasElement; sheet?: HTMLCanvasElement } = {};

function canvas2d(width: number, height: number, canvas = document.createElement("canvas")) {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  return { canvas, ctx };
}

/** Draws into `reuse` when given. Returns null until the video has real dimensions. */
export function captureFrame(
  video: HTMLVideoElement,
  reuse?: HTMLCanvasElement,
): HTMLCanvasElement | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const height = Math.round((FRAME_WIDTH * video.videoHeight) / video.videoWidth);
  const { canvas, ctx } = canvas2d(FRAME_WIDTH, height, reuse);
  ctx.drawImage(video, 0, 0, FRAME_WIDTH, height);
  return canvas;
}

export function toGrey(frame: HTMLCanvasElement): Uint8Array {
  const { ctx } = canvas2d(
    GREY_WIDTH,
    GREY_HEIGHT,
    (scratch.grey ??= document.createElement("canvas")),
  );
  ctx.drawImage(frame, 0, 0, GREY_WIDTH, GREY_HEIGHT);
  const rgba = ctx.getImageData(0, 0, GREY_WIDTH, GREY_HEIGHT).data;
  const grey = new Uint8Array(GREY_WIDTH * GREY_HEIGHT);
  for (let i = 0; i < grey.length; i++) {
    grey[i] = 0.299 * rgba[i * 4]! + 0.587 * rgba[i * 4 + 1]! + 0.114 * rgba[i * 4 + 2]!;
  }
  return grey;
}

export function meanDiff(a: Uint8Array, b: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i]! - (b[i] ?? 0));
  return a.length ? sum / a.length : 0;
}

/** 2x2 grid, oldest first, each frame fitted into its cell and labelled 1-4. */
export function buildContactSheet(frames: HTMLCanvasElement[]): string {
  const { canvas, ctx } = canvas2d(
    SHEET_WIDTH,
    SHEET_HEIGHT,
    (scratch.sheet ??= document.createElement("canvas")),
  );
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, SHEET_WIDTH, SHEET_HEIGHT);
  ctx.font = `bold ${LABEL_SIZE - 8}px sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  frames.forEach((frame, i) => {
    const x = (i % 2) * CELL_WIDTH;
    const y = Math.floor(i / 2) * CELL_HEIGHT;
    const scale = Math.min(CELL_WIDTH / frame.width, CELL_HEIGHT / frame.height);
    const w = frame.width * scale;
    const h = frame.height * scale;
    ctx.drawImage(frame, x + (CELL_WIDTH - w) / 2, y + (CELL_HEIGHT - h) / 2, w, h);
    ctx.fillStyle = "#000";
    ctx.fillRect(x, y, LABEL_SIZE, LABEL_SIZE);
    ctx.fillStyle = "#fff";
    ctx.fillText(String(i + 1), x + LABEL_SIZE / 2, y + LABEL_SIZE / 2);
  });
  return canvas.toDataURL("image/jpeg", SHEET_QUALITY);
}

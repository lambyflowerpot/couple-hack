export const FRAME_WIDTH = 480;
// Motion is measured on a GRID_COLS x GRID_ROWS greyscale copy of each frame.
export const GRID_COLS = 32;
export const GRID_ROWS = 18;
// A grid cell counts as changed when its grey level (0-255) moves by more than this.
export const CELL_DIFF_THRESHOLD = 20;
// The scene is active when at least this many cells changed since the previous frame.
export const MIN_CHANGED_CELLS = 6;

const CROP_PADDING_CELLS = 2;
// The crop never zooms in past half the frame, so the item's start and end points stay in view.
const MIN_CROP_FRACTION = 0.5;
const SNAPSHOT_QUALITY = 0.8;
const SHEET_WIDTH = 1280;
const SHEET_HEIGHT = 720;
const SHEET_COLS = 3;
const SHEET_ROWS = 2;
const SHEET_QUALITY = 0.7;
const LABEL_SIZE = 40;

/** A region of the frame in fractions (0-1) of its width and height. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

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

/** A full-frame JPEG data URL `width` pixels wide, or null until the video has dimensions. */
export function snapshot(video: HTMLVideoElement, width: number): string | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const height = Math.round((width * video.videoHeight) / video.videoWidth);
  const { canvas, ctx } = canvas2d(width, height);
  ctx.drawImage(video, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", SNAPSHOT_QUALITY);
}

export function toGrey(frame: HTMLCanvasElement): Uint8Array {
  const { ctx } = canvas2d(
    GRID_COLS,
    GRID_ROWS,
    (scratch.grey ??= document.createElement("canvas")),
  );
  ctx.drawImage(frame, 0, 0, GRID_COLS, GRID_ROWS);
  const rgba = ctx.getImageData(0, 0, GRID_COLS, GRID_ROWS).data;
  const grey = new Uint8Array(GRID_COLS * GRID_ROWS);
  for (let i = 0; i < grey.length; i++) {
    grey[i] = 0.299 * rgba[i * 4]! + 0.587 * rgba[i * 4 + 1]! + 0.114 * rgba[i * 4 + 2]!;
  }
  return grey;
}

/** 1 for each grid cell whose grey level changed by more than CELL_DIFF_THRESHOLD, else 0. */
export function changedCells(a: Uint8Array, b: Uint8Array): Uint8Array {
  return a.map((value, i) => (Math.abs(value - (b[i] ?? value)) > CELL_DIFF_THRESHOLD ? 1 : 0));
}

/** Padded bounding box of the changed cells, at least half the frame each way. */
export function motionBounds(mask: Uint8Array): Rect {
  let minCol = GRID_COLS;
  let maxCol = -1;
  let minRow = GRID_ROWS;
  let maxRow = -1;
  mask.forEach((cell, i) => {
    if (!cell) return;
    const col = i % GRID_COLS;
    const row = Math.floor(i / GRID_COLS);
    minCol = Math.min(minCol, col);
    maxCol = Math.max(maxCol, col);
    minRow = Math.min(minRow, row);
    maxRow = Math.max(maxRow, row);
  });
  if (maxCol < 0) return { x: 0, y: 0, w: 1, h: 1 };
  const [x, w] = padSpan(minCol, maxCol, GRID_COLS);
  const [y, h] = padSpan(minRow, maxRow, GRID_ROWS);
  return { x, y, w, h };
}

/** Pads cells first..last out of `count`, widens to MIN_CROP_FRACTION, and keeps it in 0-1. */
function padSpan(first: number, last: number, count: number): [start: number, size: number] {
  const start = Math.max(0, first - CROP_PADDING_CELLS) / count;
  const end = Math.min(count, last + 1 + CROP_PADDING_CELLS) / count;
  const size = Math.max(end - start, MIN_CROP_FRACTION);
  const centred = (start + end) / 2 - size / 2;
  return [Math.min(Math.max(centred, 0), 1 - size), size];
}

/** 3x2 grid in time order, each frame cropped to `crop`, fitted into its cell and numbered. */
export function buildContactSheet(frames: HTMLCanvasElement[], crop: Rect): string {
  const { canvas, ctx } = canvas2d(
    SHEET_WIDTH,
    SHEET_HEIGHT,
    (scratch.sheet ??= document.createElement("canvas")),
  );
  const cellWidth = SHEET_WIDTH / SHEET_COLS;
  const cellHeight = SHEET_HEIGHT / SHEET_ROWS;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, SHEET_WIDTH, SHEET_HEIGHT);
  ctx.font = `bold ${LABEL_SIZE - 10}px sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  frames.slice(0, SHEET_COLS * SHEET_ROWS).forEach((frame, i) => {
    const x = (i % SHEET_COLS) * cellWidth;
    const y = Math.floor(i / SHEET_COLS) * cellHeight;
    const sw = crop.w * frame.width;
    const sh = crop.h * frame.height;
    const scale = Math.min(cellWidth / sw, cellHeight / sh);
    const [w, h] = [sw * scale, sh * scale];
    const [sx, sy] = [crop.x * frame.width, crop.y * frame.height];
    ctx.drawImage(frame, sx, sy, sw, sh, x + (cellWidth - w) / 2, y + (cellHeight - h) / 2, w, h);
    ctx.fillStyle = "#000";
    ctx.fillRect(x, y, LABEL_SIZE, LABEL_SIZE);
    ctx.fillStyle = "#fff";
    ctx.fillText(String(i + 1), x + LABEL_SIZE / 2, y + LABEL_SIZE / 2);
  });
  return canvas.toDataURL("image/jpeg", SHEET_QUALITY);
}

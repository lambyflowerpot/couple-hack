// Motion must stop for this long before an action counts as finished.
export const SETTLE_MS = 700;
// A longer action is sent in chunks of at most this length.
export const MAX_EVENT_MS = 4_000;
export const SHEET_FRAMES = 6;

/** The frames of one finished action and the cells that moved during it. */
export interface FinishedEvent<T> {
  frames: T[];
  mask: Uint8Array;
  durationMs: number;
}

interface OpenEvent<T> {
  frames: T[];
  mask: Uint8Array;
  startAt: number;
  lastMotionAt: number;
}

/** `count` items spread evenly from first to last, keeping both ends. */
export function pickEvenly<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items;
  return Array.from(
    { length: count },
    (_, i) => items[Math.round((i * (items.length - 1)) / (count - 1))]!,
  );
}

/**
 * Groups frames into actions: an action starts with the still frame before motion,
 * and finishes once motion has stopped for SETTLE_MS or has run for MAX_EVENT_MS.
 */
export function createEventTracker<T>() {
  let before: T | null = null;
  let open: OpenEvent<T> | null = null;

  return {
    /** Feeds one frame; returns the action when this frame finishes one. */
    push(frame: T, mask: Uint8Array, isActive: boolean, now: number): FinishedEvent<T> | null {
      if (!open) {
        if (!isActive) {
          before = frame;
          return null;
        }
        const frames = before === null ? [frame] : [before, frame];
        open = { frames, mask: mask.slice(), startAt: now, lastMotionAt: now };
        return null;
      }
      open.frames.push(frame);
      if (isActive) {
        open.lastMotionAt = now;
        mask.forEach((cell, i) => (open!.mask[i] ||= cell));
      }
      const isSettled = now - open.lastMotionAt >= SETTLE_MS;
      if (!isSettled && now - open.startAt < MAX_EVENT_MS) return null;
      const finished = {
        frames: pickEvenly(open.frames, SHEET_FRAMES),
        mask: open.mask,
        durationMs: now - open.startAt,
      };
      // A still-moving action continues as a new chunk that starts from this frame.
      before = frame;
      open = isSettled
        ? null
        : { frames: [frame], mask: new Uint8Array(mask.length), startAt: now, lastMotionAt: now };
      return finished;
    },
  };
}

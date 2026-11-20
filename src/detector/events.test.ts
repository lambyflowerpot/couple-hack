import { describe, expect, it } from "vitest";

import { MAX_EVENT_MS, SETTLE_MS, SHEET_FRAMES, createEventTracker, pickEvenly } from "./events";

const STEP_MS = 333;
const still = new Uint8Array([0, 0]);
const moving = new Uint8Array([1, 0]);

/** Feeds frames 0, 1, 2… at STEP_MS apart; `isActive(i)` says which ones show motion. */
function run(count: number, isActive: (i: number) => boolean) {
  const tracker = createEventTracker<number>();
  const finished = [];
  for (let i = 0; i < count; i++) {
    const event = tracker.push(i, isActive(i) ? moving : still, isActive(i), i * STEP_MS);
    if (event) finished.push({ at: i, ...event });
  }
  return finished;
}

describe("createEventTracker", () => {
  it("sends nothing while the scene is still", () => {
    expect(run(20, () => false)).toEqual([]);
  });

  it("finishes an action once motion settles, starting from the still frame before it", () => {
    const [event, ...rest] = run(20, (i) => i >= 3 && i <= 6);
    expect(rest).toEqual([]);
    expect(event!.frames[0]).toBe(2);
    expect(event!.at).toBe(6 + Math.ceil(SETTLE_MS / STEP_MS));
    expect(event!.mask).toEqual(moving);
  });

  it("sends at most SHEET_FRAMES frames, keeping the first and last", () => {
    const [event] = run(20, (i) => i >= 1 && i <= 8);
    expect(event!.frames).toHaveLength(SHEET_FRAMES);
    expect(event!.frames[0]).toBe(0);
    expect(event!.frames.at(-1)).toBe(event!.at);
  });

  it("chunks continuous motion every MAX_EVENT_MS", () => {
    const events = run(40, () => true);
    expect(events.length).toBeGreaterThanOrEqual(2);
    for (const event of events)
      expect(event.durationMs).toBeLessThanOrEqual(MAX_EVENT_MS + STEP_MS);
  });
});

describe("pickEvenly", () => {
  it("keeps short lists whole", () => {
    expect(pickEvenly([1, 2, 3], 6)).toEqual([1, 2, 3]);
  });

  it("spreads picks across long lists", () => {
    expect(pickEvenly([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 6)).toEqual([0, 2, 4, 6, 8, 10]);
  });
});

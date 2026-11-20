import { describe, expect, it } from "vitest";

import { CELL_DIFF_THRESHOLD, GRID_COLS, GRID_ROWS, changedCells, motionBounds } from "./frames";

const CELLS = GRID_COLS * GRID_ROWS;

function maskWith(cells: [col: number, row: number][]): Uint8Array {
  const mask = new Uint8Array(CELLS);
  for (const [col, row] of cells) mask[row * GRID_COLS + col] = 1;
  return mask;
}

describe("changedCells", () => {
  it("marks only cells that moved by more than the threshold", () => {
    const a = new Uint8Array([100, 100, 100]);
    const b = new Uint8Array([100, 100 + CELL_DIFF_THRESHOLD, 100 - CELL_DIFF_THRESHOLD - 1]);
    expect([...changedCells(a, b)]).toEqual([0, 0, 1]);
  });
});

describe("motionBounds", () => {
  it("is the whole frame when nothing moved", () => {
    expect(motionBounds(new Uint8Array(CELLS))).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it("covers the moving cells and never zooms past half the frame", () => {
    const rect = motionBounds(maskWith([[20, 10]]));
    expect(rect.w).toBeCloseTo(0.5);
    expect(rect.h).toBeCloseTo(0.5);
    expect(rect.x).toBeLessThanOrEqual(20 / GRID_COLS);
    expect(rect.x + rect.w).toBeGreaterThanOrEqual(21 / GRID_COLS);
  });

  it("stays inside the frame for movement at the edge", () => {
    const rect = motionBounds(maskWith([[GRID_COLS - 1, GRID_ROWS - 1]]));
    expect(rect.x + rect.w).toBeLessThanOrEqual(1);
    expect(rect.y + rect.h).toBeLessThanOrEqual(1);
  });

  it("spans a hand path from the table to the pocket", () => {
    const rect = motionBounds(
      maskWith([
        [2, 3],
        [29, 15],
      ]),
    );
    expect(rect.x).toBe(0);
    expect(rect.w).toBe(1);
  });
});

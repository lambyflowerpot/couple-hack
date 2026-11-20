import { describe, expect, it } from "vitest";

import { meanDiff } from "./frames";

describe("meanDiff", () => {
  it("is zero for identical frames", () => {
    expect(meanDiff(new Uint8Array([10, 20, 30]), new Uint8Array([10, 20, 30]))).toBe(0);
  });

  it("averages absolute differences in both directions", () => {
    expect(meanDiff(new Uint8Array([0, 100]), new Uint8Array([20, 80]))).toBe(20);
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/analyze.functions", () => ({ analyzeFrames: vi.fn() }));

import type { AnalysisResult } from "./types";
import { decide } from "./useDetector";

const result = (overrides: Partial<AnalysisResult>): AnalysisResult => ({
  event: "concealed",
  item: "crisps",
  location: "pocket",
  confidence: 0.9,
  reason: "",
  ...overrides,
});

describe("decide", () => {
  it("alerts on confident concealment outside the cooldown", () => {
    expect(decide(result({}), 1_000, 0).isAlert).toBe(true);
  });

  it("alerts at exactly the minimum confidence", () => {
    expect(decide(result({ confidence: 0.7 }), 1_000, 0).isAlert).toBe(true);
  });

  it("explains why low confidence does not alert", () => {
    expect(decide(result({ confidence: 0.55 }), 1_000, 0)).toEqual({
      isAlert: false,
      why: "No alert: confidence 55% is below 70%",
    });
  });

  it("does not alert during the cooldown", () => {
    expect(decide(result({}), 1_000, 5_000).isAlert).toBe(false);
  });

  it.each(["none", "picked_up", "returned"] as const)("does not alert on %s", (event) => {
    expect(decide(result({ event }), 1_000, 0).isAlert).toBe(false);
  });
});

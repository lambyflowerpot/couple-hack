import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/analyze.functions", () => ({ analyzeFrames: vi.fn() }));

import { analyze, parseResult } from "./analyze";

describe("parseResult", () => {
  it("parses a fenced JSON reply", () => {
    const reply =
      '```json\n{"event":"concealed","item":"mug","location":"pocket","confidence":0.8,"reason":"hid mug"}\n```';
    expect(parseResult(reply)).toEqual({
      event: "concealed",
      item: "mug",
      location: "pocket",
      confidence: 0.8,
      reason: "hid mug",
    });
  });

  it.each([
    ["not json", "sorry, I cannot help"],
    ["unknown event", '{"event":"stolen","item":"","location":"","confidence":0.9,"reason":""}'],
    ["missing confidence", '{"event":"concealed","item":"mug","location":"bag","reason":""}'],
    [
      "confidence out of range",
      '{"event":"concealed","item":"","location":"","confidence":7,"reason":""}',
    ],
  ])("treats %s as none", (_, reply) => {
    expect(parseResult(reply).event).toBe("none");
  });
});

describe("analyze in mock mode", () => {
  it("cycles none, picked_up, concealed, returned with TEST: reasons", async () => {
    const results = await Promise.all([0, 1, 2, 3, 4].map((step) => analyze("", step)));
    expect(results.map((r) => r.event)).toEqual([
      "none",
      "picked_up",
      "concealed",
      "returned",
      "none",
    ]);
    expect(results.every((r) => r.reason.startsWith("TEST:"))).toBe(true);
  });
});

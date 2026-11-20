import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/analyze.functions", () => ({ analyzeFrames: vi.fn() }));

import { analyze, parseResult, parseScan, scanShelf } from "./analyze";

describe("parseResult", () => {
  it("parses a fenced JSON reply with the item track", () => {
    const reply =
      '```json\n{"track":["on shelf","in pocket"],"event":"concealed","item":"mug","location":"pocket","confidence":0.8,"reason":"hid mug"}\n```';
    expect(parseResult(reply)).toEqual({
      event: "concealed",
      item: "mug",
      location: "pocket",
      confidence: 0.8,
      reason: "hid mug",
      track: ["on shelf", "in pocket"],
    });
  });

  it("defaults a missing track to empty", () => {
    const reply = '{"event":"none","item":"","location":"","confidence":0.9,"reason":""}';
    expect(parseResult(reply).track).toEqual([]);
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

describe("parseScan", () => {
  it("trims, drops blanks and duplicates", () => {
    expect(parseScan('{"items":[" crisps ","","crisps","water bottle"]}')).toEqual([
      "crisps",
      "water bottle",
    ]);
  });

  it("throws on a reply without an item list", () => {
    expect(() => parseScan("I see a table")).toThrow();
  });
});

describe("mock mode", () => {
  it("cycles none, picked_up, concealed, returned with TEST: reasons", async () => {
    const results = await Promise.all([0, 1, 2, 3, 4].map((step) => analyze("", "", step)));
    expect(results.map((r) => r.event)).toEqual([
      "none",
      "picked_up",
      "concealed",
      "returned",
      "none",
    ]);
    expect(results.every((r) => r.reason.startsWith("TEST:"))).toBe(true);
  });

  it("names only items from the mock shelf", async () => {
    const shelf = await scanShelf("", true);
    const results = await Promise.all([1, 2, 3].map((step) => analyze("", "", step)));
    expect(results.every((r) => shelf.includes(r.item))).toBe(true);
  });
});

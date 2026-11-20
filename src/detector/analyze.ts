import { z } from "zod";

import { analyzeFrames } from "@/lib/analyze.functions";
import { SCAN_INSTRUCTION } from "./prompt";
import type { AnalysisResult } from "./types";

const MAX_SHELF_ITEMS = 8;

const resultSchema = z.object({
  event: z.enum(["none", "picked_up", "returned", "concealed"]),
  item: z.string().catch(""),
  location: z.string().catch(""),
  confidence: z.number().min(0).max(1),
  reason: z.string().catch(""),
  track: z.array(z.string()).catch([]),
});

const scanSchema = z.object({ items: z.array(z.string()) });

const NONE: AnalysisResult = {
  event: "none",
  item: "",
  location: "",
  confidence: 0,
  reason: "unreadable reply",
  track: [],
};

// Canned data for ?mock=1. Replies cycle in order; one is fenced to exercise parsing.
const MOCK_SHELF = ["water bottle", "crisps", "chocolate bar"];
const MOCK_REPLIES = [
  '{"track":["no item","no item","no item"],"event":"none","item":"","location":"","confidence":0.9,"reason":"TEST: no table item involved"}',
  '{"track":["on shelf","in hand","in hand"],"event":"picked_up","item":"water bottle","location":"table","confidence":0.85,"reason":"TEST: person lifts bottle from table"}',
  '```json\n{"track":["on shelf","in hand","in pocket"],"event":"concealed","item":"chocolate bar","location":"pocket","confidence":0.9,"reason":"TEST: chocolate slipped into pocket"}\n```',
  '{"track":["in hand","in hand","on shelf"],"event":"returned","item":"water bottle","location":"table","confidence":0.8,"reason":"TEST: bottle put back on table"}',
];

// Strips code fences and any prose around the JSON object.
function extractJson(text: string): unknown {
  return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
}

export function parseResult(text: string): AnalysisResult {
  try {
    const parsed = resultSchema.safeParse(extractJson(text));
    return parsed.success ? parsed.data : NONE;
  } catch {
    return NONE;
  }
}

/** Unique, trimmed item names; throws on a reply that is not the expected JSON. */
export function parseScan(text: string): string[] {
  const { items } = scanSchema.parse(extractJson(text));
  const names = items.map((name) => name.trim()).filter(Boolean);
  return [...new Set(names)].slice(0, MAX_SHELF_ITEMS);
}

/** Pass mockStep to skip the backend and return canned reply number mockStep. */
export async function analyze(
  image: string,
  instruction: string,
  mockStep?: number,
): Promise<AnalysisResult> {
  if (mockStep !== undefined) return parseResult(MOCK_REPLIES[mockStep % MOCK_REPLIES.length]!);
  const { result } = await analyzeFrames({ data: { image, instruction } });
  return parseResult(result);
}

/** Lists the items on the shelf in `image`. */
export async function scanShelf(image: string, isMock: boolean): Promise<string[]> {
  if (isMock) return MOCK_SHELF;
  const { result } = await analyzeFrames({ data: { image, instruction: SCAN_INSTRUCTION } });
  return parseScan(result);
}

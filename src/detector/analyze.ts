import { z } from "zod";

import { analyzeFrames } from "@/lib/analyze.functions";
import { INSTRUCTION } from "./prompt";
import type { AnalysisResult } from "./types";

const resultSchema = z.object({
  event: z.enum(["none", "picked_up", "returned", "concealed"]),
  item: z.string().catch(""),
  location: z.string().catch(""),
  confidence: z.number().min(0).max(1),
  reason: z.string().catch(""),
});

const NONE: AnalysisResult = {
  event: "none",
  item: "",
  location: "",
  confidence: 0,
  reason: "unreadable reply",
};

// Canned replies for ?mock=1, cycled in order. One is fenced to exercise parsing.
const MOCK_REPLIES = [
  '{"event":"none","item":"","location":"","confidence":0.9,"reason":"TEST: no table item involved"}',
  '{"event":"picked_up","item":"water bottle","location":"table","confidence":0.85,"reason":"TEST: person lifts bottle from table"}',
  '```json\n{"event":"concealed","item":"water bottle","location":"bag","confidence":0.9,"reason":"TEST: bottle slipped into bag"}\n```',
  '{"event":"returned","item":"water bottle","location":"table","confidence":0.8,"reason":"TEST: bottle put back on table"}',
];

export function parseResult(text: string): AnalysisResult {
  // Strips code fences and any prose around the JSON object.
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  try {
    const parsed = resultSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : NONE;
  } catch {
    return NONE;
  }
}

/** Pass mockStep to skip the backend and return canned reply number mockStep. */
export async function analyze(image: string, mockStep?: number): Promise<AnalysisResult> {
  if (mockStep !== undefined) return parseResult(MOCK_REPLIES[mockStep % MOCK_REPLIES.length]!);
  const { result } = await analyzeFrames({ data: { image, instruction: INSTRUCTION } });
  return parseResult(result);
}

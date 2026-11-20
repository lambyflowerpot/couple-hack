export type DetectorEvent = "none" | "picked_up" | "returned" | "concealed";

export interface AnalysisResult {
  event: DetectorEvent;
  item: string;
  location: string;
  confidence: number;
  reason: string;
}

export type DetectorStatus = "Idle" | "Watching" | "Checking" | "Alert";

export interface LastResult {
  line: string;
  sheet: string | null;
}

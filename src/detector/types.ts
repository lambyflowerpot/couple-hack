export type DetectorEvent = "none" | "picked_up" | "returned" | "concealed";

export interface AnalysisResult {
  event: DetectorEvent;
  item: string;
  location: string;
  confidence: number;
  reason: string;
}

export const DETECTOR_STATUSES = ["Idle", "Watching", "Checking", "Alert"] as const;
export type DetectorStatus = (typeof DETECTOR_STATUSES)[number];

export const LOG_KINDS = ["info", "motion", "ai", "decision", "alert", "error"] as const;
export type LogKind = (typeof LOG_KINDS)[number];

/** One step of the decision process, mirrored to the laptop view. */
export interface LogEntry {
  at: number;
  kind: LogKind;
  text: string;
  sheet: string | null;
}

export interface MirrorFrame {
  image: string;
  status: DetectorStatus;
}

export interface LastResult {
  line: string;
  sheet: string | null;
}

export type DetectorEvent = "none" | "picked_up" | "returned" | "concealed";

export interface AnalysisResult {
  event: DetectorEvent;
  item: string;
  location: string;
  confidence: number;
  reason: string;
  /** Where the handled item is in each frame, as the AI saw it. */
  track: string[];
}

export const DETECTOR_STATUSES = ["Idle", "Scanning", "Watching", "Checking", "Alert"] as const;
export type DetectorStatus = (typeof DETECTOR_STATUSES)[number];

export const ITEM_STATES = ["on_shelf", "picked_up", "returned", "concealed"] as const;
export type ItemState = (typeof ITEM_STATES)[number];

export interface ShelfItem {
  name: string;
  state: ItemState;
}

export interface LastResult {
  line: string;
  sheet: string | null;
}

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
  shelf: ShelfItem[];
}

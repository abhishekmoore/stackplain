export interface TraceResult {
  likelyCause: string;
  certain: string[];
  guessed: string[];
  checks: string[];
  source: "model" | "heuristic";
  model?: string;
  logTimestamp?: string;
}

export interface Trace {
  id: string;
  logText: string;
  createdAt: string;
  result: TraceResult;
}

import { z } from "zod";

export const modelResultSchema = z.object({
  likelyCause: z.string().min(10).max(600),
  certain: z.array(z.string().min(3).max(300)).min(1).max(8),
  guessed: z.array(z.string().min(3).max(300)).min(1).max(8),
  checks: z.array(z.string().min(5).max(300)).length(3),
});

export type ModelResult = z.infer<typeof modelResultSchema>;

export interface TraceResult extends ModelResult {
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

export interface TraceStore {
  insert(doc: Omit<Trace, "id" | "createdAt">): Promise<Trace>;
  list(limit: number): Promise<Trace[]>;
  get(id: string): Promise<Trace | null>;
  remove(id: string): Promise<boolean>;
}

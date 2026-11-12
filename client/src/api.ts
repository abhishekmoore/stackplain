import axios from "axios";
import type { Trace } from "./types";

const api = axios.create({ baseURL: "/api" });

export async function listTraces(): Promise<Trace[]> {
  const { data } = await api.get<Trace[]>("/traces");
  return data;
}

export async function createTrace(logText: string): Promise<Trace> {
  const { data } = await api.post<Trace>("/traces", { logText });
  return data;
}

export async function deleteTrace(id: string): Promise<void> {
  await api.delete(`/traces/${id}`);
}

export async function health(): Promise<{ ai: string; model: string; store: string }> {
  const { data } = await api.get("/health");
  return data;
}

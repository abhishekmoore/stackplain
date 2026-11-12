import { Router } from "express";
import { z } from "zod";
import { translateLog } from "../ai/translate.js";
import type { TraceStore } from "../types.js";

const createSchema = z.object({
  logText: z.string().min(20).max(20000),
});

export function tracesRouter(store: TraceStore) {
  const router = Router();

  router.get("/", async (req, res) => {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const rows = await store.list(limit);
    res.json(rows);
  });

  router.post("/", async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "logText must be 20–20,000 characters." });
      return;
    }
    const result = await translateLog(parsed.data.logText);
    const saved = await store.insert({
      logText: parsed.data.logText,
      result,
    });
    res.status(201).json(saved);
  });

  router.get("/:id", async (req, res) => {
    const row = await store.get(req.params.id);
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(row);
  });

  router.delete("/:id", async (req, res) => {
    const ok = await store.remove(req.params.id);
    if (!ok) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(204).end();
  });

  return router;
}

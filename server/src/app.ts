import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tracesRouter } from "./routes/traces.js";
import { connectStore } from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  const store = await connectStore();

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      store: process.env.MONGO_URI ? "mongo" : "memory",
      ai: process.env.OPENAI_API_KEY ? "model" : "heuristic",
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    });
  });

  app.use("/api/traces", tracesRouter(store));

  const clientDist = path.resolve(__dirname, "../../client/dist");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Unexpected error" });
  });

  return app;
}

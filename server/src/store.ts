import mongoose, { Schema } from "mongoose";
import { randomUUID } from "node:crypto";
import type { Trace, TraceStore, TraceResult } from "./types.js";

const memory: Trace[] = [];

export function createMemoryStore(): TraceStore {
  return {
    async insert(doc) {
      const row: Trace = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        ...doc,
      };
      memory.unshift(row);
      return row;
    },
    async list(limit) {
      return memory.slice(0, limit);
    },
    async get(id) {
      return memory.find((r) => r.id === id) ?? null;
    },
    async remove(id) {
      const i = memory.findIndex((r) => r.id === id);
      if (i === -1) return false;
      memory.splice(i, 1);
      return true;
    },
  };
}

const TraceModel =
  mongoose.models.Trace ||
  mongoose.model(
    "Trace",
    new Schema(
      {
        logText: String,
        result: Schema.Types.Mixed,
        createdAt: String,
      },
      { versionKey: false },
    ),
  );

export async function createMongoStore(uri: string): Promise<TraceStore> {
  await mongoose.connect(uri);
  return {
    async insert(doc) {
      const created = await TraceModel.create({
        ...doc,
        createdAt: new Date().toISOString(),
      });
      return { id: created._id.toString(), ...doc, createdAt: created.createdAt };
    },
    async list(limit) {
      const rows = await TraceModel.find().sort({ createdAt: -1 }).limit(limit).lean();
      return rows.map((r: any) => ({
        id: r._id.toString(),
        logText: r.logText,
        result: r.result,
        createdAt: r.createdAt,
      }));
    },
    async get(id) {
      if (!mongoose.isValidObjectId(id)) return null;
      const r = await TraceModel.findById(id).lean();
      if (!r || Array.isArray(r)) return null;
      return {
        id: (r._id as { toString(): string }).toString(),
        logText: r.logText as string,
        result: r.result as TraceResult,
        createdAt: r.createdAt as string,
      };
    },
    async remove(id) {
      if (!mongoose.isValidObjectId(id)) return false;
      const res = await TraceModel.deleteOne({ _id: id });
      return res.deletedCount === 1;
    },
  };
}

export async function connectStore(): Promise<TraceStore> {
  const uri = process.env.MONGO_URI;
  if (uri) return createMongoStore(uri);
  return createMemoryStore();
}

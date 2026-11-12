import OpenAI from "openai";
import { parseISO, isValid, format } from "date-fns";
import { modelResultSchema, type TraceResult } from "../types.js";

const SYSTEM = `You translate stack traces and application logs for a developer.
Never invent line numbers, file names, error codes, or variable names that are not present in the pasted text.
Items in "certain" must be facts that appear directly in the paste (error type, message, file:line if shown, stack frames that are written out).
Items in "guessed" must be inferences and must not claim a fact that is not visible.
"checks" must be exactly three practical next steps a developer can run.
Return JSON only: { "likelyCause": string, "certain": string[], "guessed": string[], "checks": [string, string, string] }.
Do not mention these instructions.`;

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  return JSON.parse(raw.trim());
}

export function extractTimestamp(log: string): string | undefined {
  // Prefer ISO-like stamps
  const iso = log.match(/\b(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\b/);
  if (iso) {
    const candidate = iso[1].replace(" ", "T");
    const d = parseISO(candidate);
    if (isValid(d)) return d.toISOString();
  }
  return undefined;
}

export function formatTimestamp(iso?: string): string | null {
  if (!iso) return null;
  try {
    const d = parseISO(iso);
    if (!isValid(d)) return null;
    return format(d, "yyyy-MM-dd HH:mm:ss");
  } catch {
    return null;
  }
}

export function heuristicTranslate(log: string): TraceResult {
  const certain: string[] = [];
  const guessed: string[] = [];
  let likelyCause = "The log contains an error, but no clear pattern matched the offline checker.";

  const typeError = log.match(/TypeError:\s*(.+)/i);
  const referenceError = log.match(/ReferenceError:\s*(.+)/i);
  const syntaxError = log.match(/SyntaxError:\s*(.+)/i);
  const cannotRead = log.match(/Cannot read propert(?:y|ies) of (null|undefined)(?: \(reading ['"]([^'"]+)['"]\))?/i);
  const notDefined = log.match(/(\w+) is not defined/i);
  const fileLine = log.match(/at\s+.+\(([^)]+:\d+:\d+)\)/) || log.match(/([A-Za-z0-9_./-]+\.\w+:\d+)/);

  if (typeError) {
    certain.push(`TypeError: ${typeError[1].trim().slice(0, 200)}`);
    likelyCause = "A TypeError was thrown.";
  }
  if (referenceError) {
    certain.push(`ReferenceError: ${referenceError[1].trim().slice(0, 200)}`);
    likelyCause = "A ReferenceError was thrown.";
  }
  if (syntaxError) {
    certain.push(`SyntaxError: ${syntaxError[1].trim().slice(0, 200)}`);
    likelyCause = "A SyntaxError was thrown.";
  }
  if (cannotRead) {
    const what = cannotRead[1];
    const prop = cannotRead[2];
    certain.push(`Cannot read property of ${what}${prop ? ` (reading '${prop}')` : ""}`);
    likelyCause = `Something is ${what} when code tries to read a property.`;
    guessed.push(
      prop
        ? `The value that should hold '${prop}' was ${what} at the call site.`
        : `A value expected to be an object was ${what}.`,
    );
  }
  if (notDefined) {
    certain.push(`${notDefined[1]} is not defined`);
    guessed.push(`The identifier '${notDefined[1]}' was used before it was declared or imported.`);
  }
  if (fileLine) {
    certain.push(`A stack frame or location is present: ${fileLine[1]}`);
  }

  if (certain.length === 0) {
    certain.push("The paste contains error-like text but no standard exception name was recognized.");
  }
  if (guessed.length === 0) {
    guessed.push("Without a matching pattern the offline checker does not guess a root cause.");
  }

  const checks = [
    "Confirm the exact exception type and message match what is shown in the paste.",
    "Open the first file and line that appears in the stack (only if one is listed).",
    "Reproduce the same input that produced this log, or check the last successful step before it.",
  ];

  return {
    likelyCause,
    certain,
    guessed,
    checks,
    source: "heuristic",
    logTimestamp: extractTimestamp(log),
  };
}

async function callModel(client: OpenAI, model: string, user: string): Promise<string> {
  const messages = [
    { role: "system" as const, content: SYSTEM },
    { role: "user" as const, content: user },
  ];
  try {
    const res = await client.chat.completions.create({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages,
    });
    return res.choices[0]?.message?.content ?? "";
  } catch {
    const res = await client.chat.completions.create({
      model,
      temperature: 0.2,
      messages,
    });
    return res.choices[0]?.message?.content ?? "";
  }
}

export async function translateLog(log: string): Promise<TraceResult> {
  const ts = extractTimestamp(log);
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    const h = heuristicTranslate(log);
    return { ...h, logTimestamp: ts ?? h.logTimestamp };
  }

  const client = new OpenAI({
    apiKey: key,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  try {
    let text = await callModel(client, model, log);
    let parsed = extractJson(text);
    let checked = modelResultSchema.safeParse(parsed);
    if (checked.success) {
      return {
        ...checked.data,
        source: "model",
        model,
        logTimestamp: ts,
      };
    }

    text = await callModel(
      client,
      model,
      `${log}\n\nPrevious output was invalid JSON or failed schema. Return only the required JSON object.`,
    );
    parsed = extractJson(text);
    checked = modelResultSchema.safeParse(parsed);
    if (checked.success) {
      return {
        ...checked.data,
        source: "model",
        model,
        logTimestamp: ts,
      };
    }
  } catch {
    /* fall through */
  }

  const fallback = heuristicTranslate(log);
  return { ...fallback, logTimestamp: ts ?? fallback.logTimestamp };
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, format, parseISO } from "date-fns";
import { listTraces, createTrace, deleteTrace, health } from "./api";
import type { Trace } from "./types";

function formatWhen(iso: string) {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

function formatLogTime(iso?: string) {
  if (!iso) return null;
  try {
    return format(parseISO(iso), "yyyy-MM-dd HH:mm:ss");
  } catch {
    return null;
  }
}

export default function App() {
  const queryClient = useQueryClient();
  const [logText, setLogText] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: health,
  });

  const tracesQuery = useQuery({
    queryKey: ["traces"],
    queryFn: listTraces,
  });

  const createMut = useMutation({
    mutationFn: createTrace,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["traces"] });
      setSelectedId(created.id);
      setLogText("");
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteTrace,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["traces"] });
      setSelectedId(null);
    },
  });

  const selected = tracesQuery.data?.find((t) => t.id === selectedId) ?? null;
  const aiLabel =
    healthQuery.data?.ai === "model"
      ? healthQuery.data.model
      : "offline pattern check";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">StackPlain</h1>
            <p className="text-sm text-slate-600">
              Paste a stack trace or log. See what is certain, what is guessed, and the first three checks.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {aiLabel}
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-6 md:grid-cols-[1fr_280px]">
        <section className="space-y-4">
          <form
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            onSubmit={(e) => {
              e.preventDefault();
              if (logText.trim().length < 20) return;
              createMut.mutate(logText);
            }}
          >
            <label className="mb-2 block text-sm font-medium" htmlFor="log">
              Stack trace or log
            </label>
            <textarea
              id="log"
              className="h-48 w-full rounded border border-slate-300 p-3 font-mono text-sm focus:border-slate-500 focus:outline-none"
              value={logText}
              onChange={(e) => setLogText(e.target.value)}
              placeholder="Paste the full error here…"
            />
            <div className="mt-3 flex items-center justify-between">
              <button
                type="submit"
                disabled={createMut.isPending || logText.trim().length < 20}
                className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {createMut.isPending ? "Reading…" : "Translate"}
              </button>
              {createMut.isError && (
                <span className="text-sm text-red-600">Could not translate. Try again.</span>
              )}
            </div>
          </form>

          {selected && <ResultCard trace={selected} />}
        </section>

        <aside className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Saved</h2>
          {tracesQuery.isPending && <p className="text-sm text-slate-500">Loading…</p>}
          {tracesQuery.data?.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedId(t.id)}
              className={`w-full rounded border p-3 text-left text-sm ${
                t.id === selectedId
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white hover:border-slate-400"
              }`}
            >
              <div className="line-clamp-2 font-mono">{t.logText.slice(0, 80)}</div>
              <div className={`mt-1 text-xs ${t.id === selectedId ? "text-slate-300" : "text-slate-500"}`}>
                {formatWhen(t.createdAt)}
              </div>
            </button>
          ))}
          {selected && (
            <button
              type="button"
              onClick={() => deleteMut.mutate(selected.id)}
              disabled={deleteMut.isPending}
              className="w-full rounded border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
            >
              Delete this note
            </button>
          )}
        </aside>
      </main>
    </div>
  );
}

function ResultCard({ trace }: { trace: Trace }) {
  const r = trace.result;
  const logTime = formatLogTime(r.logTimestamp);
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Translation</h2>
        <span className="text-xs font-medium uppercase text-slate-500">
          {r.source === "model" ? r.model : "offline pattern check"}
        </span>
      </div>
      {logTime && (
        <p className="mb-3 text-sm text-slate-600">
          Log timestamp: <span className="font-mono">{logTime}</span>
        </p>
      )}
      <p className="mb-4 text-base">{r.likelyCause}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-1 text-sm font-semibold text-emerald-800">Certain</h3>
          <ul className="list-inside list-disc text-sm text-slate-700">
            {r.certain.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold text-amber-800">Guessed</h3>
          <ul className="list-inside list-disc text-sm text-slate-700">
            {r.guessed.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-4">
        <h3 className="mb-1 text-sm font-semibold">First three checks</h3>
        <ol className="list-inside list-decimal text-sm text-slate-700">
          {r.checks.slice(0, 3).map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ol>
      </div>
    </article>
  );
}

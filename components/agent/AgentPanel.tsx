"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircleQuestion, Sparkles } from "lucide-react";

import { AgentPanelTabs } from "./AgentPanelTabs";
import { Markdown } from "./Markdown";
import { toolLabel } from "@/lib/agent/tool-labels";
import { onAgentSeed } from "@/lib/agent/seed-bus";

const TABBED_ENABLED = process.env.NEXT_PUBLIC_FEATURE_TABBED_AGENT === "1";

export type InsightInput = {
  summary?: string;
  bullets: string[];
  followUps: string[];
};

export type ArticleContextInput = {
  title: string;
  url: string;
  publisher?: string;
  publishedAt?: number;
  body: string;
};

export type RelatedNewsInput = {
  title: string;
  url: string;
  publisher: string;
  publisherDomain?: string;
  publisherIcon?: string;
  publishedAt: number;
  imageUrl?: string;
  description?: string;
};

export type AgentPanelProps = {
  contextSymbol?: string;
  articleContext?: ArticleContextInput;
  seedPrompt?: string;
  relatedNews?: RelatedNewsInput[];
  insight?: InsightInput | null;
};

export function AgentPanel(props: AgentPanelProps) {
  if (TABBED_ENABLED) return <AgentPanelTabs {...props} />;
  return <AgentPanelLegacy {...props} />;
}

type ToolEvent = {
  name: string;
  args?: unknown;
  preview?: string;
  status: "running" | "done";
};

type ActionExecuted = {
  kind: "watchlist_add";
  symbol: string;
  exchange: "NSE" | "BSE";
  message: string;
};

type AlertProposalPayload = {
  kind: "alert_create";
  symbol: string;
  exchange: "NSE" | "BSE";
  triggers: { price: { condition: "above" | "below"; target: number } };
  note: string | null;
  message: string;
};

type AlertProposal = {
  id: string;
  status: "pending" | "confirming" | "confirmed" | "declined" | "failed";
  error?: string;
  payload: AlertProposalPayload;
};

type AssistantTurn = {
  kind: "assistant";
  content: string;
  phase: string | null;
  tools: ToolEvent[];
  executed: ActionExecuted[];
  proposals: AlertProposal[];
  done: boolean;
};

type ChatMessage =
  | { kind: "user"; content: string }
  | AssistantTurn;

const STARTER_PROMPTS_GLOBAL = [
  "Latest material updates on RELIANCE?",
  "Compare TCS with peers on P/E and ROE",
  "Who's been buying HDFCBANK last 30 days?",
  "What did INFY guide on margins last quarter?",
];


function suggestionsFor(symbol: string): string[] {
  return [
    `Latest material news on ${symbol}`,
    `Compare ${symbol} with sector peers on P/E and ROE`,
    `${symbol} — FII/DII flows last 30 days`,
    `${symbol} — technicals and 1y return vs peers`,
    `Management guidance for ${symbol} last 4 quarters`,
  ];
}

function followupsFor(symbol?: string): string[] {
  if (symbol) {
    return [
      `${symbol}: bull vs bear case`,
      `${symbol}: shareholding trend`,
      `${symbol}: recent dividends and splits`,
      `${symbol}: Reddit buzz today`,
    ];
  }
  return [
    "Screen for smallcaps with FII buying + positive guidance",
    "What's moving in Bank Nifty today?",
    "Explain PSU bank rerating in 2 lines",
  ];
}

function AgentPanelLegacy({ contextSymbol, articleContext, seedPrompt, insight }: AgentPanelProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sendRef = useRef<(prompt?: string) => void>(() => {});

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: busy ? "auto" : "smooth" });
  }, [messages, busy]);

  const starters = useMemo(
    () => (contextSymbol ? suggestionsFor(contextSymbol) : STARTER_PROMPTS_GLOBAL),
    [contextSymbol],
  );

  const followups = useMemo(() => {
    if (insight?.followUps && insight.followUps.length > 0) return insight.followUps;
    return followupsFor(contextSymbol);
  }, [contextSymbol, insight]);

  useEffect(() => {
    sendRef.current = send;
  });

  useEffect(() => onAgentSeed((p) => sendRef.current(p)), []);

  useEffect(() => {
    if (!seedPrompt) return;
    sendRef.current(seedPrompt);
  }, [seedPrompt]);

  const lastAssistantDone = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.kind === "assistant") return m.done;
    }
    return false;
  })();

  function updateLastAssistant(patch: (turn: AssistantTurn) => AssistantTurn) {
    setMessages((prev) => {
      const copy = [...prev];
      for (let i = copy.length - 1; i >= 0; i--) {
        const m = copy[i];
        if (m.kind === "assistant" && !m.done) {
          copy[i] = patch(m);
          return copy;
        }
      }
      return copy;
    });
  }

  async function send(prompt?: string) {
    const q = (prompt ?? input).trim();
    if (!q || busy) return;
    if (!prompt) setInput("");
    setErr(null);
    setBusy(true);
    setLastPrompt(q);

    // Cap history to last 8 turns (16 messages) — prevents the payload from
    // growing unbounded across a long thread and keeps NIM happy.
    const history = messages
      .filter((m) => m.kind === "user" || (m.kind === "assistant" && m.done))
      .slice(-16)
      .map((m) =>
        m.kind === "user"
          ? { role: "user" as const, content: m.content }
          : { role: "assistant" as const, content: m.content },
      );

    setMessages((prev) => [
      ...prev,
      { kind: "user", content: q },
      { kind: "assistant", content: "", phase: null, tools: [], executed: [], proposals: [], done: false },
    ]);

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, contextSymbol, articleContext, history }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const frames = buf.split("\n\n");
        buf = frames.pop() ?? "";

        for (const frame of frames) {
          const lines = frame.split("\n");
          const evLine = lines.find((l) => l.startsWith("event:"));
          const dataLine = lines.find((l) => l.startsWith("data:"));
          if (!evLine || !dataLine) continue;
          const event = evLine.slice("event:".length).trim();
          const data = JSON.parse(dataLine.slice("data:".length).trim());

          if (event === "phase") {
            updateLastAssistant((t) => ({ ...t, phase: data.message ?? data.name }));
          } else if (event === "delta") {
            updateLastAssistant((t) => ({ ...t, content: t.content + data.text }));
          } else if (event === "tool_start") {
            updateLastAssistant((t) => ({
              ...t,
              tools: [...t.tools, { name: data.name, args: data.args, status: "running" }],
            }));
          } else if (event === "tool_end") {
            updateLastAssistant((t) => {
              let realIdx = -1;
              for (let k = t.tools.length - 1; k >= 0; k--) {
                if (t.tools[k].name === data.name && t.tools[k].status === "running") {
                  realIdx = k;
                  break;
                }
              }
              if (realIdx === -1) return t;
              const nextTools = [...t.tools];
              nextTools[realIdx] = { ...nextTools[realIdx], status: "done", preview: data.preview };
              return { ...t, tools: nextTools };
            });
          } else if (event === "action_executed") {
            updateLastAssistant((t) => ({ ...t, executed: [...t.executed, data as ActionExecuted] }));
          } else if (event === "action_proposed") {
            const payload = data as AlertProposalPayload;
            updateLastAssistant((t) => ({
              ...t,
              proposals: [
                ...t.proposals,
                { id: `${payload.kind}-${payload.symbol}-${Date.now()}`, status: "pending", payload },
              ],
            }));
          } else if (event === "error") {
            setErr(data.message || "agent error");
          } else if (event === "done") {
            updateLastAssistant((t) => ({ ...t, done: true, phase: null }));
          }
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      // Mark the placeholder as done so the retry UI can render below it.
      updateLastAssistant((t) => ({ ...t, done: true, phase: null }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="agent-panel relative flex h-full min-h-[70vh] flex-col overflow-hidden bg-surface-1">
      <div className="pointer-events-none absolute inset-x-0 -top-24 h-56 bg-[radial-gradient(60%_60%_at_50%_0%,rgb(var(--brand-2)/0.16),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-x-0 -bottom-24 h-56 bg-[radial-gradient(60%_60%_at_50%_100%,rgb(var(--brand)/0.12),transparent_70%)]" />

      <div className="relative flex items-center gap-2 border-b border-hairline px-5 py-3 pr-14">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
        </span>
        <div className="t-h3">
          Research agent
        </div>
        {contextSymbol && (
          <>
            <span className="t-muted">·</span>
            <span className="chip chip--brand text-[11px]">
              {contextSymbol}
            </span>
          </>
        )}
        <div className="ml-auto hidden items-center gap-1.5 t-caption t-muted sm:flex">
          <span className="h-1 w-1 rounded-full bg-muted/60" />
          Groq · gpt-oss-120b
        </div>
      </div>

      <div ref={scrollRef} className="relative flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="fade-up text-sm text-fg/90">
            {insight && insight.bullets.length > 0 ? (
              <div className="surface-raised p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand/20 text-brand">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  <div className="t-h3">fuzz insights</div>
                </div>
                <ul className="space-y-2 t-body">
                  {insight.bullets.map((b, i) => (
                    <li key={i} className="flex gap-2 leading-snug">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand" aria-hidden />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                {insight.followUps.length > 0 && (
                  <div className="mt-4 border-t border-hairline pt-3">
                    <div className="mb-2 t-label">Ask fuzz about this</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {insight.followUps.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => send(q)}
                          className="group flex items-start gap-2 rounded-md border border-hairline bg-surface-2/40 px-3 py-2 text-left t-caption transition-colors duration-fast ease-out hover:border-brand/40 hover:bg-brand/10 hover:text-fg"
                        >
                          <MessageCircleQuestion className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand/80 group-hover:text-brand" />
                          <span className="leading-snug">{q}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-3 t-label t-muted">
                  AI · not investment advice
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-start gap-3 surface-raised p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-brand/25 to-brand-2/15 text-brand shadow-inner">
                    <span aria-hidden className="text-lg">✨</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="t-h3">
                      {contextSymbol ? `Ask anything about ${contextSymbol}` : "Ask about any Indian stock"}
                    </div>
                    <div className="mt-1 t-body t-mid">
                      I pull fresh news, filings, guidance, FII/DII flows, technicals &amp; peers before every answer — never training-data priors.
                    </div>
                  </div>
                </div>
                <div className="mb-2 t-label">Try</div>
                <div className="flex flex-wrap gap-2">
                  {starters.map((s, i) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      style={{ animationDelay: `${i * 60}ms` }}
                      className="fade-up chip chip--muted transition-colors duration-fast ease-out hover:border-brand/50 hover:bg-brand/10 hover:text-fg"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {messages.map((m, i) => {
          if (m.kind === "user") {
            return (
              <div key={i} className="fade-up flex justify-end">
                <div className="max-w-[85%] rounded-lg bg-gradient-to-br from-brand/20 via-brand/10 to-brand/5 border border-brand/40 px-4 py-2 t-body shadow-e2">
                  {m.content}
                </div>
              </div>
            );
          }
          return (
            <AssistantBlock
              key={i}
              turn={m}
              onProposalUpdate={(id, patch) =>
                setMessages((prev) => {
                  const copy = [...prev];
                  const idx = copy.indexOf(m);
                  if (idx === -1) return prev;
                  const cur = copy[idx];
                  if (cur.kind !== "assistant") return prev;
                  copy[idx] = {
                    ...cur,
                    proposals: cur.proposals.map((p) => (p.id === id ? { ...p, ...patch } : p)),
                  };
                  return copy;
                })
              }
            />
          );
        })}

        {err && (
          <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            <div className="font-medium">Something went wrong</div>
            <div className="mt-0.5">{err}</div>
            {lastPrompt && !busy && (
              <button
                type="button"
                onClick={() => send(lastPrompt)}
                className="mt-2 rounded-md border border-danger/40 bg-danger/10 px-2 py-1 text-[11px] font-medium text-danger hover:bg-danger/20"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {lastAssistantDone && !busy && !err && (
          <div className="flex flex-wrap gap-2 pt-1">
            {followups.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="chip chip--muted transition-colors duration-fast ease-out hover:border-brand/40 hover:bg-brand/10 hover:text-fg"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="relative border-t border-hairline surface-glass p-3"
      >
        <div className="group flex items-center gap-2 rounded-md border border-hairline bg-surface-2/60 px-2 py-1 shadow-inner transition-all duration-fast ease-out focus-within:border-brand/60 focus-within:shadow-[0_0_0_3px_rgb(var(--brand)/0.15)]">
          <span className="pl-1.5 text-brand/80" aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
            </svg>
          </span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={contextSymbol ? `Ask about ${contextSymbol}…` : "Ask about any Indian stock…"}
            disabled={busy}
            className="flex-1 bg-transparent px-1.5 py-2 t-body placeholder:text-muted focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="btn-brand !py-1.5 !px-3.5 text-xs"
          >
            {busy ? (
              <span className="flex gap-0.5">
                <span className="h-1 w-1 animate-pulse rounded-full bg-brand-fg/90 [animation-delay:0ms]" />
                <span className="h-1 w-1 animate-pulse rounded-full bg-brand-fg/90 [animation-delay:120ms]" />
                <span className="h-1 w-1 animate-pulse rounded-full bg-brand-fg/90 [animation-delay:240ms]" />
              </span>
            ) : (
              <>
                Ask
                <span aria-hidden>↵</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function AssistantBlock({
  turn,
  onProposalUpdate,
}: {
  turn: AssistantTurn;
  onProposalUpdate: (id: string, patch: Partial<AlertProposal>) => void;
}) {
  const runningTool = turn.tools.find((t) => t.status === "running");
  const doneCount = turn.tools.filter((t) => t.status === "done").length;
  const totalCount = turn.tools.length;

  async function confirmProposal(p: AlertProposal) {
    if (p.status !== "pending") return;
    onProposalUpdate(p.id, { status: "confirming" });
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: p.payload.symbol,
          exchange: p.payload.exchange,
          triggers: p.payload.triggers,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        onProposalUpdate(p.id, { status: "failed", error: j.error || `HTTP ${res.status}` });
      } else {
        onProposalUpdate(p.id, { status: "confirmed" });
      }
    } catch (e) {
      onProposalUpdate(p.id, { status: "failed", error: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <div className="space-y-2">
      {(turn.phase || turn.tools.length > 0) && (
        <ProgressPanel
          phase={turn.phase}
          tools={turn.tools}
          runningTool={runningTool?.name}
          doneCount={doneCount}
          totalCount={totalCount}
          collapsed={turn.done && turn.content.length > 0}
        />
      )}

      {(turn.content || turn.done) && (
        <div className="fade-up flex justify-start">
          <div className="relative max-w-[92%] rounded-lg border border-hairline bg-surface-1 px-4 py-3 t-body shadow-e1">
            <span className="pointer-events-none absolute inset-y-0 left-0 w-[3px] rounded-l-lg bg-gradient-to-b from-brand via-brand-2 to-brand opacity-70" />
            {turn.content ? (
              <Markdown text={turn.content} />
            ) : (
              <span className="inline-flex items-center gap-2 t-muted">
                <span className="flex gap-0.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand [animation-delay:300ms]" />
                </span>
                Preparing answer…
              </span>
            )}
            {!turn.done && turn.content && (
              <span className="ml-1 inline-block h-4 w-[2px] translate-y-[3px] animate-pulse bg-brand" />
            )}
          </div>
        </div>
      )}

      {turn.executed.map((a, i) => (
        <div
          key={i}
          className="flex items-center gap-2 rounded-md border border-accent/30 bg-accent/10 px-3 py-2 t-caption text-accent"
        >
          <span>✓</span>
          <span className="flex-1">{a.message}</span>
        </div>
      ))}

      {turn.proposals.map((p) => (
        <div
          key={p.id}
          className="surface-raised border-warning/30 px-3 py-3 t-caption"
        >
          <div className="mb-2 font-medium">{p.payload.message}</div>
          <div className="mb-2 t-caption t-muted">
            {p.payload.symbol} · {p.payload.triggers.price.condition} ₹{p.payload.triggers.price.target}
          </div>
          {p.status === "pending" && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => confirmProposal(p)}
                className="rounded-md bg-warning px-3 py-1 text-[11px] font-medium text-bg hover:brightness-110 transition-all duration-fast ease-out"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => onProposalUpdate(p.id, { status: "declined" })}
                className="btn-ghost !py-1 !px-3 text-[11px]"
              >
                Decline
              </button>
            </div>
          )}
          {p.status === "confirming" && <div className="t-caption t-muted">Setting alert…</div>}
          {p.status === "confirmed" && <div className="t-caption text-accent">✓ Alert set</div>}
          {p.status === "declined" && <div className="t-caption t-muted">Declined</div>}
          {p.status === "failed" && (
            <div className="t-caption text-danger">Failed: {p.error ?? "unknown error"}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function ProgressPanel({
  phase,
  tools,
  runningTool,
  doneCount,
  totalCount,
  collapsed,
}: {
  phase: string | null;
  tools: ToolEvent[];
  runningTool: string | undefined;
  doneCount: number;
  totalCount: number;
  collapsed: boolean;
}) {
  const [expanded, setExpanded] = useState(!collapsed);
  useEffect(() => {
    if (collapsed) setExpanded(false);
  }, [collapsed]);

  const header = phase
    ? phase
    : totalCount > 0
      ? `${doneCount}/${totalCount} signals fetched`
      : "";

  return (
    <div className="overflow-hidden rounded-md border border-hairline bg-surface-2/60 shadow-inner">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left t-caption transition-colors duration-fast ease-out hover:bg-brand/5"
      >
        <span className="relative flex h-2 w-2 items-center justify-center">
          {runningTool ? (
            <>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
            </>
          ) : (
            <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_6px_rgb(var(--accent)/0.7)]" />
          )}
        </span>
        <span className="flex-1 truncate font-medium">
          {header || "Working…"}
          {runningTool && (
            <span className="ml-1 font-normal t-muted">· {toolLabel(runningTool)}</span>
          )}
        </span>
        {totalCount > 0 && (
          <span className="chip chip--muted font-mono">
            {doneCount}/{totalCount}
          </span>
        )}
        <span aria-hidden className="t-muted">{expanded ? "▾" : "▸"}</span>
      </button>
      {totalCount > 0 && (
        <div className="h-[2px] w-full bg-hairline">
          <div
            className="h-full bg-gradient-to-r from-brand via-brand-2 to-brand transition-[width] duration-500"
            style={{ width: `${Math.max(4, (doneCount / Math.max(totalCount, 1)) * 100)}%` }}
          />
        </div>
      )}
      {expanded && tools.length > 0 && (
        <ul className="space-y-1 border-t border-hairline px-3 py-2">
          {tools.map((t, i) => (
            <li key={i} className="fade-up flex items-start gap-2 t-caption" style={{ animationDelay: `${i * 40}ms` }}>
              <span className="mt-[3px] flex h-3 w-3 shrink-0 items-center justify-center">
                {t.status === "running" ? (
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand shadow-[0_0_6px_rgb(var(--brand)/0.8)]" />
                ) : (
                  <span className="text-accent">✓</span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-fg">{toolLabel(t.name)}</div>
                {t.preview && (
                  <div className="truncate font-mono text-[10px] t-muted">
                    {t.preview}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

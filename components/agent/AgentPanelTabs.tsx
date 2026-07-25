"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Markdown } from "./Markdown";
import { usePanelContext } from "./PanelContext";
import type { AgentPanelProps } from "./AgentPanel";
import { onAgentSeed } from "@/lib/agent/seed-bus";
import { toolLabel } from "@/lib/agent/tool-labels";
import {
  deriveSourcesFromTools,
  deriveSymbolsFromText,
  type ToolEventLike,
} from "@/lib/agent/stream-derivations";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { FreshnessStamp } from "@/components/ui/FreshnessStamp";
import { smartReaderHref, externalLinkProps } from "@/lib/news/href";
import type { RelatedNewsInput } from "./AgentPanel";

type ToolEvent = ToolEventLike;

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

type TabKey = "ask" | "sources" | "stocks" | "news" | "refine";
const TAB_KEYS: readonly TabKey[] = ["ask", "sources", "stocks", "news", "refine"];
function isTabKey(v: unknown): v is TabKey {
  return typeof v === "string" && (TAB_KEYS as readonly string[]).includes(v);
}

const TAB_STORAGE_PREFIX = "sb:agentTab:";

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

function followupsFor(symbol?: string, hasNews = false): string[] {
  const base = symbol
    ? [
        `${symbol}: bull vs bear case`,
        `${symbol}: shareholding trend`,
        `${symbol}: recent dividends and splits`,
        `${symbol}: Reddit buzz today`,
      ]
    : [
        "Screen for smallcaps with FII buying + positive guidance",
        "What's moving in Bank Nifty today?",
        "Explain PSU bank rerating in 2 lines",
      ];
  return hasNews ? ["Explain today's top headline", ...base] : base;
}

function refineHintsFor(pathname: string, params: Record<string, string>, symbol?: string): string[] {
  if (pathname === "/screener") {
    const hints: string[] = [];
    if (params.peMax) hints.push(`Loosen P/E ceiling to ${Number(params.peMax) + 5}`);
    if (params.roeMin) hints.push(`Lower ROE floor to ${Math.max(0, Number(params.roeMin) - 3)}%`);
    if (params.momMin) hints.push(`Drop momentum floor by 5`);
    if (hints.length === 0) hints.push("Add FII buying filter", "Add quality floor (ROE ≥ 15%)");
    return hints;
  }
  if (symbol) {
    return [
      `Compare ${symbol} with peers`,
      `Bull vs bear case for ${symbol}`,
      `Explain ${symbol} drawdown`,
    ];
  }
  return followupsFor(symbol);
}

export function AgentPanelTabs({ contextSymbol, articleContext, seedPrompt, relatedNews }: AgentPanelProps) {
  const panelCtx = usePanelContext();
  const tabStorageKey = `${TAB_STORAGE_PREFIX}${panelCtx.pathname}`;

  const [activeTab, setActiveTab] = useState<TabKey>("ask");
  useEffect(() => {
    const stored = sessionStorage.getItem(tabStorageKey);
    if (isTabKey(stored)) setActiveTab(stored);
  }, [tabStorageKey]);
  useEffect(() => {
    sessionStorage.setItem(tabStorageKey, activeTab);
  }, [tabStorageKey, activeTab]);

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

  const lastAssistant = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.kind === "assistant") return m;
    }
    return null;
  }, [messages]);
  const lastAssistantDone = lastAssistant?.done ?? false;
  const lastHasNews = lastAssistant?.tools.some((t) => t.name === "get_news" && t.status === "done") ?? false;

  const followups = useMemo(() => followupsFor(contextSymbol, lastHasNews), [contextSymbol, lastHasNews]);

  const sourceCards = useMemo(
    () => (lastAssistant ? deriveSourcesFromTools(lastAssistant.tools) : []),
    [lastAssistant?.tools, lastAssistant],
  );
  const symbolMentions = useMemo(
    () => (lastAssistant ? deriveSymbolsFromText(lastAssistant.content) : []),
    [lastAssistant?.content, lastAssistant],
  );

  // Abort any in-flight SSE stream when the component unmounts, so the reader
  // doesn't setState on an unmounted tree after route change / panel close.
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    sendRef.current = send;
  });
  useEffect(() => onAgentSeed((p) => sendRef.current(p)), []);
  useEffect(() => {
    if (!seedPrompt) return;
    sendRef.current(seedPrompt);
  }, [seedPrompt]);

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
    setActiveTab("ask");

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
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, contextSymbol, articleContext, history }),
        signal: controller.signal,
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
              nextTools[realIdx] = {
                ...nextTools[realIdx],
                status: "done",
                preview: data.preview,
                doneAt: Date.now(),
              };
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
      if (e instanceof DOMException && e.name === "AbortError") return;
      setErr(e instanceof Error ? e.message : String(e));
      updateLastAssistant((t) => ({ ...t, done: true, phase: null }));
    } finally {
      setBusy(false);
    }
  }

  function updateProposal(msg: AssistantTurn, id: string, patch: Partial<AlertProposal>) {
    setMessages((prev) => {
      const copy = [...prev];
      const idx = copy.indexOf(msg);
      if (idx === -1) return prev;
      const cur = copy[idx];
      if (cur.kind !== "assistant") return prev;
      copy[idx] = {
        ...cur,
        proposals: cur.proposals.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      };
      return copy;
    });
  }

  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: "ask", label: "Ask" },
    { key: "sources", label: "Sources", badge: sourceCards.length },
    { key: "stocks", label: "Stocks", badge: symbolMentions.length },
    { key: "news", label: "News", badge: relatedNews?.length },
    { key: "refine", label: "Refine" },
  ];

  function onTabKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const idx = TAB_KEYS.indexOf(activeTab);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setActiveTab(TAB_KEYS[(idx + 1) % TAB_KEYS.length]);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setActiveTab(TAB_KEYS[(idx - 1 + TAB_KEYS.length) % TAB_KEYS.length]);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveTab(TAB_KEYS[0]);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveTab(TAB_KEYS[TAB_KEYS.length - 1]);
    }
  }

  return (
    <div className="surface flex h-full min-h-[70vh] flex-col overflow-hidden">
      <div
        role="tablist"
        aria-label="Research agent tabs"
        onKeyDown={onTabKey}
        className="flex gap-1 border-b border-hairline surface-glass px-2 py-2"
      >
        {tabs.map((t) => {
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`agent-tab-${t.key}`}
              aria-selected={active}
              aria-controls={`agent-tabpanel-${t.key}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setActiveTab(t.key)}
              className={
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 t-caption font-medium transition-colors duration-fast ease-out " +
                (active
                  ? "bg-brand/20 text-fg"
                  : "t-muted hover:bg-surface-2/60 hover:text-fg")
              }
            >
              {t.label}
              {!!t.badge && (
                <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[9px] tabular-nums t-mid">
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === "ask" && (
        <div role="tabpanel" id="agent-tabpanel-ask" aria-labelledby="agent-tab-ask" className="flex flex-1 min-h-0 flex-col">
          <AskTab
            scrollRef={scrollRef}
            messages={messages}
            contextSymbol={contextSymbol}
            starters={starters}
            followups={followups}
            err={err}
            busy={busy}
            input={input}
            lastAssistantDone={lastAssistantDone}
            lastPrompt={lastPrompt}
            onInput={setInput}
            onSend={send}
            onProposalUpdate={updateProposal}
          />
        </div>
      )}
      {activeTab === "sources" && (
        <div role="tabpanel" id="agent-tabpanel-sources" aria-labelledby="agent-tab-sources" className="flex flex-1 min-h-0 flex-col">
          <SourcesTab cards={sourceCards} />
        </div>
      )}
      {activeTab === "stocks" && (
        <div role="tabpanel" id="agent-tabpanel-stocks" aria-labelledby="agent-tab-stocks" className="flex flex-1 min-h-0 flex-col">
          <StocksTab mentions={symbolMentions} />
        </div>
      )}
      {activeTab === "news" && (
        <div role="tabpanel" id="agent-tabpanel-news" aria-labelledby="agent-tab-news" className="flex flex-1 min-h-0 flex-col">
          <NewsTab items={relatedNews ?? []} contextSymbol={contextSymbol} />
        </div>
      )}
      {activeTab === "refine" && (
        <div role="tabpanel" id="agent-tabpanel-refine" aria-labelledby="agent-tab-refine" className="flex flex-1 min-h-0 flex-col">
          <RefineTab onSend={send} contextSymbol={contextSymbol} />
        </div>
      )}
    </div>
  );
}

function AskTab({
  scrollRef,
  messages,
  contextSymbol,
  starters,
  followups,
  err,
  busy,
  input,
  lastAssistantDone,
  lastPrompt,
  onInput,
  onSend,
  onProposalUpdate,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  messages: ChatMessage[];
  contextSymbol?: string;
  starters: string[];
  followups: string[];
  err: string | null;
  busy: boolean;
  input: string;
  lastAssistantDone: boolean;
  lastPrompt: string | null;
  onInput: (v: string) => void;
  onSend: (prompt?: string) => void;
  onProposalUpdate: (msg: AssistantTurn, id: string, patch: Partial<AlertProposal>) => void;
}) {
  return (
    <>
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="t-body t-mid">
            <div className="mb-3">
              {contextSymbol
                ? `Ask anything about ${contextSymbol}. I pull fresh news, filings, guidance, FII/DII flows, technicals, peers before every answer.`
                : "Ask about any NSE/BSE stock. I pull fresh corporate signal, not training-data priors."}
            </div>
            <div className="flex flex-wrap gap-2">
              {starters.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSend(s)}
                  className="chip chip--muted transition-colors duration-fast ease-out hover:border-brand/40 hover:bg-brand/10 hover:text-fg"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => {
          if (m.kind === "user") {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-lg bg-brand/20 border border-brand/40 px-4 py-2 t-body">
                  {m.content}
                </div>
              </div>
            );
          }
          return (
            <AssistantBlock
              key={i}
              turn={m}
              onProposalUpdate={(id, patch) => onProposalUpdate(m, id, patch)}
            />
          );
        })}

        {err && (
          <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 t-caption text-danger">
            <div className="font-medium">Something went wrong</div>
            <div className="mt-0.5">{err}</div>
            {lastPrompt && !busy && (
              <button
                type="button"
                onClick={() => onSend(lastPrompt)}
                className="mt-2 rounded-md border border-danger/40 bg-danger/10 px-2 py-1 text-[11px] font-medium text-danger hover:bg-danger/20 transition-colors duration-fast ease-out"
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
                onClick={() => onSend(s)}
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
          onSend();
        }}
        className="border-t border-hairline surface-glass p-3"
      >
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => onInput(e.target.value)}
            placeholder={contextSymbol ? `Ask about ${contextSymbol}…` : "Ask about any Indian stock…"}
            disabled={busy}
            className="flex-1 rounded-md border border-hairline bg-surface-2/60 px-3 py-2 t-body placeholder:text-muted focus:border-brand focus:outline-none transition-colors duration-fast ease-out"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="btn-brand !px-4 !py-2 text-sm disabled:opacity-40"
          >
            {busy ? "…" : "Ask"}
          </button>
        </div>
      </form>
    </>
  );
}

function SourcesTab({ cards }: { cards: ReturnType<typeof deriveSourcesFromTools> }) {
  if (cards.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4 t-body t-muted">
        Sources will show here after you ask a question. Every fetch — filings, news, guidance, Reddit — gets attributed.
      </div>
    );
  }
  return (
    <div className="flex-1 space-y-2 overflow-y-auto p-4">
      {cards.map((c, i) => {
        const urls = extractUrls(c.preview);
        return (
          <div
            key={i}
            className="rounded-md border border-hairline bg-surface-2/60 p-3"
          >
            <div className="flex items-center gap-2">
              <SourceBadge source={c.source} />
              <span className="t-caption font-medium">{toolLabel(c.name)}</span>
              {c.doneAt && <FreshnessStamp ts={c.doneAt} style="absolute" className="ml-auto" />}
            </div>
            {c.preview && urls.length === 0 && (
              <div className="mt-1.5 truncate font-mono text-[11px] t-muted">{c.preview}</div>
            )}
            {urls.length > 0 && (
              <ul className="mt-2 space-y-1">
                {urls.slice(0, 4).map((u) => {
                  const host = safeHost(u);
                  const link = smartReaderHref(u);
                  return (
                    <li key={u}>
                      <a
                        href={link.href}
                        {...externalLinkProps(link)}
                        className="flex items-center gap-2 rounded-md border border-hairline bg-surface-1/60 px-2 py-1.5 t-caption transition-colors duration-fast ease-out hover:border-brand/40 hover:bg-brand/10"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`}
                          alt=""
                          width={14}
                          height={14}
                          className="h-3.5 w-3.5 rounded-sm"
                          loading="lazy"
                        />
                        <span className="truncate">{host}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function extractUrls(s: string | undefined): string[] {
  if (!s) return [];
  const matches = s.match(/https?:\/\/[^\s"'\)\]]+/g);
  if (!matches) return [];
  return [...new Set(matches)].slice(0, 8);
}

function safeHost(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}

function StocksTab({ mentions }: { mentions: ReturnType<typeof deriveSymbolsFromText> }) {
  if (mentions.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4 t-body t-muted">
        Stocks referenced in the answer will show here as tappable chips.
      </div>
    );
  }
  return (
    <div className="flex-1 space-y-2 overflow-y-auto p-4">
      {mentions.map((s) => (
        <a
          key={s.symbol}
          href={`/stock/${s.symbol}`}
          className="flex items-center gap-2 rounded-md border border-hairline bg-surface-2/60 px-3 py-2 t-body transition-colors duration-fast ease-out hover:border-brand/40 hover:bg-brand/10"
        >
          <span className="font-mono text-xs text-brand">{s.symbol}</span>
          <span className="truncate t-muted">{s.name}</span>
        </a>
      ))}
    </div>
  );
}

function RefineTab({
  onSend,
  contextSymbol,
}: {
  onSend: (prompt: string) => void;
  contextSymbol?: string;
}) {
  const panelCtx = usePanelContext();
  const hints = useMemo(
    () => refineHintsFor(panelCtx.pathname, panelCtx.screenerParams, contextSymbol),
    [panelCtx.pathname, panelCtx.screenerParams, contextSymbol],
  );

  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-4">
      <div className="t-label">Refine this view</div>
      <div className="flex flex-wrap gap-2">
        {hints.map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => onSend(h)}
            className="chip chip--muted transition-colors duration-fast ease-out hover:border-brand/40 hover:bg-brand/10 hover:text-fg"
          >
            {h}
          </button>
        ))}
      </div>
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
        <div className="flex justify-start">
          <div className="max-w-[92%] rounded-lg bg-surface-2/60 border border-hairline px-4 py-3 t-body">
            {turn.content ? (
              <Markdown text={turn.content} />
            ) : (
              <span className="t-muted">Preparing answer…</span>
            )}
            {!turn.done && turn.content && (
              <span className="ml-1 animate-pulse t-muted">▍</span>
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
          className="rounded-md border border-warning/30 bg-warning/10 px-3 py-3 t-caption"
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
          {p.status === "confirming" && <div className="text-[11px] t-muted">Setting alert…</div>}
          {p.status === "confirmed" && <div className="text-[11px] text-accent">✓ Alert set</div>}
          {p.status === "declined" && <div className="text-[11px] t-muted">Declined</div>}
          {p.status === "failed" && (
            <div className="text-[11px] text-danger">Failed: {p.error ?? "unknown error"}</div>
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
    <div className="rounded-md border border-hairline bg-surface-2/60">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left t-caption transition-colors duration-fast ease-out hover:bg-brand/5"
      >
        <span className="flex h-2 w-2 items-center justify-center">
          {runningTool ? (
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
          ) : (
            <span className="h-2 w-2 rounded-full bg-accent" />
          )}
        </span>
        <span className="flex-1 truncate">
          {header || "Working…"}
          {runningTool && (
            <span className="ml-1 t-muted">· {toolLabel(runningTool)}</span>
          )}
        </span>
        {totalCount > 0 && (
          <span className="rounded-full bg-surface-1 px-2 py-0.5 font-mono text-[10px] t-muted">
            {doneCount}/{totalCount}
          </span>
        )}
        <span aria-hidden className="t-muted">{expanded ? "▾" : "▸"}</span>
      </button>
      {expanded && tools.length > 0 && (
        <ul className="space-y-1 border-t border-hairline px-3 py-2">
          {tools.map((t, i) => (
            <li key={i} className="flex items-start gap-2 text-[11px]">
              <span className="mt-[3px] flex h-3 w-3 shrink-0 items-center justify-center">
                {t.status === "running" ? (
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
                ) : (
                  <span className="text-accent">✓</span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div>{toolLabel(t.name)}</div>
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

function NewsTab({ items, contextSymbol }: { items: RelatedNewsInput[]; contextSymbol?: string }) {
  if (items.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4 t-body t-muted">
        {contextSymbol
          ? `No related headlines yet for ${contextSymbol}. Fresh news is crawled every few minutes.`
          : "Related news will show here for stock pages."}
      </div>
    );
  }
  return (
    <div className="flex-1 space-y-2 overflow-y-auto p-3">
      {items.map((n) => {
        const link = smartReaderHref(n.url, { publisherDomain: n.publisherDomain, title: n.title });
        return (
          <a
            key={n.url}
            href={link.href}
            {...externalLinkProps(link)}
            className="group block rounded-md border border-hairline bg-surface-2/60 p-3 transition-colors duration-fast ease-out hover:border-brand/40 hover:bg-brand/10"
          >
            <div className="mb-1 flex items-center gap-1.5">
              <SourceBadge
                source="web"
                label={n.publisher}
                iconUrl={n.publisherIcon}
              />
              <FreshnessStamp ts={n.publishedAt} />
            </div>
            <div className="line-clamp-2 text-[13px] font-medium leading-snug">
              {n.title}
            </div>
            {n.description && (
              <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed t-muted">
                {n.description}
              </div>
            )}
          </a>
        );
      })}
    </div>
  );
}

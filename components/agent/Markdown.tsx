"use client";

import { memo, type ReactNode } from "react";

// Streaming-safe minimal markdown renderer. Handles the subset the research
// agent's prompt template produces: paragraphs, bullets, **bold**, *italic*,
// inline `code`, [text](url), and blank-line separators. Partial input during
// streaming renders gracefully — an unclosed **bold** just leaves the raw
// asterisks visible until the closing pair arrives.

type Inline = ReactNode;

function renderInline(text: string, keyBase: string): Inline[] {
  const nodes: Inline[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*\n]+)\*|`([^`\n]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const key = `${keyBase}-${i++}`;
    if (m[1]) nodes.push(<strong key={key} className="font-semibold text-fg">{m[1]}</strong>);
    else if (m[2]) nodes.push(<em key={key} className="italic text-fg/80">{m[2]}</em>);
    else if (m[3]) nodes.push(<code key={key} className="rounded bg-brand/10 px-1 py-[1px] font-mono text-[11px] text-brand">{m[3]}</code>);
    else if (m[4] && m[5]) {
      nodes.push(
        <a
          key={key}
          href={m[5]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand underline decoration-dotted underline-offset-2 hover:opacity-80"
        >
          {m[4]}
        </a>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export const Markdown = memo(function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let bulletBuf: string[] = [];
  let paraBuf: string[] = [];

  function flushBullets(key: string) {
    if (!bulletBuf.length) return;
    blocks.push(
      <ul key={`ul-${key}`} className="ml-5 list-disc space-y-1 text-fg/90 marker:text-brand/60">
        {bulletBuf.map((b, i) => (
          <li key={i} className="pl-1">{renderInline(b, `${key}-b${i}`)}</li>
        ))}
      </ul>,
    );
    bulletBuf = [];
  }

  function flushPara(key: string) {
    if (!paraBuf.length) return;
    const joined = paraBuf.join(" ");
    blocks.push(
      <p key={`p-${key}`} className="text-fg/90 leading-relaxed">
        {renderInline(joined, `${key}-p`)}
      </p>,
    );
    paraBuf = [];
  }

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trimEnd();
    const key = String(idx);

    if (!line.trim()) {
      flushBullets(key);
      flushPara(key);
      return;
    }

    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flushBullets(key);
      flushPara(key);
      const level = h[1].length;
      const content = h[2];
      const cls =
        level === 1
          ? "text-base font-semibold text-fg"
          : level === 2
            ? "text-sm font-semibold text-fg"
            : "text-[11px] font-semibold uppercase tracking-wider text-brand mt-1";
      blocks.push(
        <div key={`h-${key}`} className={cls}>
          {renderInline(content, `${key}-h`)}
        </div>,
      );
      return;
    }

    const b = /^\s*[-*]\s+(.*)$/.exec(line);
    if (b) {
      flushPara(key);
      bulletBuf.push(b[1]);
      return;
    }

    // Non-bullet, non-heading — paragraph line. If it's a short bold-only
    // "**Section**" style header line, treat as small header.
    const headerish = /^\*\*([^*]+)\*\*$/.exec(line.trim());
    if (headerish) {
      flushBullets(key);
      flushPara(key);
      blocks.push(
        <div key={`sh-${key}`} className="text-[11px] font-semibold uppercase tracking-wider text-brand mt-1">
          {headerish[1]}
        </div>,
      );
      return;
    }

    paraBuf.push(line);
  });

  flushBullets("end");
  flushPara("end");

  return <div className="space-y-2.5">{blocks}</div>;
});

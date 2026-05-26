import { cn } from "@/lib/utils";

export function Disclaimer({ variant = "default", className }: { variant?: "default" | "bold"; className?: string }) {
  if (variant === "bold") {
    return (
      <div className={cn("rounded-md border border-danger/40 bg-danger/10 p-4 text-xs leading-relaxed text-fg/90", className)}>
        <p className="font-semibold text-danger">⚠ Algorithmic signals — not investment advice</p>
        <p className="mt-2">
          Scores, signals and "Why Care Today" are produced by automated rules from public market data.
          They are NOT recommendations to buy, sell, or hold any security. Past performance does not
          guarantee future results. Consult a SEBI-registered investment adviser before acting.
        </p>
      </div>
    );
  }
  return (
    <p className={cn("text-xs text-muted", className)}>
      For informational purposes only. Not investment advice.
      Market data may be delayed up to 15 minutes when sourced from Yahoo Finance.
    </p>
  );
}

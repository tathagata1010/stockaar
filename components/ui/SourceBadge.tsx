import { cn } from "@/lib/utils";

export type Source =
  | "bse"
  | "nse"
  | "yahoo"
  | "google"
  | "bing"
  | "moneycontrol"
  | "reddit"
  | "web"
  | "ai"
  | "filing"
  | "guidance";

const TONES: Record<Source, string> = {
  bse: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200",
  nse: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-200",
  yahoo: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-200",
  google: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-200",
  bing: "border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200",
  moneycontrol: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-200",
  reddit: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-200",
  web: "border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-200",
  ai: "border-brand/40 bg-brand/10 text-brand",
  filing: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  guidance: "border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-200",
};

const LABELS: Record<Source, string> = {
  bse: "BSE",
  nse: "NSE",
  yahoo: "Yahoo",
  google: "Google",
  bing: "Bing",
  moneycontrol: "Moneycontrol",
  reddit: "Reddit",
  web: "Web",
  ai: "AI",
  filing: "Filing",
  guidance: "Guidance",
};

export function SourceBadge({
  source,
  label,
  iconUrl,
  className,
}: {
  source: Source;
  label?: string;
  iconUrl?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
        TONES[source],
        className,
      )}
    >
      {iconUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={iconUrl}
          alt=""
          aria-hidden
          width={12}
          height={12}
          className="h-3 w-3 rounded-sm object-cover"
          loading="lazy"
        />
      )}
      {label ?? LABELS[source]}
    </span>
  );
}

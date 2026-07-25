import type { Quote } from "@/lib/upstox";
import type { Fundamentals } from "@/lib/fundamentals";
import { getStockStory } from "@/lib/stock-story";
import { Sparkles, Eye } from "lucide-react";
import { ExpandableText } from "@/components/ui/ExpandableText";

export async function WhyCareToday({
  symbol,
  exchange,
  quote,
  fundamentals,
}: {
  symbol: string;
  exchange: "NSE" | "BSE";
  quote: Quote;
  fundamentals: Fundamentals | null;
}) {
  const story = await getStockStory(symbol, exchange, quote, fundamentals);
  if (!story) return null;

  return (
    <section className="surface relative overflow-hidden p-5">
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand via-brand-2 to-accent" />
      <div className="flex items-center gap-2 t-label">
        <Sparkles className="h-3 w-3 text-brand" />
        <span>{story.source === "llm" ? "Today's read" : "Snapshot"}</span>
      </div>
      <h3 className="mt-2 text-base font-semibold leading-snug sm:text-lg">{story.headline}</h3>
      <ExpandableText lines={4} className="mt-3 text-sm leading-relaxed text-fg/85">
        {story.story}
      </ExpandableText>

      {story.beats.length > 0 && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {story.beats.map((b, i) => (
            <li
              key={i}
              className="flex items-start gap-2 rounded-md border border-hairline bg-bg/40 px-3 py-2 text-xs text-fg/90"
            >
              <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              <span className="leading-snug">{b}</span>
            </li>
          ))}
        </ul>
      )}

      {story.outlook && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-accent/30 bg-accent/5 px-3 py-2.5">
          <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
          <p className="text-xs leading-relaxed text-fg/90">
            <span className="font-semibold text-accent">Watch next · </span>
            {story.outlook}
          </p>
        </div>
      )}
    </section>
  );
}

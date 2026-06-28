import type { NewsItem } from "../news";
import type { Triggers, TriggerKind } from "./schema";
import type { MaterialityScore } from "./materiality";

const NEWS_MATERIALITY_THRESHOLD = 7;

export type EvalSnapshot = {
  price: number;
  changePct: number;
  volume?: number;
  avg20dVolume?: number;
};

export type EvalFired = {
  kind: TriggerKind;
  // for non-news kinds we have inline data; for news we attach the item
  news?: NewsItem;
  materiality?: number;
};

/**
 * Pure: given the user's triggers + a current snapshot + (optional) fresh news +
 * (optional) materiality scores, returns which triggers fired and any matched news.
 *
 * News headlines are evaluated separately — each material headline produces one
 * fired entry of kind 'news'. The caller decides email cadence/dedup downstream.
 */
export function evaluate(
  triggers: Triggers,
  snapshot: EvalSnapshot,
  freshNews: NewsItem[] = [],
  materialityByUrl: Map<string, MaterialityScore> = new Map(),
): EvalFired[] {
  const fired: EvalFired[] = [];

  if (triggers.price) {
    const { condition, target } = triggers.price;
    const hit = condition === "above" ? snapshot.price >= target : snapshot.price <= target;
    if (hit) fired.push({ kind: "price" });
  }

  if (triggers.move) {
    if (Math.abs(snapshot.changePct) >= triggers.move.pctAbs) {
      fired.push({ kind: "move" });
    }
  }

  if (
    triggers.volume &&
    typeof snapshot.volume === "number" &&
    typeof snapshot.avg20dVolume === "number" &&
    snapshot.avg20dVolume > 0
  ) {
    const mult = snapshot.volume / snapshot.avg20dVolume;
    if (mult >= triggers.volume.multiple) fired.push({ kind: "volume" });
  }

  if (triggers.news && freshNews.length > 0) {
    for (const item of freshNews) {
      const score = materialityByUrl.get(item.url);
      if (score && score.score >= NEWS_MATERIALITY_THRESHOLD) {
        fired.push({ kind: "news", news: item, materiality: score.score });
      }
    }
  }

  return fired;
}

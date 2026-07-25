// Human-readable labels for every tool the research agent exposes.
// Keys are the tool names emitted by preflight/graph; unknown tools fall
// through to the raw name so we don't hide new tools when they land.

export const TOOL_LABELS: Record<string, string> = {
  get_quote: "Live quote",
  get_quotes_batch: "Bulk quotes",
  get_fundamentals: "Fundamentals",
  get_scorecard: "Scorecard",
  get_news: "Material news",
  get_news_pulse: "News + guidance pulse",
  compare_community_sentiment: "Retail chatter",
  get_inst_flows: "FII/DII flows",
  get_guidance: "Management guidance",
  get_peers: "Sector peers",
  search_symbols: "Symbol search",
  get_history_stats: "Price history",
  get_technicals: "Technicals",
  get_ai_brief: "AI brief",
  get_reddit_buzz: "Reddit buzz",
  get_corporate_actions: "Dividends & splits",
  get_shareholding: "Shareholding",
  web_search: "Web search",
  read_url: "Reading page",
  add_to_watchlist: "Add to watchlist",
  propose_alert: "Propose alert",
};

export function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name;
}

-- ── Price Alerts ──────────────────────────────────────────────────────────
create table if not exists public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  entry numeric,
  tp numeric,
  sl numeric,
  note text,
  active boolean not null default true,
  triggered_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.price_alerts enable row level security;

drop policy if exists "price_alerts readable" on public.price_alerts;
drop policy if exists "price_alerts writable" on public.price_alerts;

create policy "price_alerts readable"
  on public.price_alerts for select to anon, authenticated using (true);

create policy "price_alerts writable"
  on public.price_alerts for all to anon, authenticated using (true) with check (true);

-- ── Watchlist ─────────────────────────────────────────────────────────────
create table if not exists public.watchlist (
  id uuid primary key default gen_random_uuid(),
  symbol text not null unique,
  exchange text not null default 'yfinance',
  timeframe text not null default '1d',
  added_at timestamptz not null default now()
);

alter table public.watchlist enable row level security;

drop policy if exists "watchlist readable" on public.watchlist;
drop policy if exists "watchlist writable" on public.watchlist;

create policy "watchlist readable"
  on public.watchlist for select to anon, authenticated using (true);

create policy "watchlist writable"
  on public.watchlist for all to anon, authenticated using (true) with check (true);

-- ── Daily AI summaries ────────────────────────────────────────────────────
create table if not exists public.daily_summaries (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  summary text not null,
  signals_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.daily_summaries enable row level security;

drop policy if exists "daily_summaries are publicly readable" on public.daily_summaries;

create policy "daily_summaries are publicly readable"
  on public.daily_summaries
  for select
  to anon, authenticated
  using (true);

-- ── Signals ───────────────────────────────────────────────────────────────
create table if not exists public.signals (
  id uuid primary key,
  symbol text not null,
  exchange text not null,
  timeframe text not null,
  close numeric not null,
  trend text not null check (trend in ('bullish', 'bearish', 'sideways')),
  action text not null check (action in ('watch', 'long_setup', 'short_setup', 'no_trade')),
  confidence numeric not null,
  summary text not null,
  tp numeric,
  sl numeric,
  changed boolean not null default false,
  trend_changed boolean not null default false,
  indicators jsonb not null default '{}'::jsonb,
  reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.signals add column if not exists previous_action text;
alter table public.signals add column if not exists previous_trend text;
alter table public.signals add column if not exists ai_enhanced boolean not null default false;

-- Upsert key: one row per symbol+timeframe (scanner updates in place)
create unique index if not exists signals_symbol_timeframe_unique
  on public.signals (symbol, timeframe);

create index if not exists signals_symbol_time_created_idx
  on public.signals (symbol, timeframe, created_at desc);

alter table public.signals enable row level security;

drop policy if exists "signals are publicly readable" on public.signals;

create policy "signals are publicly readable"
  on public.signals
  for select
  to anon, authenticated
  using (true);

-- Market relevance scores (populated by discovery cron)
create table if not exists public.market_scores (
  symbol        text not null,
  asset_class   text not null,
  score         float not null default 0,
  trend         text,
  adx           float,
  rsi           float,
  volume_ratio  float,
  trend_strength float,
  volatility    float,
  session_active bool default false,
  scanned_at    timestamptz not null default now(),
  primary key (symbol)
);

create index if not exists market_scores_score_idx on public.market_scores (score desc);
create index if not exists market_scores_asset_class_idx on public.market_scores (asset_class);

-- Analysis cache (on-demand AI analysis results)
create table if not exists public.analysis_cache (
  id            uuid primary key default gen_random_uuid(),
  symbol        text not null,
  timeframe     text not null,
  date          date not null,
  signal        jsonb not null,
  created_at    timestamptz not null default now(),
  unique (symbol, timeframe, date)
);

create index if not exists analysis_cache_lookup_idx
  on public.analysis_cache (symbol, timeframe, date);

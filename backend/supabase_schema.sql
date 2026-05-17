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
  indicators jsonb not null default '{}'::jsonb,
  reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

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

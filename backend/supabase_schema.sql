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

create index if not exists signals_symbol_time_created_idx
  on public.signals (symbol, timeframe, created_at desc);

alter table public.signals enable row level security;

drop policy if exists "signals are publicly readable" on public.signals;

create policy "signals are publicly readable"
  on public.signals
  for select
  to anon, authenticated
  using (true);

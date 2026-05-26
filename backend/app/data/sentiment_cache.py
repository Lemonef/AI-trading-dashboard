"""Supabase-backed sentiment cache — persists across GitHub Actions runs."""
from datetime import datetime, timezone, timedelta

from app.config import Settings

_STALE_HOURS = 25  # daily refresh every 24h, 25h gives buffer


class SentimentStore:
    def __init__(self, settings: Settings):
        self._settings = settings

    def _client(self):
        from supabase import create_client
        return create_client(self._settings.supabase_url, self._settings.supabase_service_role_key)

    def get_batch(self, symbols: list[str]) -> dict[str, dict]:
        """Return cached sentiment for symbols fetched within the last 25h."""
        if not self._settings.supabase_url or not symbols:
            return {}
        try:
            cutoff = (datetime.now(timezone.utc) - timedelta(hours=_STALE_HOURS)).isoformat()
            res = (
                self._client()
                .table("sentiment_cache")
                .select("symbol,galaxy_score,alt_rank,sentiment,social_volume")
                .in_("symbol", symbols)
                .gte("fetched_at", cutoff)
                .execute()
            )
            return {
                row["symbol"]: {
                    "galaxy_score": row.get("galaxy_score"),
                    "alt_rank": row.get("alt_rank"),
                    "sentiment": row.get("sentiment"),
                    "social_volume": row.get("social_volume"),
                }
                for row in (res.data or [])
            }
        except Exception as exc:
            print(f"  [SentimentStore.get] {exc}")
            return {}

    def set_batch(self, data_map: dict[str, dict]) -> None:
        """Upsert fresh sentiment data for multiple symbols."""
        if not self._settings.supabase_url or not data_map:
            return
        try:
            now = datetime.now(timezone.utc).isoformat()
            rows = [
                {
                    "symbol": symbol,
                    "galaxy_score": data.get("galaxy_score"),
                    "alt_rank": data.get("alt_rank"),
                    "sentiment": data.get("sentiment"),
                    "social_volume": data.get("social_volume"),
                    "fetched_at": now,
                }
                for symbol, data in data_map.items()
                if data
            ]
            if rows:
                self._client().table("sentiment_cache").upsert(rows, on_conflict="symbol").execute()
        except Exception as exc:
            print(f"  [SentimentStore.set] {exc}")

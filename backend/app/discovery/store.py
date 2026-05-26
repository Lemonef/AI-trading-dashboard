import httpx

from app.config import Settings


class MarketScoreStore:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.enabled = bool(settings.supabase_url and settings.supabase_service_role_key)

    def save_scores(self, rows: list[dict]) -> None:
        if not self.enabled or not rows:
            return
        response = httpx.post(
            f"{self.settings.supabase_url}/rest/v1/market_scores?on_conflict=symbol",
            headers={**self._headers(), "Prefer": "resolution=merge-duplicates,return=minimal"},
            json=rows,
            timeout=30,
        )
        response.raise_for_status()

    def list_scores(self, limit: int = 100) -> list[dict]:
        if not self.enabled:
            return []
        response = httpx.get(
            f"{self.settings.supabase_url}/rest/v1/market_scores",
            headers=self._headers(),
            params={"select": "*", "order": "score.desc", "limit": str(limit)},
            timeout=20,
        )
        response.raise_for_status()
        return response.json()

    def _headers(self) -> dict[str, str]:
        key = self.settings.supabase_service_role_key or ""
        return {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }

from datetime import datetime
from zoneinfo import ZoneInfo

import httpx

from app.config import Settings
from app.models import Signal

BANGKOK = ZoneInfo("Asia/Bangkok")


def _today_bangkok() -> str:
    return datetime.now(BANGKOK).strftime("%Y-%m-%d")


class AnalysisCache:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.enabled = bool(settings.supabase_url and settings.supabase_service_role_key)

    def get(self, symbol: str, timeframe: str) -> Signal | None:
        if not self.enabled:
            return None
        response = httpx.get(
            f"{self.settings.supabase_url}/rest/v1/analysis_cache",
            headers=self._headers(),
            params={
                "select": "signal",
                "symbol": f"eq.{symbol}",
                "timeframe": f"eq.{timeframe}",
                "date": f"eq.{_today_bangkok()}",
                "limit": "1",
            },
            timeout=10,
        )
        response.raise_for_status()
        rows = response.json()
        if not rows:
            return None
        return Signal.model_validate(rows[0]["signal"])

    def set(self, signal: Signal) -> None:
        if not self.enabled:
            return
        payload = {
            "symbol": signal.symbol,
            "timeframe": signal.timeframe,
            "date": _today_bangkok(),
            "signal": signal.model_dump(mode="json"),
        }
        httpx.post(
            f"{self.settings.supabase_url}/rest/v1/analysis_cache"
            f"?on_conflict=symbol,timeframe,date",
            headers={**self._headers(), "Prefer": "resolution=merge-duplicates,return=minimal"},
            json=payload,
            timeout=15,
        ).raise_for_status()

    def _headers(self) -> dict[str, str]:
        key = self.settings.supabase_service_role_key or ""
        return {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }

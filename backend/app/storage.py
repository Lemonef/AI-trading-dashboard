import json
from pathlib import Path

import httpx

from app.config import Settings
from app.models import Signal


class SignalTableMissing(RuntimeError):
    pass


class SignalStore:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.local_file = Path(settings.data_dir) / "signals.json"
        self.local_file.parent.mkdir(parents=True, exist_ok=True)
        self.supabase_enabled = bool(settings.supabase_url and settings.supabase_service_role_key)

    def list_signals(self, limit: int = 50) -> list[Signal]:
        if self.supabase_enabled:
            response = httpx.get(
                f"{self.settings.supabase_url}/rest/v1/signals",
                headers=self._headers(),
                params={
                    "select": "*",
                    "order": "created_at.desc",
                    "limit": str(limit),
                },
                timeout=20,
            )
            if response.status_code == 404:
                raise SignalTableMissing("Supabase table public.signals was not found. Run backend/supabase_schema.sql in the Supabase SQL editor.")
            response.raise_for_status()
            return [Signal.model_validate(item) for item in response.json()]

        if not self.local_file.exists():
            return []
        raw = json.loads(self.local_file.read_text(encoding="utf-8"))
        return [Signal.model_validate(item) for item in raw[:limit]]

    def latest_action(self, symbol: str, timeframe: str) -> str | None:
        for signal in self.list_signals(limit=200):
            if signal.symbol == symbol and signal.timeframe == timeframe:
                return signal.action
        return None

    def save_signal(self, signal: Signal) -> Signal:
        payload = signal.model_dump(mode="json")
        if self.supabase_enabled:
            response = httpx.post(
                f"{self.settings.supabase_url}/rest/v1/signals",
                headers={**self._headers(), "Prefer": "return=minimal"},
                json=payload,
                timeout=20,
            )
            if response.status_code == 404:
                raise SignalTableMissing("Supabase table public.signals was not found. Run backend/supabase_schema.sql in the Supabase SQL editor.")
            response.raise_for_status()
            return signal

        existing = []
        if self.local_file.exists():
            existing = json.loads(self.local_file.read_text(encoding="utf-8"))
        self.local_file.write_text(json.dumps([payload, *existing][:500], indent=2), encoding="utf-8")
        return signal

    def update_signal_summary(self, signal_id: str, summary: str, ai_enhanced: bool) -> None:
        if not self.supabase_enabled:
            print(f"    [skip] supabase not enabled")
            return
        url = f"{self.settings.supabase_url}/rest/v1/signals?id=eq.{signal_id}"
        response = httpx.patch(
            url,
            headers={**self._headers(), "Prefer": "return=minimal"},
            json={"summary": summary, "ai_enhanced": ai_enhanced},
            timeout=20,
        )
        print(f"    PATCH id={signal_id[:8]}… → {response.status_code}")
        if not response.is_success:
            print(f"    ERROR: {response.text}")
        response.raise_for_status()

    def save_daily_summary(self, date_str: str, summary: str, signals_count: int) -> None:
        payload = {"date": date_str, "summary": summary, "signals_count": signals_count}
        if self.supabase_enabled:
            response = httpx.post(
                f"{self.settings.supabase_url}/rest/v1/daily_summaries",
                headers={**self._headers(), "Prefer": "resolution=merge-duplicates,return=minimal"},
                json=payload,
                timeout=20,
            )
            response.raise_for_status()
            return
        summary_file = Path(self.settings.data_dir) / "daily_summaries.json"
        existing = []
        if summary_file.exists():
            existing = json.loads(summary_file.read_text(encoding="utf-8"))
        existing = [e for e in existing if e.get("date") != date_str]
        summary_file.write_text(
            json.dumps([payload, *existing][:365], indent=2), encoding="utf-8"
        )

    def _headers(self) -> dict[str, str]:
        key = self.settings.supabase_service_role_key or ""
        return {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }

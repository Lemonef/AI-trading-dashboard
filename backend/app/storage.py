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

    def latest_trend(self, symbol: str, timeframe: str) -> str | None:
        for signal in self.list_signals(limit=200):
            if signal.symbol == symbol and signal.timeframe == timeframe:
                return signal.trend
        return None

    def list_watchlist(self) -> set[str]:
        """All symbols across all users (for scanner)."""
        if not self.supabase_enabled:
            return set()
        try:
            response = httpx.get(
                f"{self.settings.supabase_url}/rest/v1/watchlist",
                headers=self._headers(),
                params={"select": "symbol"},
                timeout=20,
            )
            if not response.is_success:
                return set()
            return {row["symbol"] for row in response.json()}
        except Exception:
            return set()

    def list_watchlist_by_user(self) -> list[dict]:
        """Returns [{session_id, telegram_chat_id, symbols: [...]}] for per-user alerts."""
        if not self.supabase_enabled:
            return []
        try:
            wl_res = httpx.get(
                f"{self.settings.supabase_url}/rest/v1/watchlist",
                headers=self._headers(),
                params={"select": "symbol,session_id"},
                timeout=20,
            )
            if not wl_res.is_success:
                return []
            rows = wl_res.json()
            # Group by session_id
            groups: dict[str, list[str]] = {}
            no_session: list[str] = []
            for r in rows:
                sid = r.get("session_id")
                if sid:
                    groups.setdefault(sid, []).append(r["symbol"])
                else:
                    no_session.append(r["symbol"])

            # Fetch session info for each session_id
            result = []
            if groups:
                session_ids = list(groups.keys())
                sess_res = httpx.get(
                    f"{self.settings.supabase_url}/rest/v1/user_sessions",
                    headers=self._headers(),
                    params={"select": "id,telegram_chat_id,name", "id": f"in.({','.join(session_ids)})"},
                    timeout=20,
                )
                sessions = {s["id"]: s for s in (sess_res.json() if sess_res.is_success else [])}
                for sid, symbols in groups.items():
                    sess = sessions.get(sid, {})
                    result.append({
                        "session_id": sid,
                        "telegram_chat_id": sess.get("telegram_chat_id"),
                        "name": sess.get("name", "User"),
                        "symbols": symbols,
                    })
            # Legacy entries without session_id use the global TELEGRAM_CHAT_ID
            if no_session:
                result.append({
                    "session_id": None,
                    "telegram_chat_id": self.settings.telegram_chat_id,
                    "name": "Global",
                    "symbols": no_session,
                })
            return result
        except Exception:
            return []

    def save_signal(self, signal: Signal) -> Signal:
        payload = signal.model_dump(mode="json")
        # Never overwrite ai_enhanced on upsert — managed by the summarize pipeline
        payload.pop("ai_enhanced", None)
        if self.supabase_enabled:
            # Try upsert (requires unique constraint on symbol+timeframe)
            response = httpx.post(
                f"{self.settings.supabase_url}/rest/v1/signals?on_conflict=symbol,timeframe",
                headers={**self._headers(), "Prefer": "resolution=merge-duplicates,return=minimal"},
                json=payload,
                timeout=20,
            )
            if response.status_code == 409:
                # Constraint not yet created — fall back to plain insert
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

    def list_price_alerts(self, active_only: bool = True) -> list[dict]:
        if not self.supabase_enabled:
            return []
        try:
            params = {"select": "*", "order": "created_at.desc"}
            if active_only:
                params["active"] = "eq.true"
            response = httpx.get(
                f"{self.settings.supabase_url}/rest/v1/price_alerts",
                headers=self._headers(),
                params=params,
                timeout=20,
            )
            if not response.is_success:
                return []
            return response.json()
        except Exception:
            return []

    def trigger_price_alert(self, alert_id: str) -> None:
        if not self.supabase_enabled:
            return
        from datetime import datetime, timezone
        httpx.patch(
            f"{self.settings.supabase_url}/rest/v1/price_alerts?id=eq.{alert_id}",
            headers={**self._headers(), "Prefer": "return=minimal"},
            json={"active": False, "triggered_at": datetime.now(timezone.utc).isoformat()},
            timeout=20,
        )

    def save_daily_summary(self, date_str: str, summary: str, signals_count: int) -> None:
        from datetime import datetime, timezone
        payload = {
            "date": date_str,
            "summary": summary,
            "signals_count": signals_count,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if self.supabase_enabled:
            response = httpx.post(
                f"{self.settings.supabase_url}/rest/v1/daily_summaries?on_conflict=date",
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

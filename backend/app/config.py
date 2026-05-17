from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env", "../../.env"), extra="ignore")

    watchlist: str = (
        # Crypto
        "BTC/USDT,ETH/USDT,SOL/USDT,BNB/USDT,XRP/USDT,DOGE/USDT,AVAX/USDT,LINK/USDT,"
        # US Mega-cap Tech
        "AAPL,MSFT,NVDA,TSLA,META,GOOGL,AMZN,AMD,AVGO,QCOM,MU,ARM,PLTR,COIN,SMCI,"
        # Broad ETFs
        "SPY,QQQ,IWM,DIA,"
        # Sector ETFs
        "XLE,XLK,XLF,XLV,XLI,XLB,XLU,XLP,XLY,"
        # Thematic & International ETFs
        "GLD,SLV,USO,ARKK,EWY,EWT,EEM,VGK,"
        # Precious Metals Futures
        "GC=F,SI=F,HG=F,PL=F,PA=F,"
        # Energy Futures
        "CL=F,BZ=F,NG=F,"
        # Agricultural Futures
        "ZW=F,ZC=F,ZS=F,KC=F,"
        # Major Forex
        "EURUSD=X,GBPUSD=X,USDJPY=X,AUDUSD=X,USDCAD=X,USDCHF=X,NZDUSD=X,"
        # Asian Forex
        "USDSGD=X,USDINR=X,USDTHB=X"
    )
    exchange_id: str = "binance"
    fallback_exchange_ids: str = "coinbase,kraken"
    timeframe: str = "1d"
    ohlcv_limit: int = 260
    allow_demo_data: bool = True

    supabase_url: str | None = None
    supabase_service_role_key: str | None = None

    telegram_bot_token: str | None = None
    telegram_chat_id: str | None = None

    gemini_api_key: str | None = None
    groq_api_key: str | None = None
    anthropic_api_key: str | None = None
    claude_daily_model: str = "claude-3-5-sonnet-latest"
    investor_dna: str = "Patient Investor (primary) + Speed Racer (secondary)"
    skills_dir: Path = Field(default=Path(__file__).resolve().parents[2] / "skills")

    data_dir: Path = Field(default=Path(__file__).resolve().parents[1] / "data")

    @property
    def symbols(self) -> list[str]:
        return [symbol.strip() for symbol in self.watchlist.split(",") if symbol.strip()]

    @property
    def exchanges(self) -> list[str]:
        values = [self.exchange_id, *self.fallback_exchange_ids.split(",")]
        deduped: list[str] = []
        for value in values:
            exchange = value.strip()
            if exchange and exchange not in deduped:
                deduped.append(exchange)
        return deduped


@lru_cache
def get_settings() -> Settings:
    return Settings()

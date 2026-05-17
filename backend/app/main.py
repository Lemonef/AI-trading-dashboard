from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.models import ScanResult, Signal
from app.scanner import run_scan
from app.storage import SignalStore

app = FastAPI(title="AI Trading Scanner", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/signals", response_model=list[Signal])
def list_signals() -> list[Signal]:
    return SignalStore(get_settings()).list_signals()


@app.post("/api/scan", response_model=ScanResult)
async def scan_now() -> ScanResult:
    return await run_scan(get_settings())

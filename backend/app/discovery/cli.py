import asyncio
from app.config import get_settings
from app.discovery.service import run_discovery


if __name__ == "__main__":
    result = asyncio.run(run_discovery(get_settings()))
    print(result)

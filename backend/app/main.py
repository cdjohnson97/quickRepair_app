from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.api.router import api_router
from app.config import get_settings
from app.core.realtime import RedisEventBus, RepairRealtimeHub

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    hub = RepairRealtimeHub()
    event_bus = RedisEventBus(
        redis_url=settings.redis_url,
        channel=settings.realtime_channel,
        dispatch=hub.broadcast,
    )
    await event_bus.start()
    app.state.repair_hub = hub
    app.state.event_bus = event_bus
    yield
    await event_bus.stop()


app = FastAPI(title="QuickRepair API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/", include_in_schema=False)
async def root() -> RedirectResponse:
    """Send browser visitors to the API documentation."""
    return RedirectResponse(url="/docs")

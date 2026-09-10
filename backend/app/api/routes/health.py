from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/health")
async def health(request: Request) -> dict[str, str]:
    """Liveness endpoint for Docker and deployment platforms."""
    try:
        await request.app.state.event_bus.ping()
    except Exception:
        return {"status": "degraded", "redis": "unavailable"}
    return {"status": "ok", "redis": "connected"}

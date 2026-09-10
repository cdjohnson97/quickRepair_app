import asyncio
import json
from collections import defaultdict
from collections.abc import Awaitable, Callable

from fastapi import WebSocket
from redis.asyncio import Redis


class RepairRealtimeHub:
    """Routes an event only to clients subscribed to its repair."""

    def __init__(self) -> None:
        self._connections: dict[int, set[WebSocket]] = defaultdict(set)

    async def connect(self, repair_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[repair_id].add(websocket)

    def disconnect(self, repair_id: int, websocket: WebSocket) -> None:
        self._connections[repair_id].discard(websocket)
        if not self._connections[repair_id]:
            self._connections.pop(repair_id, None)

    async def broadcast(self, event: dict) -> None:
        repair_id = event.get("repair_id")
        if not isinstance(repair_id, int):
            return

        stale_connections: list[WebSocket] = []
        for websocket in self._connections.get(repair_id, set()).copy():
            try:
                await websocket.send_json(event)
            except RuntimeError:
                stale_connections.append(websocket)

        for websocket in stale_connections:
            self.disconnect(repair_id, websocket)


class RedisEventBus:
    """Publishes repair events to every API instance using Redis pub/sub."""

    def __init__(
        self,
        redis_url: str,
        channel: str,
        dispatch: Callable[[dict], Awaitable[None]],
    ) -> None:
        self._redis = Redis.from_url(redis_url, decode_responses=True)
        self._channel = channel
        self._dispatch = dispatch
        self._listener: asyncio.Task[None] | None = None

    async def start(self) -> None:
        await self._redis.ping()
        self._listener = asyncio.create_task(self._listen())

    async def stop(self) -> None:
        if self._listener:
            self._listener.cancel()
            try:
                await self._listener
            except asyncio.CancelledError:
                pass
        await self._redis.aclose()

    async def ping(self) -> bool:
        return bool(await self._redis.ping())

    async def publish(self, event: dict) -> None:
        await self._redis.publish(self._channel, json.dumps(event))

    async def _listen(self) -> None:
        pubsub = self._redis.pubsub()
        await pubsub.subscribe(self._channel)
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    await self._dispatch(json.loads(message["data"]))
        finally:
            await pubsub.unsubscribe(self._channel)
            await pubsub.aclose()

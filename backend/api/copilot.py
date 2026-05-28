from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.api.middleware import require_auth
from backend.api.middleware import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/copilot", dependencies=[Depends(require_auth)])

# Will be injected by app.main.py
_copilot_engine: Any = None


def set_copilot_engine(engine: Any) -> None:
    global _copilot_engine
    _copilot_engine = engine


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)


class ConfirmRequest(BaseModel):
    confirmation_id: str


class MessageResponse(BaseModel):
    reply: str
    finish_reason: str | None = None


@router.post("/chat")
async def chat(req: ChatRequest, user: dict = Depends(get_current_user)) -> dict:
    if not _copilot_engine:
        raise HTTPException(status_code=503, detail="Copilot not initialized")
    user_id = user.get("sub", "default")
    result = await _copilot_engine.chat(req.message, user_id=user_id)
    if "error" in result:
        if result["error"] == "rate_limited":
            raise HTTPException(status_code=429, detail=result.get("message", "Rate limited"))
        raise HTTPException(status_code=502, detail=result.get("message", "Copilot error"))
    return result


@router.post("/confirm")
async def confirm(req: ConfirmRequest, user: dict = Depends(get_current_user)) -> dict:
    if not _copilot_engine:
        raise HTTPException(status_code=503, detail="Copilot not initialized")
    user_id = user.get("sub", "default")
    result = await _copilot_engine.confirm_action(req.confirmation_id, user_id)
    return result


@router.post("/clear")
async def clear_chat(user: dict = Depends(get_current_user)) -> dict:
    if not _copilot_engine:
        raise HTTPException(status_code=503, detail="Copilot not initialized")
    user_id = user.get("sub", "default")
    _copilot_engine.clear_conversation(user_id)
    return {"status": "cleared"}


@router.get("/health")
async def copilot_health() -> dict:
    if not _copilot_engine:
        return {"status": "unavailable"}
    return {"status": "ready"}

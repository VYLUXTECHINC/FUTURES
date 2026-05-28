from __future__ import annotations

import logging
import os

from fastapi import APIRouter

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/api/health")
async def root() -> dict:
    return {"message": "FUTURES Trading Bot API is running"}


@router.get("/api/config")
async def client_config() -> dict:
    """Public config for frontend — no auth required.
    Uses SUPABASE_ANON_KEY (not the service-role SUPABASE_KEY)."""
    anon_key = os.getenv("SUPABASE_ANON_KEY")
    if not anon_key:
        anon_key = os.getenv("SUPABASE_KEY", "")
        logger.warning("SUPABASE_ANON_KEY not set, falling back to SUPABASE_KEY")
    return {
        "supabase_url": os.getenv("SUPABASE_URL", ""),
        "supabase_key": anon_key,
    }

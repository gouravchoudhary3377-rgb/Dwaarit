"""Centralized configuration loaded from environment."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL: str = os.environ["MONGO_URL"]
DB_NAME: str = os.environ["DB_NAME"]
JWT_SECRET: str = os.environ.get("JWT_SECRET", "dwaarit-dev-secret-change-me")
JWT_ALGORITHM: str = "HS256"
JWT_EXPIRY_DAYS: int = 7

EMERGENT_SESSION_URL: str = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
EMERGENT_LLM_KEY: str = os.environ.get("EMERGENT_LLM_KEY", "")

RAZORPAY_KEY_ID: str = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET: str = os.environ.get("RAZORPAY_KEY_SECRET", "")
RAZORPAY_ENABLED: bool = bool(RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET)

# OTP behaviour
OTP_TTL_SECONDS: int = 300  # 5 minutes
OTP_DEV_MODE: bool = os.environ.get("OTP_DEV_MODE", "false").lower() in ("1", "true", "yes")

# MSG91 SMS gateway
MSG91_AUTH_KEY: str = os.environ.get("MSG91_AUTH_KEY", "")
MSG91_ENABLED: bool = bool(MSG91_AUTH_KEY)

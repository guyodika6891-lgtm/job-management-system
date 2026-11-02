
from pwdlib import PasswordHash
import os
from datetime import datetime, timedelta, timezone

import jwt
from dotenv import load_dotenv

load_dotenv()


SECRET_KEY = os.getenv("SECRET_KEY")

if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is missing from backend/.env")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30


def create_access_token(user_id: int, role: str) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": expires_at,
    }

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """Convert a plain password into a secure hash."""
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    """Check whether a password matches its stored hash."""
    return password_hash.verify(password, hashed_password)


import hmac
import json
import os
import secrets
import smtplib
import ssl
from datetime import datetime, timezone
from email.message import EmailMessage
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import urlopen

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.security import (
    create_access_token,
    create_password_reset_token,
    decode_password_reset_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models import User
from app.schemas.user import UserCreate, UserResponse
from fastapi.security import OAuth2PasswordRequestForm
from app.core.auth import get_current_user

from app.schemas.token import (
    GoogleCredentialRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    TokenResponse,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
GOOGLE_TOKEN_INFO_URL = "https://oauth2.googleapis.com/tokeninfo"


def _token_response(user: User) -> TokenResponse:
    return TokenResponse(access_token=create_access_token(user.id, user.role))


def _smtp_settings():
    host = os.getenv("SMTP_HOST")
    sender = os.getenv("SMTP_FROM_EMAIL")
    if not host or not sender:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password reset email is not configured. Contact the system administrator.",
        )

    try:
        port = int(os.getenv("SMTP_PORT", "587"))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password reset email is not configured correctly.",
        ) from exc
    if not 1 <= port <= 65535:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password reset email is not configured correctly.",
        )

    username = os.getenv("SMTP_USERNAME")
    password = os.getenv("SMTP_PASSWORD")
    if bool(username) != bool(password):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password reset email is not configured correctly.",
        )

    return {
        "host": host,
        "port": port,
        "sender": sender,
        "username": username,
        "password": password,
        "use_tls": os.getenv("SMTP_USE_TLS", "true").lower() == "true",
    }


def _send_password_reset_email(email: str, reset_url: str, smtp: dict) -> None:
    message = EmailMessage()
    message["Subject"] = "Reset your JobConnect password"
    message["From"] = smtp["sender"]
    message["To"] = email
    message.set_content(
        "We received a request to reset your JobConnect password.\n\n"
        f"Use this link within 30 minutes:\n{reset_url}\n\n"
        "If you did not request this, you can ignore this email."
    )
    with smtplib.SMTP(smtp["host"], smtp["port"], timeout=10) as connection:
        if smtp["use_tls"]:
            connection.starttls(context=ssl.create_default_context())
        if smtp["username"]:
            connection.login(smtp["username"], smtp["password"])
        refused = connection.send_message(message)
        if refused:
            raise smtplib.SMTPRecipientsRefused(refused)


@router.get("/registration-status")
def get_registration_status(
    db: Session = Depends(get_db),
):
    admin_exists = db.scalar(
        select(User.id).where(User.role == "admin").limit(1)
    ) is not None
    return {
        "admin_exists": admin_exists,
        "admin_setup_available": (
            not admin_exists and bool(os.getenv("ADMIN_REGISTRATION_CODE"))
        ),
    }


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
):
    if user_data.role == "admin":
        admin_exists = db.scalar(
            select(User.id).where(User.role == "admin").limit(1)
        )
        if admin_exists is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Admin is already registered. Only one admin is allowed for this system.",
            )

        configured_code = os.getenv("ADMIN_REGISTRATION_CODE")
        if not configured_code:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Admin registration is not configured. Set ADMIN_REGISTRATION_CODE in backend/.env.",
            )
        if not user_data.admin_registration_code or not hmac.compare_digest(
            user_data.admin_registration_code,
            configured_code,
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="The admin registration code is invalid.",
            )

    existing_user = db.scalar(
        select(User).where(User.email == str(user_data.email).lower())
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    new_user = User(
        full_name=user_data.full_name,
        email=str(user_data.email).lower(),
        password_hash=hash_password(user_data.password),
        role=user_data.role,
        company_name=user_data.company_name,
    )

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
    except IntegrityError:
        db.rollback()
        if user_data.role == "admin" and db.scalar(
            select(User.id).where(User.role == "admin").limit(1)
        ) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Admin is already registered. Only one admin is allowed for this system.",
            )
        if db.scalar(
            select(User.id).where(User.email == str(user_data.email).lower())
        ) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists.",
            )
        raise
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to register user.",
        )

    return new_user


@router.post("/login", response_model=TokenResponse)
def login_user(
    login_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.scalar(
        select(User).where(User.email == login_data.username.lower())
    )

    if not user or not verify_password(
        login_data.password, user.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is disabled. Contact a system administrator.",
        )

    return _token_response(user)


@router.post("/google", response_model=TokenResponse)
def login_with_google(
    request: GoogleCredentialRequest,
    db: Session = Depends(get_db),
):
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    if not client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign-in is not configured.",
        )

    verification_url = (
        f"{GOOGLE_TOKEN_INFO_URL}?{urlencode({'id_token': request.credential})}"
    )
    try:
        with urlopen(verification_url, timeout=8) as response:
            claims = json.loads(response.read())
    except HTTPError as exc:
        if exc.code in {400, 401}:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google sign-in credential is invalid or expired.",
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign-in could not be verified right now. Please try again.",
        ) from exc
    except (URLError, TimeoutError, OSError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign-in could not be verified right now. Please try again.",
        ) from exc
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign-in could not be verified right now. Please try again.",
        ) from exc

    if not isinstance(claims, dict):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign-in could not be verified right now. Please try again.",
        )
    try:
        token_expiration = int(claims.get("exp", "0"))
    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google sign-in credential is invalid or expired.",
        ) from exc

    issuer = claims.get("iss")
    verified_email = claims.get("email_verified")
    if (
        claims.get("aud") != client_id
        or issuer not in {"accounts.google.com", "https://accounts.google.com"}
        or token_expiration <= int(datetime.now(timezone.utc).timestamp())
        or not claims.get("sub")
        or not claims.get("email")
        or (verified_email is not True and verified_email != "true")
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google sign-in credential is invalid or expired.",
        )

    email = str(claims["email"]).strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        full_name = str(claims.get("name") or email.split("@", 1)[0]).strip()[:150]
        if len(full_name) < 2:
            full_name = "Google user"
        user = User(
            full_name=full_name,
            email=email,
            password_hash=hash_password(secrets.token_urlsafe(48)),
            role="job_seeker",
        )
        db.add(user)
        try:
            db.commit()
            db.refresh(user)
        except IntegrityError:
            db.rollback()
            user = db.scalar(select(User).where(User.email == email))
            if user is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Unable to create the account. Please try again.",
                )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is disabled. Contact a system administrator.",
        )

    return _token_response(user)


@router.post("/password-reset/request", status_code=status.HTTP_202_ACCEPTED)
def request_password_reset(
    request: PasswordResetRequest,
    db: Session = Depends(get_db),
):
    smtp = _smtp_settings()
    user = db.scalar(
        select(User).where(User.email == str(request.email).lower())
    )
    if user is not None and user.is_active:
        token = create_password_reset_token(user.id, user.password_reset_version)
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
        reset_url = f"{frontend_url}/reset-password?token={quote(token)}"
        try:
            _send_password_reset_email(user.email, reset_url, smtp)
        except (OSError, smtplib.SMTPException) as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Password reset email could not be sent. Please try again later.",
            ) from exc

    return {
        "message": "If an active account uses that email, a password reset link has been sent."
    }


@router.post("/password-reset/confirm")
def confirm_password_reset(
    request: PasswordResetConfirm,
    db: Session = Depends(get_db),
):
    try:
        claims = decode_password_reset_token(request.token)
        user_id = int(claims["sub"])
        token_version = int(claims["version"])
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset link is invalid or expired. Request a new link.",
        ) from exc

    user = db.get(User, user_id)
    if (
        user is None
        or not user.is_active
        or user.password_reset_version != token_version
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset link is invalid or expired. Request a new link.",
        )

    user.password_hash = hash_password(request.new_password)
    user.password_reset_version += 1
    db.commit()
    return {"message": "Password updated. Sign in with your new password."}

@router.get("/me", response_model=UserResponse)
def read_current_user(
    current_user: User = Depends(get_current_user),
):
    return current_user

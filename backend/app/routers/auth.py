
import hmac
import os

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models import User
from app.schemas.user import UserCreate, UserResponse
from fastapi.security import OAuth2PasswordRequestForm
from app.core.auth import get_current_user

from app.schemas.token import TokenResponse

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


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

    access_token = create_access_token(user.id, user.role)

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }

@router.get("/me", response_model=UserResponse)
def read_current_user(
    current_user: User = Depends(get_current_user),
):
    return current_user


from pydantic import BaseModel
from pydantic import EmailStr, Field


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class GoogleCredentialRequest(BaseModel):
    credential: str = Field(min_length=100, max_length=8192)


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str = Field(min_length=20, max_length=4096)
    new_password: str = Field(min_length=8, max_length=128)

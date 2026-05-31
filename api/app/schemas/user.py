from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.user import RoleEnum


class UserBase(BaseModel):
    nome: str = Field(min_length=2, max_length=150)
    email: str = Field(min_length=3, max_length=255)
    role: RoleEnum


class UserCreate(UserBase):
    senha: str = Field(min_length=6, max_length=128)


class UserUpdate(BaseModel):
    nome: Optional[str] = Field(default=None, min_length=2, max_length=150)
    email: Optional[str] = Field(default=None, min_length=3, max_length=255)
    role: Optional[RoleEnum] = None
    senha: Optional[str] = Field(default=None, min_length=6, max_length=128)


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    needs_password_change: bool
    is_locked: bool
    last_login: Optional[datetime]
    created_at: datetime

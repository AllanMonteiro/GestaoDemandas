from datetime import UTC, datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.models.user import User

settings = get_settings()
pwd_context = CryptContext(schemes=['pbkdf2_sha256'], deprecated='auto')
oauth2_scheme = OAuth2PasswordBearer(tokenUrl='/api/auth/login')


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(user_id: int) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {'sub': str(user_id), 'exp': expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def authenticate_user(db: Session, email: str, password: str) -> User:
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        raise HTTPException(status_code=401, detail="Email ou senha inválidos.")
    
    if user.is_locked:
        raise HTTPException(status_code=403, detail="Usuário bloqueado por excesso de tentativas.")

    if not verify_password(password, user.password_hash):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= 5:
            user.is_locked = True
        db.commit()
        raise HTTPException(status_code=401, detail="Email ou senha inválidos.")
    
    # Reset attempts on success
    user.failed_login_attempts = 0
    user.last_login = datetime.now(UTC)
    db.commit()
    
    return user


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail='Token inválido ou expirado.',
        headers={'WWW-Authenticate': 'Bearer'},
    )

    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get('sub')
        if user_id is None:
            raise credentials_exception
        user_id_int = int(user_id)
    except JWTError as exc:
        raise credentials_exception from exc
    except (TypeError, ValueError) as exc:
        raise credentials_exception from exc

    user = db.scalar(select(User).where(User.id == user_id_int))
    if user is None:
        raise credentials_exception
    
    if user.is_locked:
        raise HTTPException(status_code=403, detail="Usuário bloqueado.")
        
    return user

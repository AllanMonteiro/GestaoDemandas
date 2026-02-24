from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.rbac import require_roles
from app.core.security import (
    authenticate_user,
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models.user import RoleEnum, User
from app.schemas.auth import AlterarSenhaRequest, MensagemAuthOut, TokenResponse
from app.schemas.user import UserCreate, UserOut

router = APIRouter(prefix='/api/auth', tags=['Autenticação'])


@router.post('/login', response_model=TokenResponse)
async def login(request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    content_type = request.headers.get('content-type', '').lower()
    email = ''
    senha = ''

    if 'application/x-www-form-urlencoded' in content_type or 'multipart/form-data' in content_type:
        form = await request.form()
        email = str(form.get('username') or form.get('email') or '').strip()
        senha = str(form.get('password') or form.get('senha') or '')
    else:
        try:
            payload = await request.json()
        except Exception:
            payload = {}
        if isinstance(payload, dict):
            email = str(payload.get('email') or payload.get('username') or '').strip()
            senha = str(payload.get('senha') or payload.get('password') or '')

    if not email or not senha:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail='Informe credenciais em JSON (email/senha) ou formulario (username/password).',
        )

    user = authenticate_user(db, email, senha)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Email ou senha inválidos.')

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, usuario=user)


@router.post('/register', response_model=UserOut)
def register(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleEnum.ADMIN)),
) -> UserOut:
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Já existe usuário com este email.')

    new_user = User(
        nome=payload.nome,
        email=payload.email,
        role=payload.role,
        password_hash=hash_password(payload.senha),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.get('/me', response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> UserOut:
    return current_user


@router.post('/alterar-senha', response_model=MensagemAuthOut)
def alterar_senha(
    payload: AlterarSenhaRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN)),
) -> MensagemAuthOut:
    if not verify_password(payload.senha_atual, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Senha atual invalida.')

    if payload.senha_atual == payload.nova_senha:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='A nova senha deve ser diferente da senha atual.',
        )

    current_user.password_hash = hash_password(payload.nova_senha)
    db.commit()
    return MensagemAuthOut(mensagem='Senha alterada com sucesso.')

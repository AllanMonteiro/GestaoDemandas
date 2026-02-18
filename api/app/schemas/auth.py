from pydantic import BaseModel, Field

from app.schemas.user import UserOut


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    senha: str = Field(min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = 'bearer'
    usuario: UserOut


class AlterarSenhaRequest(BaseModel):
    senha_atual: str = Field(min_length=1, max_length=128)
    nova_senha: str = Field(min_length=6, max_length=128)


class MensagemAuthOut(BaseModel):
    mensagem: str

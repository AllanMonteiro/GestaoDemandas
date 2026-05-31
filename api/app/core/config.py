from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    APP_NAME: str = 'Gestao de Demandas'
    DATABASE_URL: str = 'postgresql+psycopg://fsc:fsc@db:5432/fsc_db'
    JWT_SECRET: str = 'trocar_isto'
    JWT_ALGORITHM: str = 'HS256'
    JWT_EXPIRE_MINUTES: int = 480

    S3_ENDPOINT: str = 'http://minio:9000'
    S3_ACCESS_KEY: str = 'minio'
    S3_SECRET_KEY: str = 'minio12345'
    S3_BUCKET: str = 'demandas-anexos'
    S3_REGION: str = 'us-east-1'
    S3_STRICT_STARTUP: bool = False

    CORS_ORIGINS: str = 'http://localhost:5173'

    ADMIN_INITIAL_PASSWORD: str = 'admin123'
    MAX_UPLOAD_SIZE_MB: int = 50
    ALLOWED_UPLOAD_EXTENSIONS: str = (
        'pdf,jpg,jpeg,png,gif,bmp,webp,'
        'doc,docx,xls,xlsx,ppt,pptx,'
        'zip,rar,txt,csv,mp4,mov,avi'
    )

    @field_validator('JWT_SECRET')
    @classmethod
    def jwt_secret_must_not_be_default(cls, v: str) -> str:
        if v == 'trocar_isto':
            raise ValueError(
                "JWT_SECRET não pode ser o valor padrão 'trocar_isto'. "
                "Defina uma chave segura no arquivo .env ou variável de ambiente."
            )
        return v

    @field_validator('DATABASE_URL')
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        url = v.strip()
        if url.startswith('postgresql://'):
            return 'postgresql+psycopg://' + url[len('postgresql://') :]
        if url.startswith('postgres://'):
            return 'postgresql+psycopg://' + url[len('postgres://') :]
        return url

    def cors_origins(self) -> list[str]:
        origins = [origin.strip() for origin in self.CORS_ORIGINS.split(',') if origin.strip()]
        return origins or ['http://localhost:5173']

    def allowed_extensions_set(self) -> frozenset[str]:
        return frozenset(
            ext.strip().lower()
            for ext in self.ALLOWED_UPLOAD_EXTENSIONS.split(',')
            if ext.strip()
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()

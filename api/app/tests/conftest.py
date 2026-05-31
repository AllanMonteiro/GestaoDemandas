from collections.abc import Generator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import get_current_user
from app.db.session import get_db
from app.models import Base
from app.models.demanda_gestao import Demanda, DemandaPrioridade, DemandaStatus
from app.models.user import RoleEnum, User
from app.routers import demanda_analises, demanda_gestao


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    engine = create_engine(
        'sqlite://',
        connect_args={'check_same_thread': False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    Base.metadata.create_all(bind=engine)

    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture()
def seed_data(db_session: Session) -> dict[str, object]:
    admin = User(
        nome='Administrador',
        email='admin@local',
        role=RoleEnum.ADMIN,
        password_hash='hash',
    )
    solicitante = User(
        nome='Solicitante',
        email='solicitante@local',
        role=RoleEnum.SOLICITANTE,
        password_hash='hash',
    )
    responsavel = User(
        nome='Responsavel',
        email='responsavel@local',
        role=RoleEnum.RESPONSAVEL,
        password_hash='hash',
    )
    db_session.add_all([admin, solicitante, responsavel])
    db_session.flush()

    demanda = Demanda(
        codigo='DEM-TESTE',
        titulo='Demanda de teste',
        descricao='Fluxo de analise estruturada',
        solicitante_id=solicitante.id,
        responsavel_id=responsavel.id,
        prioridade=DemandaPrioridade.media,
        status=DemandaStatus.nova,
    )
    db_session.add(demanda)
    db_session.commit()
    db_session.refresh(admin)
    db_session.refresh(solicitante)
    db_session.refresh(responsavel)
    db_session.refresh(demanda)

    return {
        'admin': admin,
        'solicitante': solicitante,
        'responsavel': responsavel,
        'demanda': demanda,
    }


@pytest.fixture()
def client(db_session: Session, seed_data: dict[str, object]) -> Generator[TestClient, None, None]:
    app = FastAPI()
    app.include_router(demanda_analises.router)
    app.include_router(demanda_gestao.router)

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    def override_get_current_user() -> User:
        return seed_data['admin']  # type: ignore[return-value]

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    with TestClient(app) as test_client:
        yield test_client

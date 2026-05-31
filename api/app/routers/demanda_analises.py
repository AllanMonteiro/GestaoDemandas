from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.demanda_gestao import (
    Demanda,
    DemandaAnalise,
    DemandaAnaliseCampo,
    DemandaAnaliseStatus,
)
from app.models.user import RoleEnum, User
from app.schemas.demanda_gestao import (
    DemandaAnaliseCampoRead,
    DemandaAnaliseCreate,
    DemandaAnaliseRead,
    DemandaAnaliseStatusUpdate,
    DemandaAnaliseUpdate,
)
from app.schemas.fsc import MensagemOut
from app.services.demand_analysis import (
    build_field_rows,
    enrich_field_map,
    fields_to_map,
    normalize_problem_text,
    validate_analysis_payload,
)

router = APIRouter(prefix='/api/gestao-demandas', tags=['Analises de Demanda'])


def _buscar_demanda(db: Session, demanda_id: int) -> Demanda:
    demanda = db.scalar(
        select(Demanda)
        .options(selectinload(Demanda.solicitante), selectinload(Demanda.responsavel))
        .where(Demanda.id == demanda_id)
    )
    if not demanda:
        raise HTTPException(status_code=404, detail='Demanda nao encontrada.')
    return demanda


def _buscar_analise(db: Session, analise_id: int) -> DemandaAnalise:
    analise = db.scalar(
        select(DemandaAnalise)
        .options(selectinload(DemandaAnalise.campos), selectinload(DemandaAnalise.responsavel))
        .where(DemandaAnalise.id == analise_id)
    )
    if not analise:
        raise HTTPException(status_code=404, detail='Analise da demanda nao encontrada.')
    return analise


def _verificar_acesso_demanda(demanda: Demanda, current_user: User) -> None:
    if current_user.role in (RoleEnum.ADMIN, RoleEnum.GESTOR, RoleEnum.AUDITOR):
        return
    if current_user.role == RoleEnum.RESPONSAVEL and demanda.responsavel_id == current_user.id:
        return
    if current_user.role == RoleEnum.SOLICITANTE and demanda.solicitante_id == current_user.id:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Acesso negado.')


def _verificar_permissao_edicao_analise(analise: DemandaAnalise, demanda: Demanda, current_user: User) -> None:
    if current_user.role in (RoleEnum.ADMIN, RoleEnum.GESTOR):
        return
    if analise.responsavel_id == current_user.id:
        return
    if current_user.role == RoleEnum.RESPONSAVEL and demanda.responsavel_id == current_user.id:
        return
    if current_user.role == RoleEnum.SOLICITANTE and demanda.solicitante_id == current_user.id and analise.responsavel_id == current_user.id:
        return
    if current_user.role == RoleEnum.AUDITOR and analise.responsavel_id == current_user.id:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Voce nao possui permissao para editar esta analise.')


def _verificar_responsavel_existente(db: Session, responsavel_id: int | None) -> None:
    if responsavel_id is None:
        return
    responsavel = db.get(User, responsavel_id)
    if not responsavel:
        raise HTTPException(status_code=404, detail='Responsavel nao encontrado.')


def _resolver_responsavel_id(
    current_user: User,
    responsavel_id_informado: int | None,
    responsavel_id_atual: int | None = None,
) -> int | None:
    if current_user.role in (RoleEnum.ADMIN, RoleEnum.GESTOR):
        if responsavel_id_informado is not None:
            return responsavel_id_informado
        return responsavel_id_atual if responsavel_id_atual is not None else current_user.id
    if responsavel_id_informado is None:
        return responsavel_id_atual if responsavel_id_atual is not None else current_user.id
    if responsavel_id_informado != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Voce so pode atribuir a analise a si mesmo.',
        )
    return responsavel_id_informado


def _validar_transicao_status(status_destino: DemandaAnaliseStatus, current_user: User) -> None:
    if status_destino in (DemandaAnaliseStatus.concluido, DemandaAnaliseStatus.cancelado) and current_user.role not in (
        RoleEnum.ADMIN,
        RoleEnum.GESTOR,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Somente gestor ou administrador pode concluir ou cancelar a analise.',
        )


def _montar_resposta_analise(analise: DemandaAnalise) -> DemandaAnaliseRead:
    campos_ordenados = sorted(analise.campos, key=lambda item: (item.ordem, item.id))
    campos_map = enrich_field_map(analise.metodo, fields_to_map(campos_ordenados))
    pontuacao_total = None
    if campos_map.get('pontuacao_total'):
        try:
            pontuacao_total = int(campos_map['pontuacao_total'])
        except ValueError:
            pontuacao_total = None
    classificacao = campos_map.get('classificacao_prioridade') or campos_map.get('classificacao')

    resposta = DemandaAnaliseRead.model_validate(analise)
    resposta.campos = [DemandaAnaliseCampoRead.model_validate(campo) for campo in campos_ordenados]
    resposta.campos_map = campos_map
    resposta.responsavel_nome = analise.responsavel.nome if analise.responsavel else None
    resposta.pontuacao_total = pontuacao_total
    resposta.classificacao = classificacao
    return resposta


def _substituir_campos(analise: DemandaAnalise, method_field_rows: list[dict[str, object]]) -> None:
    analise.campos.clear()
    for row in method_field_rows:
        analise.campos.append(
            DemandaAnaliseCampo(
                chave=str(row['chave']),
                valor=row.get('valor'),
                ordem=int(row['ordem']),
            )
        )


@router.get('/{demanda_id}/analises', response_model=List[DemandaAnaliseRead])
def listar_analises_demanda(
    demanda_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[DemandaAnaliseRead]:
    demanda = _buscar_demanda(db, demanda_id)
    _verificar_acesso_demanda(demanda, current_user)

    analises = db.scalars(
        select(DemandaAnalise)
        .options(selectinload(DemandaAnalise.campos), selectinload(DemandaAnalise.responsavel))
        .where(DemandaAnalise.demanda_id == demanda_id)
        .order_by(DemandaAnalise.criado_em.desc())
    ).all()
    return [_montar_resposta_analise(analise) for analise in analises]


@router.post('/{demanda_id}/analises', response_model=DemandaAnaliseRead, status_code=status.HTTP_201_CREATED)
def criar_analise_demanda(
    demanda_id: int,
    body: DemandaAnaliseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DemandaAnaliseRead:
    demanda = _buscar_demanda(db, demanda_id)
    _verificar_acesso_demanda(demanda, current_user)

    responsavel_id = _resolver_responsavel_id(current_user, body.responsavel_id)
    _verificar_responsavel_existente(db, responsavel_id)
    _validar_transicao_status(body.status, current_user)

    field_map = enrich_field_map(body.metodo, fields_to_map(body.campos))
    try:
        validate_analysis_payload(body.metodo, body.status, body.problema, body.causa_raiz, field_map)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    analise = DemandaAnalise(
        demanda_id=demanda_id,
        metodo=body.metodo,
        problema=normalize_problem_text(body.problema),
        causa_raiz=normalize_problem_text(body.causa_raiz),
        status=body.status,
        responsavel_id=responsavel_id,
    )
    _substituir_campos(analise, build_field_rows(body.metodo, field_map))
    db.add(analise)
    db.commit()
    db.refresh(analise)
    analise = _buscar_analise(db, analise.id)
    return _montar_resposta_analise(analise)


@router.get('/analises/{analise_id}', response_model=DemandaAnaliseRead)
def obter_analise_demanda(
    analise_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DemandaAnaliseRead:
    analise = _buscar_analise(db, analise_id)
    demanda = _buscar_demanda(db, analise.demanda_id)
    _verificar_acesso_demanda(demanda, current_user)
    return _montar_resposta_analise(analise)


@router.put('/analises/{analise_id}', response_model=DemandaAnaliseRead)
def atualizar_analise_demanda(
    analise_id: int,
    body: DemandaAnaliseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DemandaAnaliseRead:
    analise = _buscar_analise(db, analise_id)
    demanda = _buscar_demanda(db, analise.demanda_id)
    _verificar_permissao_edicao_analise(analise, demanda, current_user)

    status_destino = body.status or analise.status
    responsavel_id = _resolver_responsavel_id(current_user, body.responsavel_id, analise.responsavel_id)
    _verificar_responsavel_existente(db, responsavel_id)
    _validar_transicao_status(status_destino, current_user)

    problema = body.problema if body.problema is not None else analise.problema
    causa_raiz = body.causa_raiz if body.causa_raiz is not None else analise.causa_raiz
    field_map = enrich_field_map(
        analise.metodo,
        fields_to_map(body.campos if body.campos is not None else analise.campos),
    )

    try:
        validate_analysis_payload(analise.metodo, status_destino, problema, causa_raiz, field_map)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    analise.problema = normalize_problem_text(problema)
    analise.causa_raiz = normalize_problem_text(causa_raiz)
    analise.status = status_destino
    analise.responsavel_id = responsavel_id
    _substituir_campos(analise, build_field_rows(analise.metodo, field_map))

    db.commit()
    db.refresh(analise)
    analise = _buscar_analise(db, analise.id)
    return _montar_resposta_analise(analise)


@router.patch('/analises/{analise_id}/status', response_model=DemandaAnaliseRead)
def alterar_status_analise_demanda(
    analise_id: int,
    body: DemandaAnaliseStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DemandaAnaliseRead:
    analise = _buscar_analise(db, analise_id)
    demanda = _buscar_demanda(db, analise.demanda_id)
    _verificar_permissao_edicao_analise(analise, demanda, current_user)
    _validar_transicao_status(body.status, current_user)

    field_map = enrich_field_map(analise.metodo, fields_to_map(analise.campos))
    try:
        validate_analysis_payload(analise.metodo, body.status, analise.problema, analise.causa_raiz, field_map)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    analise.status = body.status
    _substituir_campos(analise, build_field_rows(analise.metodo, field_map))
    db.commit()
    db.refresh(analise)
    analise = _buscar_analise(db, analise.id)
    return _montar_resposta_analise(analise)


@router.delete('/analises/{analise_id}', response_model=MensagemOut)
def excluir_analise_demanda(
    analise_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MensagemOut:
    analise = _buscar_analise(db, analise_id)
    demanda = _buscar_demanda(db, analise.demanda_id)
    _verificar_permissao_edicao_analise(analise, demanda, current_user)
    db.delete(analise)
    db.commit()
    return MensagemOut(mensagem='Analise removida com sucesso.')

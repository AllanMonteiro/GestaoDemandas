from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.rbac import require_roles
from app.core.security import get_current_user
from app.db.session import get_db
from app.models.project import Projeto, ProjetoPrioridadeEnum, ProjetoStatusEnum, TarefaProjeto, TarefaStatusEnum
from app.models.user import RoleEnum, User
from app.schemas.fsc import MensagemOut
from app.schemas.project import (
    PROJETO_STATUS_LABELS,
    TAREFA_STATUS_LABELS,
    ProjetosDashboardOut,
    ProjetoCreate,
    ProjetoOut,
    ProjetoStatusPatch,
    ProjetoUpdate,
    ResumoProjetosStatusItem,
    ResumoTarefasStatusItem,
    TarefaProjetoCreate,
    TarefaProjetoOut,
    TarefaProjetoStatusPatch,
    TarefaProjetoUpdate,
)

router = APIRouter(prefix='/api', tags=['Projetos'])


def _buscar_usuario(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Usuario nao encontrado.')
    return user


def _buscar_projeto(db: Session, projeto_id: int) -> Projeto:
    projeto = db.get(Projeto, projeto_id)
    if not projeto:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Projeto nao encontrado.')
    return projeto


def _buscar_tarefa(db: Session, tarefa_id: int) -> TarefaProjeto:
    tarefa = db.get(TarefaProjeto, tarefa_id)
    if not tarefa:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Tarefa nao encontrada.')
    return tarefa


def _validar_datas(data_inicio: date | None, data_fim: date | None, contexto: str) -> None:
    if data_inicio and data_fim and data_fim < data_inicio:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'A data final de {contexto} nao pode ser anterior a data inicial.',
        )


def _validar_acesso_projeto(db: Session, projeto: Projeto, current_user: User) -> None:
    if current_user.role != RoleEnum.RESPONSAVEL:
        return
    tarefa_vinculada = db.scalar(
        select(TarefaProjeto.id)
        .where(
            TarefaProjeto.projeto_id == projeto.id,
            TarefaProjeto.responsavel_id == current_user.id,
        )
        .limit(1)
    )
    if projeto.gerente_id != current_user.id and not tarefa_vinculada:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Voce so pode acessar projetos atribuidos a voce.',
        )


def _validar_codigo_unico(db: Session, codigo: str, projeto_id: int | None = None) -> None:
    query = select(Projeto.id).where(func.lower(Projeto.codigo) == codigo.lower())
    if projeto_id is not None:
        query = query.where(Projeto.id != projeto_id)
    existente = db.scalar(query.limit(1))
    if existente:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Ja existe um projeto com este codigo.')


def _normalizar_datas_projeto(data: dict, projeto: Projeto | None = None) -> None:
    data_inicio = data.get('data_inicio', projeto.data_inicio if projeto else None)
    data_fim_prevista = data.get('data_fim_prevista', projeto.data_fim_prevista if projeto else None)
    data_fim_real = data.get('data_fim_real', projeto.data_fim_real if projeto else None)
    status_projeto = data.get('status', projeto.status if projeto else ProjetoStatusEnum.planejamento)

    _validar_datas(data_inicio, data_fim_prevista, 'projeto')
    _validar_datas(data_inicio, data_fim_real, 'projeto')
    if data_fim_prevista and data_fim_real and data_fim_real < data_fim_prevista and status_projeto != ProjetoStatusEnum.concluido:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Data final real anterior ao prazo previsto so e aceita para projetos concluidos.',
        )

    if status_projeto == ProjetoStatusEnum.concluido and not data_fim_real:
        data['data_fim_real'] = date.today()
    elif status_projeto != ProjetoStatusEnum.concluido and 'status' in data and 'data_fim_real' not in data:
        data['data_fim_real'] = None


def _normalizar_datas_tarefa(data: dict, tarefa: TarefaProjeto | None = None) -> None:
    data_inicio = data.get('start_date', tarefa.start_date if tarefa else None)
    data_fim = data.get('due_date', tarefa.due_date if tarefa else None)
    data_conclusao = data.get('completed_at', tarefa.completed_at if tarefa else None)
    status_tarefa = data.get('status', tarefa.status if tarefa else TarefaStatusEnum.backlog)

    _validar_datas(data_inicio, data_fim, 'tarefa')
    _validar_datas(data_inicio, data_conclusao, 'tarefa')

    if status_tarefa == TarefaStatusEnum.concluida and not data_conclusao:
        data['completed_at'] = date.today()
    elif status_tarefa != TarefaStatusEnum.concluida and 'status' in data and 'completed_at' not in data:
        data['completed_at'] = None


def _projetos_visiveis_query(current_user: User):
    query = select(Projeto)
    if current_user.role == RoleEnum.RESPONSAVEL:
        subquery_tarefas = select(TarefaProjeto.projeto_id).where(TarefaProjeto.responsavel_id == current_user.id)
        query = query.where(or_(Projeto.gerente_id == current_user.id, Projeto.id.in_(subquery_tarefas)))
    return query


@router.get('/projetos', response_model=list[ProjetoOut])
def listar_projetos(
    status_projeto: ProjetoStatusEnum | None = Query(default=None),
    prioridade: ProjetoPrioridadeEnum | None = Query(default=None),
    gerente_id: int | None = Query(default=None),
    atrasados: bool | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ProjetoOut]:
    query = _projetos_visiveis_query(current_user)
    if status_projeto:
        query = query.where(Projeto.status == status_projeto)
    if prioridade:
        query = query.where(Projeto.prioridade == prioridade)
    if gerente_id:
        query = query.where(Projeto.gerente_id == gerente_id)
    if atrasados:
        query = query.where(
            Projeto.data_fim_prevista.is_not(None),
            Projeto.data_fim_prevista < date.today(),
            Projeto.status.notin_((ProjetoStatusEnum.concluido, ProjetoStatusEnum.cancelado)),
        )

    query = query.order_by(Projeto.data_fim_prevista.asc().nulls_last(), Projeto.created_at.desc())
    return list(db.scalars(query).all())


@router.post('/projetos', response_model=ProjetoOut, status_code=status.HTTP_201_CREATED)
def criar_projeto(
    payload: ProjetoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR)),
) -> ProjetoOut:
    if payload.gerente_id is not None:
        _buscar_usuario(db, payload.gerente_id)
    _validar_codigo_unico(db, payload.codigo)
    data = payload.model_dump()
    _normalizar_datas_projeto(data)

    projeto = Projeto(
        **data,
        created_by=current_user.id,
    )
    db.add(projeto)
    db.commit()
    db.refresh(projeto)
    return projeto


@router.get('/projetos/{projeto_id}', response_model=ProjetoOut)
def obter_projeto(
    projeto_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjetoOut:
    projeto = _buscar_projeto(db, projeto_id)
    _validar_acesso_projeto(db, projeto, current_user)
    return projeto


@router.put('/projetos/{projeto_id}', response_model=ProjetoOut)
def atualizar_projeto(
    projeto_id: int,
    payload: ProjetoUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR)),
) -> ProjetoOut:
    projeto = _buscar_projeto(db, projeto_id)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Nenhum campo informado para atualizacao.')
    if 'codigo' in data:
        _validar_codigo_unico(db, data['codigo'], projeto_id=projeto_id)
    if 'gerente_id' in data and data['gerente_id'] is not None:
        _buscar_usuario(db, data['gerente_id'])

    _normalizar_datas_projeto(data, projeto)
    for field, value in data.items():
        setattr(projeto, field, value)

    db.commit()
    db.refresh(projeto)
    return projeto


@router.patch('/projetos/{projeto_id}/status', response_model=ProjetoOut)
def atualizar_status_projeto(
    projeto_id: int,
    payload: ProjetoStatusPatch,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR)),
) -> ProjetoOut:
    projeto = _buscar_projeto(db, projeto_id)
    data = {'status': payload.status}
    _normalizar_datas_projeto(data, projeto)
    projeto.status = payload.status
    if 'data_fim_real' in data:
        projeto.data_fim_real = data['data_fim_real']
    db.commit()
    db.refresh(projeto)
    return projeto


@router.delete('/projetos/{projeto_id}', response_model=MensagemOut)
def remover_projeto(
    projeto_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR)),
) -> MensagemOut:
    projeto = _buscar_projeto(db, projeto_id)
    db.delete(projeto)
    db.commit()
    return MensagemOut(mensagem='Projeto removido com sucesso.')


@router.get('/projetos/{projeto_id}/tarefas', response_model=list[TarefaProjetoOut])
def listar_tarefas_projeto(
    projeto_id: int,
    status_tarefa: TarefaStatusEnum | None = Query(default=None),
    responsavel_id: int | None = Query(default=None),
    atrasadas: bool | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TarefaProjetoOut]:
    projeto = _buscar_projeto(db, projeto_id)
    _validar_acesso_projeto(db, projeto, current_user)

    query = select(TarefaProjeto).where(TarefaProjeto.projeto_id == projeto_id)
    if status_tarefa:
        query = query.where(TarefaProjeto.status == status_tarefa)
    if responsavel_id:
        query = query.where(TarefaProjeto.responsavel_id == responsavel_id)
    if atrasadas:
        query = query.where(
            TarefaProjeto.due_date.is_not(None),
            TarefaProjeto.due_date < date.today(),
            TarefaProjeto.status != TarefaStatusEnum.concluida,
        )
    if current_user.role == RoleEnum.RESPONSAVEL:
        query = query.where(TarefaProjeto.responsavel_id == current_user.id)

    query = query.order_by(TarefaProjeto.ordem.asc(), TarefaProjeto.due_date.asc().nulls_last(), TarefaProjeto.id.desc())
    return list(db.scalars(query).all())


@router.post('/projetos/{projeto_id}/tarefas', response_model=TarefaProjetoOut, status_code=status.HTTP_201_CREATED)
def criar_tarefa_projeto(
    projeto_id: int,
    payload: TarefaProjetoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR, RoleEnum.AUDITOR)),
) -> TarefaProjetoOut:
    _buscar_projeto(db, projeto_id)
    if payload.responsavel_id is not None:
        _buscar_usuario(db, payload.responsavel_id)

    data = payload.model_dump()
    _normalizar_datas_tarefa(data)
    tarefa = TarefaProjeto(
        **data,
        projeto_id=projeto_id,
        created_by=current_user.id,
    )
    db.add(tarefa)
    db.commit()
    db.refresh(tarefa)
    return tarefa


@router.patch('/tarefas/{tarefa_id}', response_model=TarefaProjetoOut)
def atualizar_tarefa(
    tarefa_id: int,
    payload: TarefaProjetoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TarefaProjetoOut:
    tarefa = _buscar_tarefa(db, tarefa_id)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Nenhum campo informado para atualizacao.')

    if current_user.role == RoleEnum.RESPONSAVEL:
        if tarefa.responsavel_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail='Voce so pode atualizar tarefas atribuidas a voce.',
            )
        permitidos = {'status', 'horas_registradas'}
        if not set(data.keys()).issubset(permitidos):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail='Responsavel so pode atualizar status e horas registradas.',
            )
    elif current_user.role not in (RoleEnum.ADMIN, RoleEnum.GESTOR, RoleEnum.AUDITOR):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Voce nao possui permissao para esta acao.')

    if 'responsavel_id' in data and data['responsavel_id'] is not None:
        _buscar_usuario(db, data['responsavel_id'])
    _normalizar_datas_tarefa(data, tarefa)

    for field, value in data.items():
        setattr(tarefa, field, value)

    db.commit()
    db.refresh(tarefa)
    return tarefa


@router.patch('/tarefas/{tarefa_id}/status', response_model=TarefaProjetoOut)
def atualizar_status_tarefa(
    tarefa_id: int,
    payload: TarefaProjetoStatusPatch,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TarefaProjetoOut:
    tarefa = _buscar_tarefa(db, tarefa_id)
    if current_user.role == RoleEnum.RESPONSAVEL and tarefa.responsavel_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Voce so pode atualizar status de tarefas atribuidas a voce.',
        )
    if current_user.role not in (RoleEnum.ADMIN, RoleEnum.GESTOR, RoleEnum.AUDITOR, RoleEnum.RESPONSAVEL):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Voce nao possui permissao para esta acao.')

    data = {'status': payload.status}
    _normalizar_datas_tarefa(data, tarefa)
    tarefa.status = payload.status
    if 'completed_at' in data:
        tarefa.completed_at = data['completed_at']
    db.commit()
    db.refresh(tarefa)
    return tarefa


@router.delete('/tarefas/{tarefa_id}', response_model=MensagemOut)
def remover_tarefa(
    tarefa_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR, RoleEnum.AUDITOR)),
) -> MensagemOut:
    tarefa = _buscar_tarefa(db, tarefa_id)
    db.delete(tarefa)
    db.commit()
    return MensagemOut(mensagem='Tarefa removida com sucesso.')


@router.get('/projetos-dashboard/resumo', response_model=ProjetosDashboardOut)
def resumo_dashboard_projetos(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjetosDashboardOut:
    projetos = list(db.scalars(_projetos_visiveis_query(current_user)).all())
    projeto_ids = [projeto.id for projeto in projetos]
    if not projeto_ids:
        return ProjetosDashboardOut(
            total_projetos=0,
            projetos_atrasados=0,
            tarefas_atrasadas=0,
            projetos_por_status=[
                ResumoProjetosStatusItem(status=status_item, label=PROJETO_STATUS_LABELS[status_item], quantidade=0)
                for status_item in ProjetoStatusEnum
            ],
            tarefas_por_status=[
                ResumoTarefasStatusItem(status=status_item, label=TAREFA_STATUS_LABELS[status_item], quantidade=0)
                for status_item in TarefaStatusEnum
            ],
        )

    projetos_atrasados = sum(
        1
        for projeto in projetos
        if projeto.data_fim_prevista
        and projeto.data_fim_prevista < date.today()
        and projeto.status not in (ProjetoStatusEnum.concluido, ProjetoStatusEnum.cancelado)
    )

    query_tarefas = select(TarefaProjeto).where(TarefaProjeto.projeto_id.in_(projeto_ids))
    if current_user.role == RoleEnum.RESPONSAVEL:
        query_tarefas = query_tarefas.where(TarefaProjeto.responsavel_id == current_user.id)
    tarefas = list(db.scalars(query_tarefas).all())
    tarefas_atrasadas = sum(
        1 for tarefa in tarefas if tarefa.due_date and tarefa.due_date < date.today() and tarefa.status != TarefaStatusEnum.concluida
    )

    projetos_por_status_map = {status_item: 0 for status_item in ProjetoStatusEnum}
    for projeto in projetos:
        projetos_por_status_map[projeto.status] += 1

    tarefas_por_status_map = {status_item: 0 for status_item in TarefaStatusEnum}
    for tarefa in tarefas:
        tarefas_por_status_map[tarefa.status] += 1

    return ProjetosDashboardOut(
        total_projetos=len(projetos),
        projetos_atrasados=projetos_atrasados,
        tarefas_atrasadas=tarefas_atrasadas,
        projetos_por_status=[
            ResumoProjetosStatusItem(
                status=status_item,
                label=PROJETO_STATUS_LABELS[status_item],
                quantidade=projetos_por_status_map.get(status_item, 0),
            )
            for status_item in ProjetoStatusEnum
        ],
        tarefas_por_status=[
            ResumoTarefasStatusItem(
                status=status_item,
                label=TAREFA_STATUS_LABELS[status_item],
                quantidade=tarefas_por_status_map.get(status_item, 0),
            )
            for status_item in TarefaStatusEnum
        ],
    )

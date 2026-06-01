from datetime import date, datetime, timedelta
from typing import List, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, Form, HTTPException, Query, Response, status, UploadFile, File
from sqlalchemy import and_, func, or_, select, desc
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.core.security import get_current_user
from app.db.session import get_db
from app.models.demanda_gestao import (
    Demanda,
    DemandaStatus,
    DemandaPrioridade,
    DemandaComentario,
    DemandaEvento,
    DemandaAnexo,
)
from app.models.user import RoleEnum, User
from app.schemas.demanda_gestao import (
    DemandaCreate,
    DemandaUpdate,
    DemandaStatusUpdate,
    DemandaRead,
    DemandaListItem,
    DemandaComentarioCreate,
    DemandaComentarioRead,
    DemandaEventoRead,
    DemandaAnexoRead,
    GestaoDashboardOut,
    ItemContagem,
    ItemContagemPct,
    HomeDataOut,
)
from app.services.s3_storage import baixar_arquivo_s3, upload_fileobj, validate_upload

settings = get_settings()

router = APIRouter(prefix='/api/gestao-demandas', tags=['Demandas'])


def _verificar_acesso(demanda: Demanda, current_user: User) -> None:
    if current_user.role in (RoleEnum.ADMIN, RoleEnum.GESTOR):
        return
    if current_user.role == RoleEnum.RESPONSAVEL and demanda.responsavel_id == current_user.id:
        return
    if current_user.role == RoleEnum.SOLICITANTE and demanda.solicitante_id == current_user.id:
        return
    if current_user.role == RoleEnum.AUDITOR:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Acesso negado.')


def _aplicar_filtro_usuario(query, current_user: User):
    if current_user.role == RoleEnum.RESPONSAVEL:
        return query.where(Demanda.responsavel_id == current_user.id)
    if current_user.role == RoleEnum.SOLICITANTE:
        return query.where(Demanda.solicitante_id == current_user.id)
    return query


def _normalizar_media_dias(valor: object) -> Optional[float]:
    if valor is None:
        return None
    if isinstance(valor, timedelta):
        return round(valor.total_seconds() / 86400, 1)
    try:
        return round(float(valor), 1)
    except (TypeError, ValueError):
        return None


def _registrar_evento(
    db: Session,
    demanda_id: int,
    tipo_evento: str,
    usuario_id: int,
    campo_alterado: Optional[str] = None,
    valor_anterior: Optional[str] = None,
    valor_novo: Optional[str] = None,
):
    evento = DemandaEvento(
        demanda_id=demanda_id,
        usuario_id=usuario_id,
        tipo_evento=tipo_evento,
        campo_alterado=campo_alterado,
        valor_anterior=valor_anterior,
        valor_novo=valor_novo,
    )
    db.add(evento)
    return evento


def _buscar_anexo(db: Session, demanda_id: int, anexo_id: int) -> DemandaAnexo:
    anexo = db.scalar(select(DemandaAnexo).where(DemandaAnexo.id == anexo_id, DemandaAnexo.demanda_id == demanda_id))
    if not anexo:
        raise HTTPException(status_code=404, detail='Anexo não encontrado.')
    return anexo


def _gerar_codigo(db: Session) -> str:
    # Busca o último código
    ultimo = db.scalar(select(Demanda.codigo).order_by(desc(Demanda.id)).limit(1))
    if not ultimo:
        return "DEM-000001"
    
    try:
        num = int(ultimo.split('-')[1])
        novo_num = num + 1
        return f"DEM-{novo_num:06d}"
    except (IndexError, ValueError):
        return "DEM-000001"


def _buscar_demanda_com_relacoes(db: Session, demanda_id: int) -> Optional[Demanda]:
    return db.scalar(
        select(Demanda)
        .options(
            selectinload(Demanda.solicitante),
            selectinload(Demanda.responsavel),
            selectinload(Demanda.parent_demanda),
            selectinload(Demanda.subdemandas).selectinload(Demanda.solicitante),
            selectinload(Demanda.subdemandas).selectinload(Demanda.responsavel),
        )
        .where(Demanda.id == demanda_id)
    )


def _validar_parent_demanda(
    db: Session,
    parent_demanda_id: Optional[int],
    current_demanda_id: Optional[int] = None,
) -> Optional[Demanda]:
    if parent_demanda_id is None:
        return None

    parent_demanda = db.get(Demanda, parent_demanda_id)
    if not parent_demanda:
        raise HTTPException(status_code=404, detail='Demanda pai nao encontrada.')
    if current_demanda_id is not None and parent_demanda_id == current_demanda_id:
        raise HTTPException(status_code=400, detail='Uma demanda nao pode ser vinculada a si mesma.')
    if parent_demanda.parent_demanda_id is not None:
        raise HTTPException(status_code=400, detail='Subdemanda nao pode ser vinculada a outra subdemanda.')
    return parent_demanda


def _serializar_demanda_list_item(item: Demanda) -> DemandaListItem:
    hoje = date.today()
    atraso = None
    if item.prazo and item.prazo < hoje and item.status not in [DemandaStatus.concluida, DemandaStatus.cancelada]:
        atraso = (hoje - item.prazo).days

    return DemandaListItem(
        id=item.id,
        codigo=item.codigo,
        titulo=item.titulo,
        parent_demanda_id=item.parent_demanda_id,
        solicitante_nome=item.solicitante.nome if item.solicitante else None,
        responsavel_nome=item.responsavel.nome if item.responsavel else None,
        prioridade=item.prioridade,
        status=item.status,
        prazo=item.prazo,
        atraso=atraso,
        total_subdemandas=len(item.subdemandas) if hasattr(item, 'subdemandas') and item.subdemandas is not None else 0,
    )


def _serializar_demanda_read(item: Demanda) -> DemandaRead:
    res = DemandaRead.model_validate(item)
    res.solicitante_nome = item.solicitante.nome if item.solicitante else None
    res.responsavel_nome = item.responsavel.nome if item.responsavel else None
    res.parent_titulo = item.parent_demanda.titulo if item.parent_demanda else None
    res.subdemandas = [
        _serializar_demanda_list_item(subdemanda)
        for subdemanda in sorted(item.subdemandas, key=lambda sub: sub.criado_em, reverse=True)
    ]
    return res


@router.get('', response_model=List[DemandaListItem])
def listar_demandas(
    status: Optional[DemandaStatus] = Query(None),
    prioridade: Optional[DemandaPrioridade] = Query(None),
    responsavel_id: Optional[int] = Query(None),
    solicitante_id: Optional[int] = Query(None),
    parent_demanda_id: Optional[int] = Query(None),
    setor: Optional[str] = Query(None),
    atrasadas: Optional[bool] = Query(None),
    busca: Optional[str] = Query(None),
    incluir_subdemandas: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[DemandaListItem]:
    query = select(Demanda).options(
        selectinload(Demanda.solicitante),
        selectinload(Demanda.responsavel),
        selectinload(Demanda.subdemandas),
    )

    # Filtro por RBAC
    if current_user.role == RoleEnum.RESPONSAVEL:
        query = query.where(Demanda.responsavel_id == current_user.id)
    elif current_user.role == RoleEnum.SOLICITANTE:
        query = query.where(Demanda.solicitante_id == current_user.id)

    if not incluir_subdemandas:
        if parent_demanda_id is None:
            query = query.where(Demanda.parent_demanda_id.is_(None))
        else:
            query = query.where(Demanda.parent_demanda_id == parent_demanda_id)

    # Filtros dinâmicos
    if status:
        query = query.where(Demanda.status == status)
    if prioridade:
        query = query.where(Demanda.prioridade == prioridade)
    if responsavel_id:
        query = query.where(Demanda.responsavel_id == responsavel_id)
    if solicitante_id:
        query = query.where(Demanda.solicitante_id == solicitante_id)
    if setor:
        query = query.where(Demanda.setor.ilike(f"%{setor}%"))
    
    if atrasadas:
        hoje = date.today()
        query = query.where(
            Demanda.prazo < hoje,
            Demanda.status.notin_([DemandaStatus.concluida, DemandaStatus.cancelada])
        )

    if busca:
        query = query.where(
            or_(
                Demanda.titulo.ilike(f"%{busca}%"),
                Demanda.codigo.ilike(f"%{busca}%"),
                Demanda.descricao.ilike(f"%{busca}%")
            )
        )

    query = query.order_by(desc(Demanda.criado_em))
    
    db_items = db.scalars(query).all()
    return [_serializar_demanda_list_item(item) for item in db_items]


@router.post('', response_model=DemandaRead, status_code=status.HTTP_201_CREATED)
def criar_demanda(
    body: DemandaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DemandaRead:
    # Apenas admin, gestor ou solicitante podem criar
    if current_user.role not in (RoleEnum.ADMIN, RoleEnum.GESTOR, RoleEnum.SOLICITANTE):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Não permitido.')

    codigo = _gerar_codigo(db)
    parent_demanda = _validar_parent_demanda(db, body.parent_demanda_id)
    
    demanda = Demanda(
        codigo=codigo,
        titulo=body.titulo,
        descricao=body.descricao,
        solicitante_id=body.solicitante_id or current_user.id,
        responsavel_id=body.responsavel_id,
        parent_demanda_id=parent_demanda.id if parent_demanda else None,
        setor=body.setor,
        prioridade=body.prioridade,
        status=DemandaStatus.nova,
        prazo=body.prazo,
        data_abertura=date.today(),
    )
    db.add(demanda)
    db.flush()

    _registrar_evento(db, demanda.id, "criacao", current_user.id)
    
    db.commit()
    demanda = _buscar_demanda_com_relacoes(db, demanda.id)
    if not demanda:
        raise HTTPException(status_code=404, detail='Demanda nÃ£o encontrada.')
    return _serializar_demanda_read(demanda)


@router.get('/{demanda_id}', response_model=DemandaRead)
def obter_demanda(
    demanda_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DemandaRead:
    demanda = _buscar_demanda_com_relacoes(db, demanda_id)
    if not demanda:
        raise HTTPException(status_code=404, detail='Demanda não encontrada.')
    
    _verificar_acesso(demanda, current_user)
    
    return _serializar_demanda_read(demanda)


@router.put('/{demanda_id}', response_model=DemandaRead)
def atualizar_demanda(
    demanda_id: int,
    body: DemandaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DemandaRead:
    demanda = _buscar_demanda_com_relacoes(db, demanda_id)
    if not demanda:
        raise HTTPException(status_code=404, detail='Demanda não encontrada.')
    
    _verificar_acesso(demanda, current_user)
    
    # Apenas admin ou gestor podem editar campos principais
    if current_user.role not in (RoleEnum.ADMIN, RoleEnum.GESTOR):
        # Responsável pode editar se for atribuída a ele? O prompt diz:
        # "responsavel: vê demandas atribuídas a ele e pode atualizar andamento/status conforme regra"
        # "gestor: vê todas as demandas, edita e atribui responsável"
        # Vou restringir edição de campos principais a admin/gestor por enquanto, ou permitir se for o responsável?
        # Vou seguir o prompt: gestor edita.
        raise HTTPException(status_code=403, detail='Apenas gestores podem editar dados da demanda.')

    dados = body.model_dump(exclude_unset=True)
    if 'parent_demanda_id' in dados:
        parent_demanda = _validar_parent_demanda(db, dados['parent_demanda_id'], current_demanda_id=demanda_id)
        dados['parent_demanda_id'] = parent_demanda.id if parent_demanda else None
    for campo, valor_novo in dados.items():
        valor_antigo = getattr(demanda, campo)
        if valor_antigo != valor_novo:
            _registrar_evento(
                db, 
                demanda.id, 
                "alteracao_campo", 
                current_user.id, 
                campo_alterado=campo, 
                valor_anterior=str(valor_antigo), 
                valor_novo=str(valor_novo)
            )
            setattr(demanda, campo, valor_novo)
            
    db.commit()
    demanda = _buscar_demanda_com_relacoes(db, demanda.id)
    if not demanda:
        raise HTTPException(status_code=404, detail='Demanda nÃ£o encontrada.')
    return _serializar_demanda_read(demanda)


@router.patch('/{demanda_id}/status', response_model=DemandaRead)
def alterar_status(
    demanda_id: int,
    body: DemandaStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DemandaRead:
    demanda = db.get(Demanda, demanda_id)
    if not demanda:
        raise HTTPException(status_code=404, detail='Demanda não encontrada.')
    
    _verificar_acesso(demanda, current_user)
    
    # Regra de status:
    # Se status for concluida, preencher data_conclusao.
    # Se status for cancelada, exigir motivo_cancelamento.
    
    if body.status == DemandaStatus.cancelada and not body.motivo_cancelamento:
        raise HTTPException(status_code=400, detail='Motivo de cancelamento obrigatório.')

    old_status = demanda.status
    demanda.status = body.status
    
    if body.status == DemandaStatus.concluida:
        demanda.data_conclusao = date.today()
    elif body.status == DemandaStatus.cancelada:
        demanda.motivo_cancelamento = body.motivo_cancelamento
    
    _registrar_evento(
        db, 
        demanda.id, 
        "mudanca_status", 
        current_user.id, 
        campo_alterado="status", 
        valor_anterior=old_status.value, 
        valor_novo=body.status.value
    )
    
    db.commit()
    db.refresh(demanda)
    
    res = DemandaRead.model_validate(demanda)
    res.solicitante_nome = demanda.solicitante.nome if demanda.solicitante else None
    res.responsavel_nome = demanda.responsavel.nome if demanda.responsavel else None
    return res


@router.delete('/{demanda_id}', status_code=status.HTTP_204_NO_CONTENT)
def excluir_demanda(
    demanda_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (RoleEnum.ADMIN, RoleEnum.GESTOR):
        raise HTTPException(status_code=403, detail='Permissão insuficiente.')
    
    demanda = db.get(Demanda, demanda_id)
    if not demanda:
        raise HTTPException(status_code=404, detail='Demanda não encontrada.')
    
    db.delete(demanda)
    db.commit()


@router.get('/{demanda_id}/comentarios', response_model=List[DemandaComentarioRead])
def listar_comentarios(
    demanda_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[DemandaComentarioRead]:
    demanda = db.get(Demanda, demanda_id)
    if not demanda:
        raise HTTPException(status_code=404, detail='Demanda não encontrada.')
    _verificar_acesso(demanda, current_user)
    
    comentarios = db.scalars(
        select(DemandaComentario)
        .options(selectinload(DemandaComentario.usuario))
        .where(DemandaComentario.demanda_id == demanda_id)
        .order_by(desc(DemandaComentario.criado_em))
    ).all()
    
    res = []
    for c in comentarios:
        item = DemandaComentarioRead.model_validate(c)
        item.usuario_nome = c.usuario.nome if c.usuario else None
        res.append(item)
    return res


@router.post('/{demanda_id}/comentarios', response_model=DemandaComentarioRead)
def criar_comentario(
    demanda_id: int,
    body: DemandaComentarioCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DemandaComentarioRead:
    demanda = db.get(Demanda, demanda_id)
    if not demanda:
        raise HTTPException(status_code=404, detail='Demanda não encontrada.')
    _verificar_acesso(demanda, current_user)
    
    comentario = DemandaComentario(
        demanda_id=demanda_id,
        usuario_id=current_user.id,
        comentario=body.comentario
    )
    db.add(comentario)
    
    _registrar_evento(db, demanda_id, "comentario", current_user.id)
    
    db.commit()
    db.refresh(comentario)
    
    item = DemandaComentarioRead.model_validate(comentario)
    item.usuario_nome = current_user.nome
    return item


@router.get('/{demanda_id}/eventos', response_model=List[DemandaEventoRead])
def listar_eventos(
    demanda_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[DemandaEventoRead]:
    demanda = db.get(Demanda, demanda_id)
    if not demanda:
        raise HTTPException(status_code=404, detail='Demanda não encontrada.')
    _verificar_acesso(demanda, current_user)
    
    eventos = db.scalars(
        select(DemandaEvento)
        .options(selectinload(DemandaEvento.usuario))
        .where(DemandaEvento.demanda_id == demanda_id)
        .order_by(desc(DemandaEvento.criado_em))
    ).all()
    
    res = []
    for e in eventos:
        item = DemandaEventoRead.model_validate(e)
        item.usuario_nome = e.usuario.nome if e.usuario else None
        res.append(item)
    return res


@router.post('/{demanda_id}/anexos', response_model=DemandaAnexoRead)
async def upload_anexo(
    demanda_id: int,
    file: UploadFile = File(...),
    observacoes: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DemandaAnexoRead:
    demanda = db.get(Demanda, demanda_id)
    if not demanda:
        raise HTTPException(status_code=404, detail='Demanda não encontrada.')
    _verificar_acesso(demanda, current_user)
    
    # Upload para S3
    import io
    content = await file.read()

    try:
        validate_upload(file.filename or '', len(content), file.content_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    key = f"demandas/{demanda_id}/{datetime.now().timestamp()}_{file.filename}"

    try:
        file_obj = io.BytesIO(content)
        upload_fileobj(file_obj, key, file.content_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no upload: {str(e)}")
        
    anexo = DemandaAnexo(
        demanda_id=demanda_id,
        usuario_id=current_user.id,
        nome_arquivo=file.filename,
        content_type=file.content_type,
        tamanho=len(content),
        storage_key=key,
        observacoes=observacoes
    )
    db.add(anexo)
    
    _registrar_evento(db, demanda_id, "upload_anexo", current_user.id, valor_novo=file.filename)
    
    db.commit()
    db.refresh(anexo)
    
    item = DemandaAnexoRead.model_validate(anexo)
    item.usuario_nome = current_user.nome
    return item


@router.get('/{demanda_id}/anexos', response_model=List[DemandaAnexoRead])
def listar_anexos(
    demanda_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[DemandaAnexoRead]:
    demanda = db.get(Demanda, demanda_id)
    if not demanda:
        raise HTTPException(status_code=404, detail='Demanda não encontrada.')
    _verificar_acesso(demanda, current_user)
    
    anexos = db.scalars(
        select(DemandaAnexo)
        .options(selectinload(DemandaAnexo.usuario))
        .where(DemandaAnexo.demanda_id == demanda_id)
        .order_by(desc(DemandaAnexo.criado_em))
    ).all()
    
    res = []
    for a in anexos:
        item = DemandaAnexoRead.model_validate(a)
        item.usuario_nome = a.usuario.nome if a.usuario else None
        # Opcional: injetar URL temporária se necessário, mas o schema não tem esse campo.
        res.append(item)
    return res


@router.get('/{demanda_id}/anexos/{anexo_id}/download')
def baixar_anexo(
    demanda_id: int,
    anexo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    demanda = db.get(Demanda, demanda_id)
    if not demanda:
        raise HTTPException(status_code=404, detail='Demanda não encontrada.')
    _verificar_acesso(demanda, current_user)

    anexo = _buscar_anexo(db, demanda_id, anexo_id)
    s3_uri = f's3://{settings.S3_BUCKET}/{anexo.storage_key}'

    try:
        conteudo, content_type = baixar_arquivo_s3(s3_uri)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Erro ao baixar anexo: {exc}') from exc

    nome_arquivo = anexo.nome_arquivo or f'anexo-{anexo.id}'
    nome_codificado = quote(nome_arquivo)
    headers = {'Content-Disposition': f"attachment; filename*=UTF-8''{nome_codificado}"}
    return Response(content=conteudo, media_type=content_type or 'application/octet-stream', headers=headers)


@router.get('/dashboard/resumo', response_model=GestaoDashboardOut)
def obter_dashboard_resumo(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GestaoDashboardOut:
    # Lógica de dashboard conforme item 8
    
    query_base = select(Demanda)
    if current_user.role == RoleEnum.RESPONSAVEL:
        query_base = query_base.where(Demanda.responsavel_id == current_user.id)
    elif current_user.role == RoleEnum.SOLICITANTE:
        query_base = query_base.where(Demanda.solicitante_id == current_user.id)
        
    total_abertas = db.scalar(
        _aplicar_filtro_usuario(select(func.count(Demanda.id)), current_user)
        .where(
            Demanda.parent_demanda_id.is_(None),
            Demanda.status.notin_([DemandaStatus.concluida, DemandaStatus.cancelada]),
        )
    ) or 0
    
    hoje = date.today()
    total_atrasadas = db.scalar(
        _aplicar_filtro_usuario(select(func.count(Demanda.id)), current_user)
        .where(
            Demanda.parent_demanda_id.is_(None),
            Demanda.prazo < hoje,
            Demanda.status.notin_([DemandaStatus.concluida, DemandaStatus.cancelada])
        )
    ) or 0
    
    primeiro_dia_mes = hoje.replace(day=1)
    total_concluidas_mes = db.scalar(
        _aplicar_filtro_usuario(select(func.count(Demanda.id)), current_user)
        .where(
            Demanda.parent_demanda_id.is_(None),
            Demanda.status == DemandaStatus.concluida,
            Demanda.data_conclusao >= primeiro_dia_mes
        )
    ) or 0
    
    # Totais por status
    status_rows = db.execute(
        _aplicar_filtro_usuario(select(Demanda.status, func.count(Demanda.id)), current_user)
        .where(Demanda.parent_demanda_id.is_(None))
        .group_by(Demanda.status)
    ).all()
    total_geral = sum(r[1] for r in status_rows) or 1
    total_por_status = [
        ItemContagemPct(label=r[0].value, valor=r[1], pct=round(r[1]*100/total_geral, 1))
        for r in status_rows
    ]
    
    # Totais por prioridade
    prio_rows = db.execute(
        _aplicar_filtro_usuario(select(Demanda.prioridade, func.count(Demanda.id)), current_user)
        .where(Demanda.parent_demanda_id.is_(None))
        .group_by(Demanda.prioridade)
    ).all()
    total_por_prioridade = [
        ItemContagemPct(label=r[0].value, valor=r[1], pct=round(r[1]*100/total_geral, 1))
        for r in prio_rows
    ]
    
    # Totais por responsável
    resp_rows = db.execute(
        _aplicar_filtro_usuario(select(User.nome, func.count(Demanda.id)), current_user)
        .join(User, Demanda.responsavel_id == User.id)
        .where(Demanda.parent_demanda_id.is_(None))
        .group_by(User.nome)
    ).all()
    total_por_responsavel = [ItemContagem(label=r[0], valor=r[1]) for r in resp_rows]
    
    # Tempo médio de conclusão
    tempo_medio = db.scalar(
        _aplicar_filtro_usuario(select(func.avg(Demanda.data_conclusao - Demanda.data_abertura)), current_user)
        .where(Demanda.parent_demanda_id.is_(None), Demanda.status == DemandaStatus.concluida)
    )
    
    # SLA cumprido %
    total_concluidas = db.scalar(
        _aplicar_filtro_usuario(select(func.count(Demanda.id)), current_user)
        .where(Demanda.parent_demanda_id.is_(None), Demanda.status == DemandaStatus.concluida)
    ) or 0
    if total_concluidas > 0:
        concluidas_no_prazo = db.scalar(
            _aplicar_filtro_usuario(select(func.count(Demanda.id)), current_user)
            .where(
                Demanda.parent_demanda_id.is_(None),
                Demanda.status == DemandaStatus.concluida,
                Demanda.data_conclusao <= Demanda.prazo
            )
        ) or 0
        sla_percent = round(concluidas_no_prazo * 100 / total_concluidas, 1)
    else:
        sla_percent = 100.0
        
    return GestaoDashboardOut(
        total_abertas=total_abertas,
        total_atrasadas=total_atrasadas,
        total_concluidas_mes=total_concluidas_mes,
        total_por_status=total_por_status,
        total_por_prioridade=total_por_prioridade,
        total_por_responsavel=total_por_responsavel,
        tempo_medio_conclusao=_normalizar_media_dias(tempo_medio),
        sla_cumprido_percentual=sla_percent
    )


@router.get('/dashboard/home', response_model=HomeDataOut)
@router.get('/home', response_model=HomeDataOut)
def obter_home(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> HomeDataOut:
    # 1. Obter resumo (Dashboard)
    resumo = obter_dashboard_resumo(db, current_user)
    
    _opts = [selectinload(Demanda.solicitante), selectinload(Demanda.responsavel)]

    # 2. Demandas Atrasadas (Top 5)
    hoje = date.today()
    atrasadas_db = db.scalars(
        select(Demanda)
        .options(*_opts)
        .where(
            Demanda.parent_demanda_id.is_(None),
            Demanda.prazo < hoje,
            Demanda.status.notin_([DemandaStatus.concluida, DemandaStatus.cancelada])
        )
        .order_by(Demanda.prazo.asc())
        .limit(5)
    ).all()

    atrasadas = []
    for d in atrasadas_db:
        item = DemandaListItem.model_validate(d)
        item.solicitante_nome = d.solicitante.nome if d.solicitante else None
        item.responsavel_nome = d.responsavel.nome if d.responsavel else None
        item.atraso = (hoje - d.prazo).days if d.prazo else 0
        atrasadas.append(item)

    # 3. Minhas Demandas (Top 5 em andamento)
    minhas_db = db.scalars(
        select(Demanda)
        .options(*_opts)
        .where(
            Demanda.parent_demanda_id.is_(None),
            Demanda.responsavel_id == current_user.id,
            Demanda.status.notin_([DemandaStatus.concluida, DemandaStatus.cancelada])
        )
        .order_by(Demanda.prioridade.desc(), Demanda.prazo.asc())
        .limit(5)
    ).all()

    minhas_demandas = []
    for d in minhas_db:
        item = DemandaListItem.model_validate(d)
        item.solicitante_nome = d.solicitante.nome if d.solicitante else None
        item.responsavel_nome = d.responsavel.nome if d.responsavel else None
        if d.prazo and d.prazo < hoje:
            item.atraso = (hoje - d.prazo).days
        minhas_demandas.append(item)

    # 4. Demandas Recentes (Top 5 criadas)
    recentes_db = db.scalars(
        select(Demanda)
        .options(*_opts)
        .where(Demanda.parent_demanda_id.is_(None))
        .order_by(desc(Demanda.criado_em))
        .limit(5)
    ).all()

    recentes = []
    for d in recentes_db:
        item = DemandaListItem.model_validate(d)
        item.solicitante_nome = d.solicitante.nome if d.solicitante else None
        item.responsavel_nome = d.responsavel.nome if d.responsavel else None
        recentes.append(item)
        
    return HomeDataOut(
        resumo=resumo,
        atrasadas=atrasadas,
        minhas_demandas=minhas_demandas,
        recentes=recentes
    )

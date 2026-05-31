from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.demanda_gestao import (
    DemandaAnaliseMetodo,
    DemandaAnaliseStatus,
    DemandaPrioridade,
    DemandaStatus,
)


class DemandaComentarioCreate(BaseModel):
    comentario: str = Field(min_length=1)


class DemandaComentarioRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    demanda_id: int
    usuario_id: Optional[int]
    comentario: str
    criado_em: datetime
    usuario_nome: Optional[str] = None


class DemandaEventoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    demanda_id: int
    usuario_id: Optional[int]
    tipo_evento: str
    campo_alterado: Optional[str]
    valor_anterior: Optional[str]
    valor_novo: Optional[str]
    criado_em: datetime
    usuario_nome: Optional[str] = None


class DemandaAnexoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    demanda_id: int
    usuario_id: Optional[int]
    nome_arquivo: str
    content_type: Optional[str]
    tamanho: Optional[int]
    storage_key: str
    observacoes: Optional[str] = None
    criado_em: datetime
    usuario_nome: Optional[str] = None


class DemandaAnaliseCampoWrite(BaseModel):
    chave: str = Field(min_length=1, max_length=100)
    valor: str | int | float | bool | None = None
    ordem: int = Field(default=0, ge=0)


class DemandaAnaliseCampoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    analise_id: int
    chave: str
    valor: Optional[str]
    ordem: int


class DemandaAnaliseCreate(BaseModel):
    metodo: DemandaAnaliseMetodo
    problema: Optional[str] = None
    causa_raiz: Optional[str] = None
    status: DemandaAnaliseStatus = DemandaAnaliseStatus.rascunho
    responsavel_id: Optional[int] = None
    campos: List[DemandaAnaliseCampoWrite] = Field(default_factory=list)


class DemandaAnaliseUpdate(BaseModel):
    problema: Optional[str] = None
    causa_raiz: Optional[str] = None
    status: Optional[DemandaAnaliseStatus] = None
    responsavel_id: Optional[int] = None
    campos: List[DemandaAnaliseCampoWrite] | None = None


class DemandaAnaliseStatusUpdate(BaseModel):
    status: DemandaAnaliseStatus


class DemandaAnaliseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    demanda_id: int
    metodo: DemandaAnaliseMetodo
    problema: Optional[str]
    causa_raiz: Optional[str]
    status: DemandaAnaliseStatus
    responsavel_id: Optional[int]
    criado_em: datetime
    atualizado_em: datetime
    responsavel_nome: Optional[str] = None
    campos: List[DemandaAnaliseCampoRead] = Field(default_factory=list)
    campos_map: dict[str, Optional[str]] = Field(default_factory=dict)
    pontuacao_total: Optional[int] = None
    classificacao: Optional[str] = None


class DemandaCreate(BaseModel):
    titulo: str = Field(min_length=3, max_length=255)
    descricao: Optional[str] = None
    solicitante_id: Optional[int] = None
    responsavel_id: Optional[int] = None
    parent_demanda_id: Optional[int] = None
    setor: Optional[str] = None
    prioridade: DemandaPrioridade = DemandaPrioridade.media
    prazo: Optional[date] = None


class DemandaUpdate(BaseModel):
    titulo: Optional[str] = Field(default=None, min_length=3, max_length=255)
    descricao: Optional[str] = None
    solicitante_id: Optional[int] = None
    responsavel_id: Optional[int] = None
    parent_demanda_id: Optional[int] = None
    setor: Optional[str] = None
    prioridade: Optional[DemandaPrioridade] = None
    prazo: Optional[date] = None
    data_conclusao: Optional[date] = None
    motivo_cancelamento: Optional[str] = None


class DemandaStatusUpdate(BaseModel):
    status: DemandaStatus
    motivo_cancelamento: Optional[str] = None


class DemandaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo: str
    titulo: str
    descricao: Optional[str]
    solicitante_id: Optional[int]
    responsavel_id: Optional[int]
    parent_demanda_id: Optional[int]
    setor: Optional[str]
    prioridade: DemandaPrioridade
    status: DemandaStatus
    prazo: Optional[date]
    data_abertura: date
    data_conclusao: Optional[date]
    motivo_cancelamento: Optional[str]
    criado_em: datetime
    atualizado_em: datetime
    
    solicitante_nome: Optional[str] = None
    responsavel_nome: Optional[str] = None
    parent_titulo: Optional[str] = None
    subdemandas: List['DemandaListItem'] = Field(default_factory=list)


class DemandaListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo: str
    titulo: str
    parent_demanda_id: Optional[int] = None
    solicitante_nome: Optional[str] = None
    responsavel_nome: Optional[str] = None
    prioridade: DemandaPrioridade
    status: DemandaStatus
    prazo: Optional[date]
    atraso: Optional[int] = None  # dias de atraso
    total_subdemandas: int = 0


class ItemContagem(BaseModel):
    label: str
    valor: int


class ItemContagemPct(BaseModel):
    label: str
    valor: int
    pct: float


class GestaoDashboardOut(BaseModel):
    total_abertas: int
    total_atrasadas: int
    total_concluidas_mes: int
    total_por_status: list[ItemContagemPct]
    total_por_prioridade: list[ItemContagemPct]
    total_por_responsavel: list[ItemContagem]
    tempo_medio_conclusao: Optional[float]
    sla_cumprido_percentual: float


class HomeDataOut(BaseModel):
    resumo: GestaoDashboardOut
    atrasadas: List[DemandaListItem]
    minhas_demandas: List[DemandaListItem]
    recentes: List[DemandaListItem]


DemandaRead.model_rebuild()

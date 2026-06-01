from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.project import AtividadeStatusEnum, ProjetoPrioridadeEnum, ProjetoStatusEnum, TarefaStatusEnum, DemandaHistoricoTipoEnum


PROJETO_STATUS_LABELS = {
    ProjetoStatusEnum.planejamento: 'Planejamento',
    ProjetoStatusEnum.em_andamento: 'Em Andamento',
    ProjetoStatusEnum.pausado: 'Pausado',
    ProjetoStatusEnum.concluido: 'Concluído',
    ProjetoStatusEnum.cancelado: 'Cancelado',
}

TAREFA_STATUS_LABELS = {
    TarefaStatusEnum.nova: 'Nova',
    TarefaStatusEnum.triagem: 'Em Triagem',
    TarefaStatusEnum.aguardando_info: 'Aguardando Informações',
    TarefaStatusEnum.aprovada: 'Aprovada',
    TarefaStatusEnum.execucao: 'Em Execução',
    TarefaStatusEnum.validacao: 'Em Validação',
    TarefaStatusEnum.concluida: 'Concluída',
    TarefaStatusEnum.cancelada: 'Cancelada',
}

PRIORIDADE_PROJETO_LABELS = {
    ProjetoPrioridadeEnum.baixa: 'Baixa',
    ProjetoPrioridadeEnum.media: 'Media',
    ProjetoPrioridadeEnum.alta: 'Alta',
    ProjetoPrioridadeEnum.critica: 'Critica',
}

ATIVIDADE_STATUS_LABELS = {
    AtividadeStatusEnum.pendente: 'Pendente',
    AtividadeStatusEnum.concluida: 'Concluida',
}


class ProjetoCreate(BaseModel):
    codigo: str = Field(min_length=2, max_length=50)
    nome: str = Field(min_length=3, max_length=150)
    descricao: str | None = None
    status: ProjetoStatusEnum = ProjetoStatusEnum.planejamento
    prioridade: ProjetoPrioridadeEnum = ProjetoPrioridadeEnum.media
    progresso: int = Field(default=0, ge=0, le=100)
    data_inicio: date | None = None
    data_fim_prevista: date | None = None
    gerente_id: int | None = None


class ProjetoUpdate(BaseModel):
    codigo: str | None = Field(default=None, min_length=2, max_length=50)
    nome: str | None = Field(default=None, min_length=3, max_length=150)
    descricao: str | None = None
    status: ProjetoStatusEnum | None = None
    prioridade: ProjetoPrioridadeEnum | None = None
    progresso: int | None = Field(default=None, ge=0, le=100)
    data_inicio: date | None = None
    data_fim_prevista: date | None = None
    data_fim_real: date | None = None
    gerente_id: int | None = None


class ProjetoStatusPatch(BaseModel):
    status: ProjetoStatusEnum


class ProjetoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo: str
    nome: str
    descricao: str | None
    status: ProjetoStatusEnum
    prioridade: ProjetoPrioridadeEnum
    progresso: int
    data_inicio: date | None
    data_fim_prevista: date | None
    data_fim_real: date | None
    gerente_id: int | None
    created_by: int
    created_at: datetime
    updated_at: datetime


class TarefaProjetoCreate(BaseModel):
    titulo: str = Field(min_length=3, max_length=255)
    descricao: str | None = None
    status: TarefaStatusEnum = TarefaStatusEnum.nova
    prioridade: ProjetoPrioridadeEnum = ProjetoPrioridadeEnum.media
    responsavel_id: int | None = None
    solicitante_id: int | None = None
    setor: str | None = None
    start_date: date | None = None
    due_date: date | None = None
    estimativa_horas: int | None = Field(default=None, ge=0)
    horas_registradas: int = Field(default=0, ge=0)
    ordem: int = Field(default=0, ge=0)


class TarefaProjetoUpdate(BaseModel):
    titulo: str | None = Field(default=None, min_length=3, max_length=255)
    descricao: str | None = None
    status: TarefaStatusEnum | None = None
    prioridade: ProjetoPrioridadeEnum | None = None
    responsavel_id: int | None = None
    solicitante_id: int | None = None
    setor: str | None = None
    motivo_cancelamento: str | None = None
    start_date: date | None = None
    due_date: date | None = None
    completed_at: date | None = None
    estimativa_horas: int | None = Field(default=None, ge=0)
    horas_registradas: int | None = Field(default=None, ge=0)
    ordem: int | None = Field(default=None, ge=0)


class TarefaProjetoStatusPatch(BaseModel):
    status: TarefaStatusEnum


class TarefaProjetoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    projeto_id: int
    titulo: str
    descricao: str | None
    status: TarefaStatusEnum
    prioridade: ProjetoPrioridadeEnum
    responsavel_id: int | None
    solicitante_id: int | None
    setor: str | None
    motivo_cancelamento: str | None
    start_date: date | None
    due_date: date | None
    completed_at: date | None
    estimativa_horas: int | None
    horas_registradas: int
    ordem: int
    created_by: int
    created_at: datetime
    updated_at: datetime


class DemandaHistoricoCreate(BaseModel):
    tipo: DemandaHistoricoTipoEnum
    conteudo: str
    old_status: str | None = None
    new_status: str | None = None


class DemandaHistoricoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    demanda_id: int
    tipo: DemandaHistoricoTipoEnum
    conteudo: str
    old_status: str | None
    new_status: str | None
    created_by: int | None
    created_at: datetime


class UsuarioMinimoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nome: str


class AtividadeSubdemandaCreate(BaseModel):
    titulo: str = Field(min_length=2, max_length=255)
    descricao: str | None = None
    setor: str | None = Field(default=None, max_length=120)
    subatividade: str | None = Field(default=None, max_length=120)
    status: AtividadeStatusEnum = AtividadeStatusEnum.pendente
    ordem: int = Field(default=0, ge=0)
    responsavel_id: int | None = None


class AtividadeSubdemandaUpdate(BaseModel):
    titulo: str | None = Field(default=None, min_length=2, max_length=255)
    descricao: str | None = None
    setor: str | None = Field(default=None, max_length=120)
    subatividade: str | None = Field(default=None, max_length=120)
    status: AtividadeStatusEnum | None = None
    ordem: int | None = Field(default=None, ge=0)
    responsavel_id: int | None = None


class AtividadeSubdemandaStatusPatch(BaseModel):
    status: AtividadeStatusEnum


class AtividadeSubdemandaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tarefa_id: int
    titulo: str
    descricao: str | None
    setor: str | None
    subatividade: str | None
    status: AtividadeStatusEnum
    ordem: int
    responsavel_id: int | None
    responsavel: UsuarioMinimoOut | None = None
    created_by: int
    created_at: datetime
    updated_at: datetime


class AtividadeSetorConfigCreate(BaseModel):
    nome: str = Field(min_length=2, max_length=120)
    ativo: bool = True
    ordem: int = Field(default=0, ge=0)


class AtividadeSetorConfigUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=120)
    ativo: bool | None = None
    ordem: int | None = Field(default=None, ge=0)


class AtividadeSubatividadeConfigCreate(BaseModel):
    setor_id: int
    nome: str = Field(min_length=2, max_length=120)
    ativo: bool = True
    ordem: int = Field(default=0, ge=0)


class AtividadeSubatividadeConfigUpdate(BaseModel):
    setor_id: int | None = None
    nome: str | None = Field(default=None, min_length=2, max_length=120)
    ativo: bool | None = None
    ordem: int | None = Field(default=None, ge=0)


class AtividadeSubatividadeConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    setor_id: int
    nome: str
    ativo: bool
    ordem: int
    created_at: datetime
    updated_at: datetime


class AtividadeSetorConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nome: str
    ativo: bool
    ordem: int
    created_at: datetime
    updated_at: datetime
    subatividades: list[AtividadeSubatividadeConfigOut] = Field(default_factory=list)


class ResumoProjetosStatusItem(BaseModel):
    status: ProjetoStatusEnum
    label: str
    quantidade: int


class ResumoTarefasStatusItem(BaseModel):
    status: TarefaStatusEnum
    label: str
    quantidade: int


class ProjetosDashboardOut(BaseModel):
    total_projetos: int
    projetos_atrasados: int
    tarefas_atrasadas: int
    projetos_por_status: list[ResumoProjetosStatusItem]
    tarefas_por_status: list[ResumoTarefasStatusItem]

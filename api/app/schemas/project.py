from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.project import ProjetoPrioridadeEnum, ProjetoStatusEnum, TarefaStatusEnum


PROJETO_STATUS_LABELS = {
    ProjetoStatusEnum.planejamento: 'Planejamento',
    ProjetoStatusEnum.em_andamento: 'Em Andamento',
    ProjetoStatusEnum.pausado: 'Pausado',
    ProjetoStatusEnum.concluido: 'Concluido',
    ProjetoStatusEnum.cancelado: 'Cancelado',
}

TAREFA_STATUS_LABELS = {
    TarefaStatusEnum.backlog: 'Backlog',
    TarefaStatusEnum.a_fazer: 'A Fazer',
    TarefaStatusEnum.em_andamento: 'Em Andamento',
    TarefaStatusEnum.em_revisao: 'Em Revisao',
    TarefaStatusEnum.concluida: 'Concluida',
    TarefaStatusEnum.bloqueada: 'Bloqueada',
}

PRIORIDADE_PROJETO_LABELS = {
    ProjetoPrioridadeEnum.baixa: 'Baixa',
    ProjetoPrioridadeEnum.media: 'Media',
    ProjetoPrioridadeEnum.alta: 'Alta',
    ProjetoPrioridadeEnum.critica: 'Critica',
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
    status: TarefaStatusEnum = TarefaStatusEnum.backlog
    prioridade: ProjetoPrioridadeEnum = ProjetoPrioridadeEnum.media
    responsavel_id: int | None = None
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
    start_date: date | None
    due_date: date | None
    completed_at: date | None
    estimativa_horas: int | None
    horas_registradas: int
    ordem: int
    created_by: int
    created_at: datetime
    updated_at: datetime


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

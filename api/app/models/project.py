import enum
from datetime import date, datetime

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ProjetoStatusEnum(str, enum.Enum):
    planejamento = 'planejamento'
    em_andamento = 'em_andamento'
    pausado = 'pausado'
    concluido = 'concluido'
    cancelado = 'cancelado'


class TarefaStatusEnum(str, enum.Enum):
    nova = 'nova'
    triagem = 'triagem'
    aguardando_info = 'aguardando_info'
    aprovada = 'aprovada'
    execucao = 'execucao'
    validacao = 'validacao'
    concluida = 'concluida'
    cancelada = 'cancelada'


class DemandaHistoricoTipoEnum(str, enum.Enum):
    comentario = 'comentario'
    status = 'status'
    anexo = 'anexo'
    sistema = 'sistema'


class ProjetoPrioridadeEnum(str, enum.Enum):
    baixa = 'baixa'
    media = 'media'
    alta = 'alta'
    critica = 'critica'


class AtividadeStatusEnum(str, enum.Enum):
    pendente = 'pendente'
    concluida = 'concluida'


class Projeto(Base):
    __tablename__ = 'projetos'
    __table_args__ = (CheckConstraint('progresso >= 0 AND progresso <= 100', name='ck_projeto_progresso_range'),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    codigo: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    nome: Mapped[str] = mapped_column(String(150), nullable=False)
    descricao: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ProjetoStatusEnum] = mapped_column(
        Enum(ProjetoStatusEnum, name='projeto_status_enum', native_enum=False),
        nullable=False,
        default=ProjetoStatusEnum.planejamento,
        server_default=ProjetoStatusEnum.planejamento.value,
    )
    prioridade: Mapped[ProjetoPrioridadeEnum] = mapped_column(
        Enum(ProjetoPrioridadeEnum, name='projeto_prioridade_enum', native_enum=False),
        nullable=False,
        default=ProjetoPrioridadeEnum.media,
        server_default=ProjetoPrioridadeEnum.media.value,
    )
    progresso: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default='0')
    data_inicio: Mapped[date | None] = mapped_column(Date, nullable=True)
    data_fim_prevista: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    data_fim_real: Mapped[date | None] = mapped_column(Date, nullable=True)
    gerente_id: Mapped[int | None] = mapped_column(ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True, index=True)
    created_by: Mapped[int] = mapped_column(ForeignKey('usuarios.id', ondelete='RESTRICT'), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    gerente = relationship('User', foreign_keys=[gerente_id], back_populates='projetos_gerenciados')
    criador = relationship('User', foreign_keys=[created_by], back_populates='projetos_criados')
    tarefas = relationship('TarefaProjeto', back_populates='projeto', cascade='all, delete-orphan')


class TarefaProjeto(Base):
    __tablename__ = 'tarefas_projeto'
    __table_args__ = (
        CheckConstraint('horas_registradas >= 0', name='ck_tarefa_horas_registradas_nonnegative'),
        CheckConstraint('estimativa_horas IS NULL OR estimativa_horas >= 0', name='ck_tarefa_estimativa_nonnegative'),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    projeto_id: Mapped[int] = mapped_column(ForeignKey('projetos.id', ondelete='CASCADE'), nullable=False, index=True)
    titulo: Mapped[str] = mapped_column(String(255), nullable=False)
    descricao: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[TarefaStatusEnum] = mapped_column(
        Enum(TarefaStatusEnum, name='demanda_status_enum', native_enum=False),
        nullable=False,
        default=TarefaStatusEnum.nova,
        server_default=TarefaStatusEnum.nova.value,
        index=True,
    )
    prioridade: Mapped[ProjetoPrioridadeEnum] = mapped_column(
        Enum(ProjetoPrioridadeEnum, name='tarefa_prioridade_enum', native_enum=False),
        nullable=False,
        default=ProjetoPrioridadeEnum.media,
        server_default=ProjetoPrioridadeEnum.media.value,
        index=True,
    )
    responsavel_id: Mapped[int | None] = mapped_column(ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True, index=True)
    solicitante_id: Mapped[int | None] = mapped_column(ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True, index=True)
    setor: Mapped[str | None] = mapped_column(String(100), nullable=True)
    motivo_cancelamento: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    completed_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    estimativa_horas: Mapped[int | None] = mapped_column(Integer, nullable=True)
    horas_registradas: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default='0')
    ordem: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default='0')
    created_by: Mapped[int] = mapped_column(ForeignKey('usuarios.id', ondelete='RESTRICT'), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    projeto = relationship('Projeto', back_populates='tarefas')
    responsavel = relationship('User', foreign_keys=[responsavel_id], back_populates='tarefas_responsavel')
    solicitante = relationship('User', foreign_keys=[solicitante_id])
    criador = relationship('User', foreign_keys=[created_by], back_populates='tarefas_criadas')
    atividades = relationship('AtividadeSubdemanda', back_populates='tarefa', cascade='all, delete-orphan')
    historico = relationship('DemandaHistorico', back_populates='demanda', cascade='all, delete-orphan')


class AtividadeSetorConfig(Base):
    __tablename__ = 'atividades_setores_config'
    __table_args__ = (
        UniqueConstraint('nome', name='uq_atividade_setor_config_nome'),
        CheckConstraint('ordem >= 0', name='ck_atividade_setor_config_ordem_nonnegative'),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nome: Mapped[str] = mapped_column(String(120), nullable=False, unique=True, index=True)
    ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default='true')
    ordem: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default='0')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    subatividades = relationship('AtividadeSubatividadeConfig', back_populates='setor', cascade='all, delete-orphan')


class AtividadeSubatividadeConfig(Base):
    __tablename__ = 'atividades_subatividades_config'
    __table_args__ = (
        UniqueConstraint('setor_id', 'nome', name='uq_atividade_subatividade_config_setor_nome'),
        CheckConstraint('ordem >= 0', name='ck_atividade_subatividade_config_ordem_nonnegative'),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    setor_id: Mapped[int] = mapped_column(ForeignKey('atividades_setores_config.id', ondelete='CASCADE'), nullable=False, index=True)
    nome: Mapped[str] = mapped_column(String(120), nullable=False)
    ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default='true')
    ordem: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default='0')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    setor = relationship('AtividadeSetorConfig', back_populates='subatividades')


class DemandaHistorico(Base):
    __tablename__ = 'demandas_historico'

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    demanda_id: Mapped[int] = mapped_column(ForeignKey('tarefas_projeto.id', ondelete='CASCADE'), nullable=False, index=True)
    tipo: Mapped[DemandaHistoricoTipoEnum] = mapped_column(
        Enum(DemandaHistoricoTipoEnum, name='demanda_historico_tipo_enum', native_enum=False),
        nullable=False
    )
    conteudo: Mapped[str] = mapped_column(Text, nullable=False)
    old_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    new_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    demanda = relationship('TarefaProjeto', back_populates='historico')
    autor = relationship('User')


class AtividadeSubdemanda(Base):
    __tablename__ = 'atividades_subdemanda'
    __table_args__ = (CheckConstraint('ordem >= 0', name='ck_atividade_subdemanda_ordem_nonnegative'),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    tarefa_id: Mapped[int] = mapped_column(ForeignKey('tarefas_projeto.id', ondelete='CASCADE'), nullable=False, index=True)
    titulo: Mapped[str] = mapped_column(String(255), nullable=False)
    descricao: Mapped[str | None] = mapped_column(Text, nullable=True)
    setor: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    subatividade: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    status: Mapped[AtividadeStatusEnum] = mapped_column(
        Enum(AtividadeStatusEnum, name='atividade_status_enum', native_enum=False),
        nullable=False,
        default=AtividadeStatusEnum.pendente,
        server_default=AtividadeStatusEnum.pendente.value,
    )
    ordem: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default='0')
    responsavel_id: Mapped[int | None] = mapped_column(ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey('usuarios.id', ondelete='RESTRICT'), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    tarefa = relationship('TarefaProjeto', back_populates='atividades')
    responsavel = relationship('User', foreign_keys=[responsavel_id])

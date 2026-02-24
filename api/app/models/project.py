import enum
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ProjetoStatusEnum(str, enum.Enum):
    planejamento = 'planejamento'
    em_andamento = 'em_andamento'
    pausado = 'pausado'
    concluido = 'concluido'
    cancelado = 'cancelado'


class TarefaStatusEnum(str, enum.Enum):
    backlog = 'backlog'
    a_fazer = 'a_fazer'
    em_andamento = 'em_andamento'
    em_revisao = 'em_revisao'
    concluida = 'concluida'
    bloqueada = 'bloqueada'


class ProjetoPrioridadeEnum(str, enum.Enum):
    baixa = 'baixa'
    media = 'media'
    alta = 'alta'
    critica = 'critica'


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
        Enum(TarefaStatusEnum, name='tarefa_status_enum', native_enum=False),
        nullable=False,
        default=TarefaStatusEnum.backlog,
        server_default=TarefaStatusEnum.backlog.value,
    )
    prioridade: Mapped[ProjetoPrioridadeEnum] = mapped_column(
        Enum(ProjetoPrioridadeEnum, name='tarefa_prioridade_enum', native_enum=False),
        nullable=False,
        default=ProjetoPrioridadeEnum.media,
        server_default=ProjetoPrioridadeEnum.media.value,
    )
    responsavel_id: Mapped[int | None] = mapped_column(ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True, index=True)
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
    criador = relationship('User', foreign_keys=[created_by], back_populates='tarefas_criadas')

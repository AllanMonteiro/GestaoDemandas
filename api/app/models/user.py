import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class RoleEnum(str, enum.Enum):
    ADMIN = 'ADMIN'
    GESTOR = 'GESTOR'
    AUDITOR = 'AUDITOR'
    RESPONSAVEL = 'RESPONSAVEL'


class User(Base):
    __tablename__ = 'usuarios'

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nome: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    role: Mapped[RoleEnum] = mapped_column(Enum(RoleEnum, name='role_enum', native_enum=False), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    evidencias_criadas = relationship('Evidencia', back_populates='criador')
    documentos_criados = relationship('DocumentoEvidencia', foreign_keys='DocumentoEvidencia.created_by', back_populates='criador')
    documentos_responsavel = relationship(
        'DocumentoEvidencia',
        foreign_keys='DocumentoEvidencia.responsavel_id',
        back_populates='responsavel',
    )
    documentos_revisados = relationship(
        'DocumentoEvidencia',
        foreign_keys='DocumentoEvidencia.revisado_por_id',
        back_populates='revisor',
    )
    monitoramentos_criados = relationship(
        'MonitoramentoCriterio',
        foreign_keys='MonitoramentoCriterio.created_by',
        back_populates='criador',
    )
    notificacoes_criadas = relationship(
        'NotificacaoMonitoramento',
        foreign_keys='NotificacaoMonitoramento.created_by',
        back_populates='criador',
    )
    notificacoes_responsavel = relationship(
        'NotificacaoMonitoramento',
        foreign_keys='NotificacaoMonitoramento.responsavel_id',
        back_populates='responsavel',
    )
    resolucoes_criadas = relationship(
        'ResolucaoNotificacao',
        foreign_keys='ResolucaoNotificacao.created_by',
        back_populates='criador',
    )
    analises_nc_criadas = relationship(
        'AnaliseNaoConformidade',
        foreign_keys='AnaliseNaoConformidade.created_by',
        back_populates='criador',
    )
    analises_nc_responsavel = relationship(
        'AnaliseNaoConformidade',
        foreign_keys='AnaliseNaoConformidade.responsavel_id',
        back_populates='responsavel',
    )
    demandas_responsavel = relationship('Demanda', back_populates='responsavel')
    projetos_criados = relationship(
        'Projeto',
        foreign_keys='Projeto.created_by',
        back_populates='criador',
    )
    projetos_gerenciados = relationship(
        'Projeto',
        foreign_keys='Projeto.gerente_id',
        back_populates='gerente',
    )
    tarefas_criadas = relationship(
        'TarefaProjeto',
        foreign_keys='TarefaProjeto.created_by',
        back_populates='criador',
    )
    tarefas_responsavel = relationship(
        'TarefaProjeto',
        foreign_keys='TarefaProjeto.responsavel_id',
        back_populates='responsavel',
    )
    logs = relationship('AuditLog', back_populates='autor')

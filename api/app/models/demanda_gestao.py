import enum
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class DemandaStatus(str, enum.Enum):
    nova = 'nova'
    em_triagem = 'em_triagem'
    aguardando_informacoes = 'aguardando_informacoes'
    aprovada = 'aprovada'
    em_execucao = 'em_execucao'
    em_validacao = 'em_validacao'
    concluida = 'concluida'
    cancelada = 'cancelada'


class DemandaPrioridade(str, enum.Enum):
    baixa = 'baixa'
    media = 'media'
    alta = 'alta'
    critica = 'critica'


class DemandaAnaliseMetodo(str, enum.Enum):
    cinco_porques = '5_PORQUES'
    quatro_w_dois_h = '4W2H'
    cinco_w_dois_h = '5W2H'
    ishikawa = 'ISHIKAWA'
    gut = 'GUT'
    esforco_impacto = 'ESFORCO_IMPACTO'
    pdca = 'PDCA'


class DemandaAnaliseStatus(str, enum.Enum):
    rascunho = 'rascunho'
    em_analise = 'em_analise'
    plano_definido = 'plano_definido'
    em_execucao = 'em_execucao'
    concluido = 'concluido'
    cancelado = 'cancelado'


class Demanda(Base):
    __tablename__ = 'demandas'

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    codigo: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    titulo: Mapped[str] = mapped_column(String(255), nullable=False)
    descricao: Mapped[str | None] = mapped_column(Text, nullable=True)
    solicitante_id: Mapped[int | None] = mapped_column(
        ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True, index=True
    )
    responsavel_id: Mapped[int | None] = mapped_column(
        ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True, index=True
    )
    parent_demanda_id: Mapped[int | None] = mapped_column(
        ForeignKey('demandas.id', ondelete='CASCADE'), nullable=True, index=True
    )
    setor: Mapped[str | None] = mapped_column(String(100), nullable=True)
    prioridade: Mapped[DemandaPrioridade] = mapped_column(
        Enum(DemandaPrioridade, name='demanda_prioridade_enum', native_enum=False),
        nullable=False,
        default=DemandaPrioridade.media,
        index=True,
    )
    status: Mapped[DemandaStatus] = mapped_column(
        Enum(DemandaStatus, name='demanda_status_enum', native_enum=False),
        nullable=False,
        default=DemandaStatus.nova,
        index=True,
    )
    prazo: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    data_abertura: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    data_conclusao: Mapped[date | None] = mapped_column(Date, nullable=True)
    motivo_cancelamento: Mapped[str | None] = mapped_column(Text, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    solicitante = relationship('User', foreign_keys=[solicitante_id], back_populates='demandas_solicitante')
    responsavel = relationship('User', foreign_keys=[responsavel_id], back_populates='demandas_responsavel')
    parent_demanda = relationship('Demanda', remote_side='Demanda.id', back_populates='subdemandas')
    subdemandas = relationship(
        'Demanda',
        back_populates='parent_demanda',
        cascade='all, delete-orphan',
    )
    comentarios = relationship('DemandaComentario', back_populates='demanda', cascade='all, delete-orphan')
    eventos = relationship('DemandaEvento', back_populates='demanda', cascade='all, delete-orphan')
    anexos = relationship('DemandaAnexo', back_populates='demanda', cascade='all, delete-orphan')
    analises = relationship('DemandaAnalise', back_populates='demanda', cascade='all, delete-orphan')


class DemandaAnalise(Base):
    __tablename__ = 'demanda_analises'

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    demanda_id: Mapped[int] = mapped_column(
        ForeignKey('demandas.id', ondelete='CASCADE'), nullable=False, index=True
    )
    metodo: Mapped[DemandaAnaliseMetodo] = mapped_column(
        Enum(DemandaAnaliseMetodo, name='demanda_analise_metodo_enum', native_enum=False),
        nullable=False,
        index=True,
    )
    problema: Mapped[str | None] = mapped_column(Text, nullable=True)
    causa_raiz: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[DemandaAnaliseStatus] = mapped_column(
        Enum(DemandaAnaliseStatus, name='demanda_analise_status_enum', native_enum=False),
        nullable=False,
        default=DemandaAnaliseStatus.rascunho,
        server_default=DemandaAnaliseStatus.rascunho.value,
        index=True,
    )
    responsavel_id: Mapped[int | None] = mapped_column(
        ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True, index=True
    )
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    demanda = relationship('Demanda', back_populates='analises')
    responsavel = relationship('User')
    campos = relationship(
        'DemandaAnaliseCampo',
        back_populates='analise',
        cascade='all, delete-orphan',
        order_by='DemandaAnaliseCampo.ordem',
    )


class DemandaAnaliseCampo(Base):
    __tablename__ = 'demanda_analise_campos'

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    analise_id: Mapped[int] = mapped_column(
        ForeignKey('demanda_analises.id', ondelete='CASCADE'), nullable=False, index=True
    )
    chave: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    valor: Mapped[str | None] = mapped_column(Text, nullable=True)
    ordem: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default='0')

    analise = relationship('DemandaAnalise', back_populates='campos')


class DemandaComentario(Base):
    __tablename__ = 'demanda_comentarios'

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    demanda_id: Mapped[int] = mapped_column(
        ForeignKey('demandas.id', ondelete='CASCADE'), nullable=False, index=True
    )
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True)
    comentario: Mapped[str] = mapped_column(Text, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    demanda = relationship('Demanda', back_populates='comentarios')
    usuario = relationship('User')


class DemandaEvento(Base):
    __tablename__ = 'demanda_eventos'

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    demanda_id: Mapped[int] = mapped_column(
        ForeignKey('demandas.id', ondelete='CASCADE'), nullable=False, index=True
    )
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True)
    tipo_evento: Mapped[str] = mapped_column(String(50), nullable=False)
    campo_alterado: Mapped[str | None] = mapped_column(String(100), nullable=True)
    valor_anterior: Mapped[str | None] = mapped_column(Text, nullable=True)
    valor_novo: Mapped[str | None] = mapped_column(Text, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    demanda = relationship('Demanda', back_populates='eventos')
    usuario = relationship('User')


class DemandaAnexo(Base):
    __tablename__ = 'demanda_anexos'

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    demanda_id: Mapped[int] = mapped_column(
        ForeignKey('demandas.id', ondelete='CASCADE'), nullable=False, index=True
    )
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True)
    nome_arquivo: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=True)
    tamanho: Mapped[int] = mapped_column(nullable=True)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    demanda = relationship('Demanda', back_populates='anexos')
    usuario = relationship('User')

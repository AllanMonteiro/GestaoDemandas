import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';

import {
  DemandaAnalise,
  api,
  DemandaAnexo,
  DemandaComentario,
  DemandaEvento,
  DemandaStatus,
  DEMANDA_STATUS_LABELS,
  getApiErrorMessage,
  PRIORIDADE_LABELS,
  ProfissionalDemanda,
} from '../api';
import DemandAnalysisSection from '../components/DemandAnalysisSection';

function getDownloadFileName(contentDisposition?: string | null, fallback?: string) {
  if (!contentDisposition) return fallback || 'anexo';
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }
  const plainMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
  return plainMatch?.[1] || fallback || 'anexo';
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('pt-BR');
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
}

function formatBytes(bytes?: number | null) {
  if (!bytes) return 'Tamanho nao informado';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TAB_LABELS = {
  resumo: 'Resumo',
  analises: 'Analise e Plano de Acao',
  comentarios: 'Comentarios',
  anexos: 'Anexos',
  historico: 'Historico',
} as const;

type TabKey = keyof typeof TAB_LABELS;

export default function DemandaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('resumo');
  const [novoComentario, setNovoComentario] = useState('');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [erro, setErro] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [observacaoAnexo, setObservacaoAnexo] = useState('');

  const { data: demanda, isLoading: loadingDemanda } = useQuery<ProfissionalDemanda>({
    queryKey: ['demanda', id],
    queryFn: async () => (await api.get(`/gestao-demandas/${id}`)).data,
  });

  const { data: comentarios } = useQuery<DemandaComentario[]>({
    queryKey: ['demanda-comentarios', id],
    queryFn: async () => (await api.get(`/gestao-demandas/${id}/comentarios`)).data,
    enabled: !!demanda,
  });

  const { data: eventos } = useQuery<DemandaEvento[]>({
    queryKey: ['demanda-eventos', id],
    queryFn: async () => (await api.get(`/gestao-demandas/${id}/eventos`)).data,
    enabled: !!demanda,
  });

  const { data: anexos } = useQuery<DemandaAnexo[]>({
    queryKey: ['demanda-anexos', id],
    queryFn: async () => (await api.get(`/gestao-demandas/${id}/anexos`)).data,
    enabled: !!demanda,
  });

  const { data: analises } = useQuery<DemandaAnalise[]>({
    queryKey: ['demanda-analises', id],
    queryFn: async () => (await api.get(`/gestao-demandas/${id}/analises`)).data,
    enabled: !!demanda,
  });

  const addComentarioMutation = useMutation({
    mutationFn: async (comentario: string) => api.post(`/gestao-demandas/${id}/comentarios`, { comentario }),
    onSuccess: () => {
      setNovoComentario('');
      setErro('');
      queryClient.invalidateQueries({ queryKey: ['demanda-comentarios', id] });
    },
    onError: (err: unknown) => {
      setErro(getApiErrorMessage(err, 'Falha ao comentar.'));
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, motivo }: { status: DemandaStatus; motivo?: string }) =>
      api.patch(`/gestao-demandas/${id}/status`, { status, motivo_cancelamento: motivo }),
    onSuccess: () => {
      setShowStatusModal(false);
      setErro('');
      queryClient.invalidateQueries({ queryKey: ['demanda', id] });
      queryClient.invalidateQueries({ queryKey: ['demanda-eventos', id] });
    },
    onError: (err: unknown) => {
      setErro(getApiErrorMessage(err, 'Falha ao alterar status.'));
    },
  });

  const updateSubdemandaStatusMutation = useMutation({
    mutationFn: async ({ subId, status }: { subId: number; status: DemandaStatus }) =>
      api.patch(`/gestao-demandas/${subId}/status`, { status }),
    onSuccess: () => {
      setErro('');
      queryClient.invalidateQueries({ queryKey: ['demanda', id] });
      queryClient.invalidateQueries({ queryKey: ['demanda-eventos', id] });
    },
    onError: (err: unknown) => {
      setErro(getApiErrorMessage(err, 'Falha ao alterar status da subdemanda.'));
    },
  });

  const uploadAnexoMutation = useMutation({
    mutationFn: async ({ file, observacoes }: { file: File; observacoes?: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (observacoes) {
        formData.append('observacoes', observacoes);
      }
      return api.post(`/gestao-demandas/${id}/anexos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      setArquivo(null);
      setObservacaoAnexo('');
      setErro('');
      queryClient.invalidateQueries({ queryKey: ['demanda-anexos', id] });
      queryClient.invalidateQueries({ queryKey: ['demanda-eventos', id] });
    },
    onError: (err: unknown) => {
      setErro(getApiErrorMessage(err, 'Falha ao enviar anexo.'));
    },
  });

  const baixarAnexo = async (anexo: DemandaAnexo) => {
    try {
      setErro('');
      const response = await api.get(`/gestao-demandas/${id}/anexos/${anexo.id}/download`, {
        responseType: 'blob',
      });
      const blobUrl = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = getDownloadFileName(response.headers['content-disposition'], anexo.nome_arquivo);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: unknown) {
      setErro(getApiErrorMessage(err, 'Falha ao baixar anexo.'));
    }
  };

  const tabCounts = useMemo(
    () => ({
      comentarios: comentarios?.length || 0,
      analises: analises?.length || 0,
      anexos: anexos?.length || 0,
      historico: eventos?.length || 0,
    }),
    [comentarios, analises, anexos, eventos]
  );

  const { subdemandasConcluidas, totalSubdemandas, percentualConclusao } = useMemo(() => {
    const list = demanda?.subdemandas || [];
    const total = list.length;
    const concluidas = list.filter((s) => s.status === 'concluida').length;
    const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0;
    return { subdemandasConcluidas: concluidas, totalSubdemandas: total, percentualConclusao: pct };
  }, [demanda?.subdemandas]);

  if (loadingDemanda) return <div className="card">Carregando detalhes...</div>;
  if (!demanda) return <div className="error">Demanda nao encontrada.</div>;

  return (
    <div className="demanda-detail-page">
      <section className="demanda-detail-hero card">
        <div className="demanda-detail-hero-main">
          <button className="demanda-detail-backlink" onClick={() => navigate('/demandas')}>
            Voltar para lista
          </button>

          <div className="demanda-detail-heading">
            <span className="demanda-detail-code">{demanda.codigo}</span>
            <h1>{demanda.titulo}</h1>
          </div>

          <div className="demanda-detail-tags">
            <span className={`badge status-${demanda.status}`}>{DEMANDA_STATUS_LABELS[demanda.status]}</span>
            <span className={`badge badge-${demanda.prioridade}`}>{PRIORIDADE_LABELS[demanda.prioridade]}</span>
            <span className="demanda-detail-soft-tag">Aberta em {formatDate(demanda.data_abertura)}</span>
          </div>

          <p className="demanda-detail-summary">
            {demanda.descricao?.trim() || 'Essa demanda ainda nao possui uma descricao detalhada.'}
          </p>
        </div>

        <div className="demanda-detail-hero-actions">
          {!demanda.parent_demanda_id && (
            <button className="btn-secondary" onClick={() => navigate(`/demandas/nova?parentId=${demanda.id}`)}>
              Nova subdemanda
            </button>
          )}
          <button className="btn-secondary" onClick={() => setShowStatusModal(true)}>
            Alterar status
          </button>
          <button className="btn-primary" onClick={() => navigate(`/demandas/${id}/editar`)}>
            Editar demanda
          </button>
        </div>
      </section>

      {erro && <div className="error">{erro}</div>}

      <div className="demanda-detail-layout">
        <div className="demanda-detail-content">
          <div className="demanda-detail-tabs">
            {(Object.keys(TAB_LABELS) as TabKey[]).map((tab) => (
              <button
                key={tab}
                className={activeTab === tab ? 'demanda-detail-tab active' : 'demanda-detail-tab'}
                onClick={() => setActiveTab(tab)}
              >
                <span>{TAB_LABELS[tab]}</span>
                {tab !== 'resumo' && <small>{tabCounts[tab]}</small>}
              </button>
            ))}
          </div>

          {activeTab === 'resumo' && (
            <section className="card demanda-detail-panel">
              <div className="demanda-detail-block">
                <h3>Descricao</h3>
                <p className="demanda-detail-copy">
                  {demanda.descricao?.trim() || 'Nenhuma descricao adicional foi registrada.'}
                </p>
              </div>

              <div className="demanda-detail-info-grid">
                <div className="demanda-detail-info-card">
                  <span>Subdemandas</span>
                  <strong>
                    {demanda.subdemandas?.length || 0}
                    {totalSubdemandas > 0 && ` (${percentualConclusao}%)`}
                  </strong>
                  {totalSubdemandas > 0 && (
                    <div style={{ marginTop: 6, background: '#e5e7eb', borderRadius: 4, height: 6, width: '100%', overflow: 'hidden' }}>
                      <div style={{ background: '#22c55e', height: '100%', width: `${percentualConclusao}%`, transition: 'width 0.3s ease' }} />
                    </div>
                  )}
                </div>
                <div className="demanda-detail-info-card">
                  <span>Setor</span>
                  <strong>{demanda.setor || '-'}</strong>
                </div>
                <div className="demanda-detail-info-card">
                  <span>Prazo</span>
                  <strong>{formatDate(demanda.prazo)}</strong>
                </div>
                <div className="demanda-detail-info-card">
                  <span>Solicitante</span>
                  <strong>{demanda.solicitante_nome || '-'}</strong>
                </div>
                <div className="demanda-detail-info-card">
                  <span>Responsavel</span>
                  <strong>{demanda.responsavel_nome || 'Nao atribuido'}</strong>
                </div>
              </div>

              {!!demanda.parent_titulo && (
                <div className="demanda-detail-block">
                  <h3>Demanda pai</h3>
                  <p className="demanda-detail-copy">{demanda.parent_titulo}</p>
                </div>
              )}

              {!demanda.parent_demanda_id && (
                <div className="demanda-detail-block">
                  <div className="demanda-detail-section-head">
                    <div>
                      <h3>Subdemandas {totalSubdemandas > 0 && `(${percentualConclusao}% concluídas)`}</h3>
                      <p>Itens derivados desta demanda principal.</p>
                    </div>
                  </div>

                  <div className="demanda-detail-list">
                    {demanda.subdemandas?.length ? (
                      demanda.subdemandas.map((subdemanda) => (
                        <article
                          key={subdemanda.id}
                          className="demanda-file-card"
                          style={{ cursor: 'pointer', gridTemplateColumns: 'auto auto 1fr auto' }}
                          onClick={() => navigate(`/demandas/${subdemanda.id}`)}
                        >
                          <input
                            type="checkbox"
                            checked={subdemanda.status === 'concluida'}
                            onChange={(e) => {
                              e.stopPropagation();
                              const newStatus: DemandaStatus = e.target.checked ? 'concluida' : 'em_execucao';
                              updateSubdemandaStatusMutation.mutate({ subId: subdemanda.id, status: newStatus });
                            }}
                            style={{ width: 18, height: 18, cursor: 'pointer' }}
                            disabled={updateSubdemandaStatusMutation.isPending}
                          />
                          <div className="demanda-file-icon">SUB</div>
                          <div className="demanda-file-body">
                            <strong>{subdemanda.codigo} - {subdemanda.titulo}</strong>
                            <span>
                              {DEMANDA_STATUS_LABELS[subdemanda.status]} | {PRIORIDADE_LABELS[subdemanda.prioridade]} | Prazo:{' '}
                              {formatDate(subdemanda.prazo)}
                            </span>
                          </div>
                          <button
                            className="btn-secondary btn-sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/demandas/${subdemanda.id}`);
                            }}
                          >
                            Abrir
                          </button>
                        </article>
                      ))
                    ) : (
                      <div className="demanda-detail-empty">Nenhuma subdemanda vinculada a esta demanda.</div>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}

          {activeTab === 'comentarios' && (
            <section className="card demanda-detail-panel">
              <div className="demanda-detail-compose">
                <div>
                  <h3>Comentarios</h3>
                  <p>Registre contexto, atualizacoes e alinhamentos importantes da demanda.</p>
                </div>
                <textarea
                  className="demanda-detail-textarea"
                  placeholder="Escreva um comentario util para a equipe..."
                  value={novoComentario}
                  onChange={(e) => setNovoComentario(e.target.value)}
                />
                <div className="demanda-detail-compose-actions">
                  <button
                    className="btn-primary"
                    disabled={!novoComentario.trim() || addComentarioMutation.isPending}
                    onClick={() => addComentarioMutation.mutate(novoComentario)}
                  >
                    {addComentarioMutation.isPending ? 'Enviando...' : 'Publicar comentario'}
                  </button>
                </div>
              </div>

              <div className="demanda-detail-list">
                {comentarios?.length ? (
                  comentarios.map((comentario) => (
                    <article key={comentario.id} className="demanda-comment-card">
                      <div className="demanda-comment-head">
                        <strong>{comentario.usuario_nome || 'Usuario'}</strong>
                        <span>{formatDateTime(comentario.criado_em)}</span>
                      </div>
                      <p>{comentario.comentario}</p>
                    </article>
                  ))
                ) : (
                  <div className="demanda-detail-empty">Nenhum comentario registrado ainda.</div>
                )}
              </div>
            </section>
          )}

          {activeTab === 'analises' && <DemandAnalysisSection demanda={demanda} />}

          {activeTab === 'anexos' && (
            <section className="card demanda-detail-panel">
              <div className="demanda-upload-card">
                <div className="demanda-upload-copy">
                  <h3>Anexar documento</h3>
                  <p>
                    Envie evidencias, planilhas, PDFs, imagens ou outros arquivos permitidos pela API para manter a
                    demanda bem documentada.
                  </p>
                </div>

                <div className="demanda-upload-controls">
                  <label className="demanda-upload-picker">
                    <span>Selecionar arquivo</span>
                    <input
                      type="file"
                      onChange={(e) => setArquivo(e.target.files?.[0] || null)}
                      disabled={uploadAnexoMutation.isPending}
                    />
                  </label>

                  <div className="demanda-upload-meta">
                    <strong>{arquivo ? arquivo.name : 'Nenhum arquivo selecionado'}</strong>
                    <span>{arquivo ? formatBytes(arquivo.size) : 'Formatos validos conforme configuracao da API'}</span>
                  </div>

                  <textarea
                    className="demanda-detail-textarea"
                    placeholder="Observacao para este anexo (opcional)..."
                    value={observacaoAnexo}
                    onChange={(e) => setObservacaoAnexo(e.target.value)}
                    style={{ minHeight: 80, marginTop: 12 }}
                  />

                  <button
                    className="btn-primary"
                    disabled={!arquivo || uploadAnexoMutation.isPending}
                    onClick={() => {
                      if (arquivo) uploadAnexoMutation.mutate({ file: arquivo, observacoes: observacaoAnexo });
                    }}
                  >
                    {uploadAnexoMutation.isPending ? 'Enviando...' : 'Enviar anexo'}
                  </button>
                </div>
              </div>

              <div className="demanda-detail-list">
                {anexos?.length ? (
                  anexos.map((anexo) => (
                    <article key={anexo.id} className="demanda-file-card">
                      {/\.(jpg|jpeg|png|gif|webp)$/i.test(anexo.nome_arquivo) ? (
                        <div className="demanda-file-preview">
                          <a href={anexo.file_url} target="_blank" rel="noreferrer">
                            <img src={anexo.file_url} alt={anexo.nome_arquivo} className="report-img" />
                          </a>
                        </div>
                      ) : (
                        <div className="demanda-file-icon">ARQ</div>
                      )}
                      <div className="demanda-file-body">
                        <strong>{anexo.nome_arquivo}</strong>
                        <span>
                          {anexo.usuario_nome || 'Usuario'} | {formatDateTime(anexo.criado_em)} |{' '}
                          {formatBytes(anexo.tamanho)}
                        </span>
                        {anexo.observacoes && (
                          <p className="demanda-file-obs" style={{ marginTop: 4, fontSize: 13, color: '#4f6780' }}>
                            {anexo.observacoes}
                          </p>
                        )}
                      </div>
                      <button className="btn-secondary btn-sm" onClick={() => void baixarAnexo(anexo)}>
                        Download
                      </button>
                    </article>
                  ))
                ) : (
                  <div className="demanda-detail-empty">Nenhum anexo cadastrado para esta demanda.</div>
                )}
              </div>
            </section>
          )}

          {activeTab === 'historico' && (
            <section className="card demanda-detail-panel">
              <div className="demanda-detail-section-head">
                <div>
                  <h3>Historico</h3>
                  <p>Veja a trilha de alteracoes, anexos e movimentacoes desta demanda.</p>
                </div>
              </div>

              <div className="demanda-timeline">
                {eventos?.length ? (
                  eventos.map((evento) => (
                    <article key={evento.id} className="demanda-timeline-item">
                      <div className="demanda-timeline-dot" />
                      <div className="demanda-timeline-body">
                        <strong>{evento.usuario_nome || 'Sistema'}</strong>
                        <p>
                          {evento.tipo_evento === 'criacao'
                            ? 'criou a demanda.'
                            : evento.tipo_evento === 'mudanca_status'
                              ? `alterou o status para ${evento.valor_novo}.`
                              : evento.tipo_evento === 'alteracao_campo'
                                ? `alterou ${evento.campo_alterado} de "${evento.valor_anterior}" para "${evento.valor_novo}".`
                                : evento.tipo_evento}
                        </p>
                        <span>{formatDateTime(evento.criado_em)}</span>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="demanda-detail-empty">Nenhum evento registrado ate o momento.</div>
                )}
              </div>
            </section>
          )}
        </div>

        <aside className="demanda-detail-sidebar">
          <section className="card demanda-detail-sidecard">
            <h3>Informacoes</h3>
            <div className="demanda-detail-sidegrid">
              <div>
                <span>Status</span>
                <strong>{DEMANDA_STATUS_LABELS[demanda.status]}</strong>
              </div>
              <div>
                <span>Prioridade</span>
                <strong>{PRIORIDADE_LABELS[demanda.prioridade]}</strong>
              </div>
              <div>
                <span>Solicitante</span>
                <strong>{demanda.solicitante_nome || '-'}</strong>
              </div>
              <div>
                <span>Responsavel</span>
                <strong>{demanda.responsavel_nome || 'Nao atribuido'}</strong>
              </div>
              <div>
                <span>Abertura</span>
                <strong>{formatDate(demanda.data_abertura)}</strong>
              </div>
              <div>
                <span>Prazo</span>
                <strong>{formatDate(demanda.prazo)}</strong>
              </div>
            </div>
          </section>

          <section className="card demanda-detail-sidecard demanda-detail-sidecard-soft">
            <h3>Resumo rapido</h3>
            <div className="demanda-detail-kpis">
              <div>
                <span>Comentarios</span>
                <strong>{tabCounts.comentarios}</strong>
              </div>
              <div>
                <span>Anexos</span>
                <strong>{tabCounts.anexos}</strong>
              </div>
              <div>
                <span>Eventos</span>
                <strong>{tabCounts.historico}</strong>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {showStatusModal && (
        <div className="modal-overlay">
          <div className="modal-content card" style={{ maxWidth: 420 }}>
            <h3>Alterar status</h3>
            <div className="grid gap-12 mt-16">
              {Object.entries(DEMANDA_STATUS_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  className={`btn-secondary text-left ${demanda.status === key ? 'border-primary' : ''}`}
                  onClick={() => {
                    if (key === 'cancelada') {
                      const motivo = prompt('Motivo do cancelamento:');
                      if (motivo) updateStatusMutation.mutate({ status: key as DemandaStatus, motivo });
                    } else {
                      updateStatusMutation.mutate({ status: key as DemandaStatus });
                    }
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <button className="btn-secondary mt-20 w-full" onClick={() => setShowStatusModal(false)}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

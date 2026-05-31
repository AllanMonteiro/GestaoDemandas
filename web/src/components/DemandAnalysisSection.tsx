import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  api,
  DEMANDA_ANALISE_METODO_LABELS,
  DemandaAnalise,
  getApiErrorMessage,
  ProfissionalDemanda,
  Usuario,
} from '../api';
import DemandAnalysisForm, {
  getDemandAnalysisFieldConfigs,
  getDemandAnalysisFieldLabel,
  type DemandAnalysisSubmitPayload,
} from './DemandAnalysisForm';
import DemandAnalysisStatusBadge from './DemandAnalysisStatusBadge';

type Props = {
  demanda: ProfissionalDemanda;
};

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
}

export default function DemandAnalysisSection({ demanda }: Props) {
  const queryClient = useQueryClient();
  const [erro, setErro] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingAnalise, setEditingAnalise] = useState<DemandaAnalise | null>(null);
  const [selectedAnaliseId, setSelectedAnaliseId] = useState<number | null>(null);

  const { data: currentUser } = useQuery<Usuario>({
    queryKey: ['auth-me-demand-analysis'],
    queryFn: async () => (await api.get('/auth/me')).data,
  });

  const { data: usuarios = [] } = useQuery<Usuario[]>({
    queryKey: ['usuarios-demand-analysis'],
    queryFn: async () => {
      try {
        return (await api.get('/usuarios')).data;
      } catch {
        return [];
      }
    },
    retry: false,
  });

  const { data: analises = [] } = useQuery<DemandaAnalise[]>({
    queryKey: ['demanda-analises', demanda.id],
    queryFn: async () => (await api.get(`/gestao-demandas/${demanda.id}/analises`)).data,
  });

  const selectedAnalise = useMemo(
    () => analises.find((analise) => analise.id === selectedAnaliseId) || analises[0] || null,
    [analises, selectedAnaliseId]
  );

  useEffect(() => {
    if (!analises.length) {
      setSelectedAnaliseId(null);
      return;
    }
    if (!selectedAnaliseId || !analises.some((analise) => analise.id === selectedAnaliseId)) {
      setSelectedAnaliseId(analises[0].id);
    }
  }, [analises, selectedAnaliseId]);

  const saveMutation = useMutation({
    mutationFn: async (payload: DemandAnalysisSubmitPayload) => {
      if (editingAnalise) {
        return api.put(`/gestao-demandas/analises/${editingAnalise.id}`, payload);
      }
      return api.post(`/gestao-demandas/${demanda.id}/analises`, payload);
    },
    onSuccess: async () => {
      setErro('');
      setShowForm(false);
      setEditingAnalise(null);
      await queryClient.invalidateQueries({ queryKey: ['demanda-analises', demanda.id] });
    },
    onError: (err: unknown) => {
      setErro(getApiErrorMessage(err, 'Falha ao salvar analise.'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (analiseId: number) => api.delete(`/gestao-demandas/analises/${analiseId}`),
    onSuccess: async () => {
      setErro('');
      await queryClient.invalidateQueries({ queryKey: ['demanda-analises', demanda.id] });
    },
    onError: (err: unknown) => {
      setErro(getApiErrorMessage(err, 'Falha ao excluir analise.'));
    },
  });

  const canEditAnalysis = (analise: DemandaAnalise) => {
    if (!currentUser) return false;
    if (currentUser.role === 'ADMIN' || currentUser.role === 'GESTOR') return true;
    return analise.responsavel_id === currentUser.id;
  };

  return (
    <section className="card demanda-detail-panel">
      <div className="demanda-detail-section-head">
        <div>
          <h3>Analise e Plano de Acao</h3>
          <p>Estruture causa raiz, priorizacao e plano de execucao com a metodologia mais adequada.</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            setEditingAnalise(null);
            setShowForm(true);
          }}
        >
          Nova analise
        </button>
      </div>

      {erro && <div className="error">{erro}</div>}

      {analises.length ? (
        <div className="demand-analysis-layout">
          <div className="demand-analysis-list">
            {analises.map((analise) => (
              <article
                key={analise.id}
                className={selectedAnalise?.id === analise.id ? 'demand-analysis-card active' : 'demand-analysis-card'}
              >
                <div className="demand-analysis-card-head">
                  <strong>{DEMANDA_ANALISE_METODO_LABELS[analise.metodo]}</strong>
                  <DemandAnalysisStatusBadge status={analise.status} />
                </div>
                <p>{analise.problema?.trim() || 'Sem problema registrado.'}</p>
                <div className="demand-analysis-card-meta">
                  <span>Responsavel: {analise.responsavel_nome || 'Nao definido'}</span>
                  <span>Criada em {formatDateTime(analise.criado_em)}</span>
                </div>
                <div className="demand-analysis-card-actions">
                  <button type="button" className="btn-secondary" onClick={() => setSelectedAnaliseId(analise.id)}>
                    {selectedAnalise?.id === analise.id ? 'Selecionada' : 'Visualizar'}
                  </button>
                  {canEditAnalysis(analise) && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setEditingAnalise(analise);
                        setShowForm(true);
                      }}
                    >
                      Editar
                    </button>
                  )}
                  {canEditAnalysis(analise) && (
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => {
                        if (window.confirm('Deseja excluir esta analise?')) {
                          deleteMutation.mutate(analise.id);
                        }
                      }}
                    >
                      Excluir
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="demand-analysis-detail">
            {selectedAnalise ? (
              <>
                <div className="demand-analysis-detail-hero">
                  <div>
                    <span className="demand-analysis-method-pill">{DEMANDA_ANALISE_METODO_LABELS[selectedAnalise.metodo]}</span>
                    <h4>{selectedAnalise.problema?.trim() || 'Analise sem problema descrito'}</h4>
                    <p>Causa raiz: {selectedAnalise.causa_raiz?.trim() || 'Nao informada'}</p>
                  </div>
                  <div className="demand-analysis-detail-meta">
                    <DemandAnalysisStatusBadge status={selectedAnalise.status} />
                    <span>Atualizada em {formatDateTime(selectedAnalise.atualizado_em)}</span>
                  </div>
                </div>

                <div className="demand-analysis-summary-grid">
                  <div className="demand-analysis-summary-card">
                    <span>Responsavel</span>
                    <strong>{selectedAnalise.responsavel_nome || 'Nao definido'}</strong>
                  </div>
                  <div className="demand-analysis-summary-card">
                    <span>Criacao</span>
                    <strong>{formatDateTime(selectedAnalise.criado_em)}</strong>
                  </div>
                  <div className="demand-analysis-summary-card">
                    <span>Classificacao</span>
                    <strong>{selectedAnalise.classificacao || '-'}</strong>
                  </div>
                  <div className="demand-analysis-summary-card">
                    <span>Pontuacao GUT</span>
                    <strong>{selectedAnalise.pontuacao_total ?? '-'}</strong>
                  </div>
                </div>

                <div className="demand-analysis-fields-grid">
                  {getDemandAnalysisFieldConfigs(selectedAnalise.metodo).map((config) => (
                    <div key={config.key} className="demand-analysis-field-card">
                      <span>{config.label}</span>
                      <strong>{selectedAnalise.campos_map[config.key] || '-'}</strong>
                    </div>
                  ))}

                  {selectedAnalise.campos_map.classificacao_prioridade && selectedAnalise.metodo === 'GUT' && (
                    <div className="demand-analysis-field-card">
                      <span>{getDemandAnalysisFieldLabel(selectedAnalise.metodo, 'classificacao_prioridade')}</span>
                      <strong>{selectedAnalise.campos_map.classificacao_prioridade}</strong>
                    </div>
                  )}

                  {selectedAnalise.campos_map.classificacao && selectedAnalise.metodo === 'ESFORCO_IMPACTO' && (
                    <div className="demand-analysis-field-card">
                      <span>{getDemandAnalysisFieldLabel(selectedAnalise.metodo, 'classificacao')}</span>
                      <strong>{selectedAnalise.campos_map.classificacao}</strong>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="demanda-detail-empty">Selecione uma analise para ver os detalhes.</div>
            )}
          </div>
        </div>
      ) : (
        <div className="demanda-detail-empty">
          Nenhuma analise cadastrada ainda. Use a metodologia que fizer mais sentido para iniciar o plano de acao.
        </div>
      )}

      {showForm && (
        <DemandAnalysisForm
          initialAnalise={editingAnalise}
          usuarios={usuarios}
          currentUserRole={currentUser?.role}
          defaultResponsavelId={editingAnalise?.responsavel_id ?? demanda.responsavel_id ?? currentUser?.id ?? null}
          isSaving={saveMutation.isPending}
          onClose={() => {
            setShowForm(false);
            setEditingAnalise(null);
          }}
          onSubmit={(payload) => saveMutation.mutate(payload)}
        />
      )}
    </section>
  );
}

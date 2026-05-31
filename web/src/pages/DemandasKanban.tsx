import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { api, DemandaStatus, DEMANDA_STATUS_LABELS, PRIORIDADE_LABELS, ProfissionalDemandaListItem } from '../api';

const COLUMNS: DemandaStatus[] = [
  'nova',
  'em_triagem',
  'aguardando_informacoes',
  'aprovada',
  'em_execucao',
  'em_validacao',
  'concluida',
];

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('pt-BR');
}

export default function DemandasKanban() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: demandas, isLoading } = useQuery<ProfissionalDemandaListItem[]>({
    queryKey: ['demandas-list', {}],
    queryFn: async () => (await api.get('/gestao-demandas')).data,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: DemandaStatus }) =>
      api.patch(`/gestao-demandas/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandas-list'] });
    },
  });

  const demandasPorStatus = useMemo(() => {
    return COLUMNS.reduce((acc, status) => {
      acc[status] = demandas?.filter((item) => item.status === status) || [];
      return acc;
    }, {} as Record<DemandaStatus, ProfissionalDemandaListItem[]>);
  }, [demandas]);

  const total = demandas?.length || 0;
  const concluidas = demandas?.filter((item) => item.status === 'concluida').length || 0;
  const atrasadas = demandas?.filter((item) => Boolean(item.atraso)).length || 0;

  if (isLoading) return <div className="card">Carregando kanban...</div>;

  return (
    <div className="demandas-module-page">
      <section className="card demandas-module-hero">
        <div className="demandas-module-hero-main">
          <span className="demandas-module-eyebrow">Fluxo visual</span>
          <h1>Kanban de Demandas</h1>
          <p>
            Veja a distribuicao do trabalho por etapa, mova rapidamente as demandas e identifique onde a fila esta
            acumulando.
          </p>
        </div>

        <div className="demandas-module-hero-actions">
          <button className="btn-secondary" onClick={() => navigate('/demandas')}>
            Voltar para lista
          </button>
        </div>
      </section>

      <section className="demandas-kpi-grid">
        <article className="card demandas-kpi-card demandas-kpi-card-blue">
          <span>Total no quadro</span>
          <strong>{total}</strong>
        </article>
        <article className="card demandas-kpi-card demandas-kpi-card-green">
          <span>Concluidas</span>
          <strong>{concluidas}</strong>
        </article>
        <article className="card demandas-kpi-card demandas-kpi-card-red">
          <span>Atrasadas</span>
          <strong>{atrasadas}</strong>
        </article>
        <article className="card demandas-kpi-card demandas-kpi-card-soft">
          <span>Em aberto</span>
          <strong>{Math.max(total - concluidas, 0)}</strong>
        </article>
      </section>

      <section className="demandas-kanban-board">
        {COLUMNS.map((status) => (
          <div key={status} className={`demandas-kanban-column demandas-kanban-column-${status}`}>
            <div className="demandas-kanban-column-head">
              <div>
                <span className="demandas-kanban-column-label">{DEMANDA_STATUS_LABELS[status]}</span>
                <small>{demandasPorStatus[status]?.length || 0} demandas</small>
              </div>
            </div>

            <div className="demandas-kanban-column-body">
              {demandasPorStatus[status]?.length ? (
                demandasPorStatus[status].map((demanda) => (
                  <article
                    key={demanda.id}
                    className="card demandas-kanban-card"
                    onClick={() => navigate(`/demandas/${demanda.id}`)}
                  >
                    <div className="demandas-kanban-card-top">
                      <span className="demandas-code-pill">{demanda.codigo}</span>
                      {demanda.atraso ? <span className="demandas-overdue-pill">{demanda.atraso}d atrasada</span> : null}
                    </div>

                    <strong>{demanda.titulo}</strong>

                    <div className="demandas-kanban-meta">
                      <span>{demanda.solicitante_nome || 'Sem solicitante'}</span>
                      <span>{demanda.responsavel_nome || 'Nao atribuido'}</span>
                      <span>Prazo: {formatDate(demanda.prazo)}</span>
                    </div>

                    <div className="demandas-kanban-footer">
                      <span className={`badge badge-${demanda.prioridade}`}>{PRIORIDADE_LABELS[demanda.prioridade]}</span>

                      <select
                        value={demanda.status}
                        className="demandas-kanban-status-select"
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          updateStatusMutation.mutate({
                            id: demanda.id,
                            status: e.target.value as DemandaStatus,
                          })
                        }
                      >
                        {COLUMNS.map((option) => (
                          <option key={option} value={option}>
                            {DEMANDA_STATUS_LABELS[option]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </article>
                ))
              ) : (
                <div className="demandas-kanban-empty">Nenhuma demanda nesta etapa.</div>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { api, DEMANDA_STATUS_LABELS, PRIORIDADE_LABELS, ProfissionalDemandaListItem } from '../api';
import { TableSkeleton } from '../components/Skeleton';
import Table from '../components/Table';

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('pt-BR');
}

export default function DemandasList() {
  const navigate = useNavigate();
  const [filtros, setFiltros] = useState({
    status: '',
    prioridade: '',
    atrasadas: false,
    busca: '',
  });

  const { data, isLoading, error } = useQuery<ProfissionalDemandaListItem[]>({
    queryKey: ['demandas-list', filtros],
    queryFn: async () => {
      const params = {
        status: filtros.status || undefined,
        prioridade: filtros.prioridade || undefined,
        atrasadas: filtros.atrasadas || undefined,
        busca: filtros.busca || undefined,
      };
      const resp = await api.get('/gestao-demandas', { params });
      return resp.data;
    },
  });

  const demandas = data || [];
  const resumo = useMemo(() => {
    const total = demandas.length;
    const atrasadas = demandas.filter((item) => Boolean(item.atraso)).length;
    const semResponsavel = demandas.filter((item) => !item.responsavel_nome).length;
    const criticas = demandas.filter((item) => item.prioridade === 'critica').length;
    return { total, atrasadas, semResponsavel, criticas };
  }, [demandas]);

  return (
    <div className="demandas-module-page">
      <section className="card demandas-module-hero">
        <div className="demandas-module-hero-main">
          <span className="demandas-module-eyebrow">Operacao</span>
          <h1>Gestao de Demandas</h1>
          <p>
            Acompanhe a fila de trabalho, identifique gargalos com rapidez e entre no detalhe de cada demanda com
            contexto suficiente para agir.
          </p>
        </div>

        <div className="demandas-module-hero-actions">
          <button className="btn-secondary" onClick={() => navigate('/demandas-kanban')}>
            Abrir kanban
          </button>
          <button className="btn-primary" onClick={() => navigate('/demandas/nova')}>
            + Nova demanda
          </button>
        </div>
      </section>

      <section className="demandas-kpi-grid">
        <article className="card demandas-kpi-card demandas-kpi-card-blue">
          <span>Total visivel</span>
          <strong>{resumo.total}</strong>
        </article>
        <article className="card demandas-kpi-card demandas-kpi-card-red">
          <span>Atrasadas</span>
          <strong>{resumo.atrasadas}</strong>
        </article>
        <article className="card demandas-kpi-card demandas-kpi-card-gold">
          <span>Criticas</span>
          <strong>{resumo.criticas}</strong>
        </article>
        <article className="card demandas-kpi-card demandas-kpi-card-soft">
          <span>Sem responsavel</span>
          <strong>{resumo.semResponsavel}</strong>
        </article>
      </section>

      <section className="card demandas-filter-card">
        <div className="demandas-filter-topline">
          <div>
            <h3>Filtros rapidos</h3>
            <p>Refine a lista por status, prioridade, atraso ou texto livre.</p>
          </div>
        </div>

        <div className="demandas-filter-grid">
          <label className="form-row compact">
            <span>Busca</span>
            <input
              type="text"
              placeholder="Codigo, titulo ou contexto..."
              value={filtros.busca}
              onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
            />
          </label>

          <label className="form-row compact">
            <span>Status</span>
            <select
              value={filtros.status}
              onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
            >
              <option value="">Todos os status</option>
              {Object.entries(DEMANDA_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="form-row compact">
            <span>Prioridade</span>
            <select
              value={filtros.prioridade}
              onChange={(e) => setFiltros({ ...filtros, prioridade: e.target.value })}
            >
              <option value="">Todas as prioridades</option>
              {Object.entries(PRIORIDADE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="demandas-toggle">
            <input
              type="checkbox"
              checked={filtros.atrasadas}
              onChange={(e) => setFiltros({ ...filtros, atrasadas: e.target.checked })}
            />
            <span>Mostrar apenas demandas atrasadas</span>
          </label>
        </div>
      </section>

      <section className="card demandas-table-card">
        <div className="demandas-table-head">
          <div>
            <h3>Lista de demandas</h3>
            <p>Selecione uma linha para abrir o detalhe completo.</p>
          </div>
          <span className="demandas-table-count">{demandas.length} itens</span>
        </div>

        {isLoading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : error ? (
          <div className="error">Erro ao carregar demandas.</div>
        ) : (
          <Table
            rows={demandas}
            onRowClick={(row) => navigate(`/demandas/${row.id}`)}
            columns={[
              {
                title: 'Demanda',
                render: (row) => (
                  <div className="demandas-title-cell">
                    <span className="demandas-code-pill">{row.codigo}</span>
                    <strong>{row.titulo}</strong>
                  </div>
                ),
              },
              {
                title: 'Solicitante',
                render: (row) => row.solicitante_nome || '-',
              },
              {
                title: 'Responsavel',
                render: (row) => row.responsavel_nome || 'Nao atribuido',
              },
              {
                title: 'Prioridade',
                render: (row) => <span className={`badge badge-${row.prioridade}`}>{PRIORIDADE_LABELS[row.prioridade]}</span>,
              },
              {
                title: 'Status',
                render: (row) => <span className={`badge status-${row.status}`}>{DEMANDA_STATUS_LABELS[row.status]}</span>,
              },
              {
                title: 'Subdemandas',
                render: (row) => row.total_subdemandas ?? 0,
              },
              {
                title: 'Prazo',
                render: (row) => (
                  <span className={row.atraso ? 'demandas-deadline overdue' : 'demandas-deadline'}>
                    {formatDate(row.prazo)}
                  </span>
                ),
              },
              {
                title: 'Atraso',
                render: (row) =>
                  row.atraso ? <span className="demandas-overdue-pill">{row.atraso}d</span> : <span>-</span>,
              },
            ]}
          />
        )}
      </section>
    </div>
  );
}

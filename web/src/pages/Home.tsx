import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchHome, DEMANDA_STATUS_LABELS, GESTAO_STATUS_COR, DemandaListItem, DemandaStatus } from '../api';
import { Skeleton } from '../components/Skeleton';

function KpiCard({ titulo, valor, cor, loading }: { titulo: string; valor: string | number; cor: string; loading?: boolean }) {
  return (
    <div className="card home-kpi-card" style={{ borderLeft: `4px solid ${cor}` }}>
      <div className="muted-text text-xs uppercase font-bold">{titulo}</div>
      {loading ? (
        <Skeleton style={{ width: '60%', height: '28px', marginTop: 8 }} />
      ) : (
        <div className="text-2xl font-bold mt-4" style={{ color: '#111827' }}>{valor}</div>
      )}
    </div>
  );
}

function DemandaRow({ demanda }: { demanda: DemandaListItem }) {
  return (
    <Link to={`/demandas/${demanda.id}`} className="home-list-item">
      <div className="flex items-center gap-12">
        <span className="font-mono text-xs text-gray-400">#{demanda.codigo}</span>
        <span className="font-medium text-sm text-gray-800">{demanda.titulo}</span>
      </div>
      <div className="flex items-center gap-8">
        <span 
          className="badge text-xs" 
          style={{ background: (GESTAO_STATUS_COR[demanda.status] ?? '#6b7280') + '20', color: GESTAO_STATUS_COR[demanda.status] ?? '#6b7280' }}
        >
          {DEMANDA_STATUS_LABELS[demanda.status as keyof typeof DEMANDA_STATUS_LABELS] || demanda.status}
        </span>
        {demanda.atraso ? (
          <span className="text-xs text-red-500 font-bold">-{demanda.atraso}d</span>
        ) : null}
      </div>
    </Link>
  );
}

export default function Home() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['home-data'],
    queryFn: fetchHome,
  });

  if (error) return <div className="error card">Erro ao carregar dados da página inicial.</div>;

  return (
    <div className="grid gap-24">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bem-vindo ao Gestão de Demandas</h1>
          <p className="muted-text">Acompanhe suas tarefas e indicadores em tempo real.</p>
        </div>
        <Link to="/demandas" className="btn-secondary">
          Ir para demandas
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-16">
        <KpiCard 
          titulo="Total de Demandas" 
          valor={data?.resumo.total_abertas ?? 0} 
          cor="#3b82f6" 
          loading={isLoading} 
        />
        <KpiCard 
          titulo="Atrasadas" 
          valor={data?.resumo.total_atrasadas ?? 0} 
          cor="#ef4444" 
          loading={isLoading} 
        />
        <KpiCard 
          titulo="Atribuídas a Mim" 
          valor={data?.minhas_demandas.length ?? 0} 
          cor="#8b5cf6" 
          loading={isLoading} 
        />
        <KpiCard 
          titulo="SLA de Conclusão" 
          valor={`${data?.resumo.sla_cumprido_percentual ?? 0}%`} 
          cor="#22c55e" 
          loading={isLoading} 
        />
      </div>

      <div className="grid grid-cols-3 gap-20">
        {/* Coluna 1: Minhas Demandas & Atrasadas */}
        <div className="flex flex-col gap-20">
          <div className="card">
            <h3 className="flex justify-between items-center">
              Minhas Demandas
              <Link to="/demandas" className="text-xs text-blue-500">Ver todas</Link>
            </h3>
            <div className="mt-12 flex flex-col">
              {isLoading ? (
                Array(3).fill(0).map((_, i) => <Skeleton key={i} style={{ height: '40px', marginBottom: 8 }} />)
              ) : data?.minhas_demandas.length === 0 ? (
                <div className="muted-text text-sm py-12">Nenhuma demanda atribuída.</div>
              ) : (
                data?.minhas_demandas.map(d => <DemandaRow key={d.id} demanda={d} />)
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="flex justify-between items-center">
              Críticas / Atrasadas
              <Link to="/demandas?atrasadas=true" className="text-xs text-red-500">Ver todas</Link>
            </h3>
            <div className="mt-12 flex flex-col">
              {isLoading ? (
                Array(3).fill(0).map((_, i) => <Skeleton key={i} style={{ height: '40px', marginBottom: 8 }} />)
              ) : data?.atrasadas.length === 0 ? (
                <div className="muted-text text-sm py-12">Nenhuma demanda atrasada. 🙌</div>
              ) : (
                data?.atrasadas.map(d => <DemandaRow key={d.id} demanda={d} />)
              )}
            </div>
          </div>
        </div>

        {/* Coluna 2: Recentes */}
        <div className="card">
          <h3 className="flex justify-between items-center">
            Recentemente Criadas
            <Link to="/demandas" className="text-xs text-blue-500">Ver todas</Link>
          </h3>
          <div className="mt-12 flex flex-col">
            {isLoading ? (
              Array(5).fill(0).map((_, i) => <Skeleton key={i} style={{ height: '40px', marginBottom: 8 }} />)
            ) : data?.recentes.map(d => <DemandaRow key={d.id} demanda={d} />)}
          </div>
        </div>

        {/* Coluna 3: Gráfico de Status */}
        <div className="card">
          <h3>Fluxo por Status</h3>
          <div className="mt-16 flex flex-col gap-12">
            {isLoading ? (
              Array(5).fill(0).map((_, i) => <Skeleton key={i} style={{ height: '12px', marginBottom: 12 }} />)
            ) : data?.resumo.total_por_status.map(item => (
              <div key={item.label} className="flex flex-col gap-4">
                <div className="flex justify-between text-xs">
                  <span>{DEMANDA_STATUS_LABELS[item.label as keyof typeof DEMANDA_STATUS_LABELS] || item.label}</span>
                  <span className="font-bold">{item.pct}%</span>
                </div>
                <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      width: `${item.pct}%`, 
                      height: '100%', 
                      background: GESTAO_STATUS_COR[item.label as DemandaStatus] || '#9ca3af' 
                    }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

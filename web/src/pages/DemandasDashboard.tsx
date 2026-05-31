import { useQuery } from '@tanstack/react-query';
import { api, GestaoDashboard, DEMANDA_STATUS_LABELS, PRIORIDADE_LABELS } from '../api';

const PRIORIDADE_COR: Record<string, string> = {
  baixa: '#6b7280',
  media: '#3b82f6',
  alta: '#f59e0b',
  critica: '#ef4444',
};

const STATUS_COR: Record<string, string> = {
  nova: '#6b7280',
  em_triagem: '#3b82f6',
  aguardando_informacoes: '#f59e0b',
  aprovada: '#8b5cf6',
  em_execucao: '#0ea5e9',
  em_validacao: '#f97316',
  concluida: '#22c55e',
  cancelada: '#ef4444',
};

function KpiCard({ titulo, valor, cor }: { titulo: string; valor: string | number; cor: string }) {
  return (
    <div className="card" style={{ borderTop: `4px solid ${cor}` }}>
      <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>{titulo}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#111827' }}>{valor}</div>
    </div>
  );
}

export default function DemandasDashboard() {
  const { data, isLoading, error } = useQuery<GestaoDashboard>({
    queryKey: ['demandas-dashboard'],
    queryFn: async () => {
      const resp = await api.get('/gestao-demandas/dashboard/resumo');
      return resp.data;
    },
  });

  if (isLoading) return <div className="card">Carregando indicadores...</div>;
  if (error) return <div className="error">Erro ao carregar dashboard.</div>;
  if (!data) return null;

  return (
    <div className="grid gap-20">
      <div className="flex justify-between items-center">
        <h2>Dashboard de Demandas</h2>
        <div style={{ color: '#6b7280', fontSize: 14 }}>SLA Geral: <strong>{data.sla_cumprido_percentual}%</strong></div>
      </div>

      <div className="grid grid-cols-4 gap-16">
        <KpiCard titulo="Total Abertas" valor={data.total_abertas} cor="#3b82f6" />
        <KpiCard titulo="Atrasadas" valor={data.total_atrasadas} cor="#ef4444" />
        <KpiCard titulo="Concluídas (Mês)" valor={data.total_concluidas_mes} cor="#22c55e" />
        <KpiCard titulo="Tempo Médio (Dias)" valor={data.tempo_medio_conclusao ?? '-'} cor="#8b5cf6" />
      </div>

      <div className="grid grid-cols-2 gap-20">
        <div className="card">
          <h3>Status das Demandas</h3>
          <div className="grid gap-10 mt-16">
            {data.total_por_status.map((item) => (
              <div key={item.label} className="flex flex-col gap-4">
                <div className="flex justify-between text-sm">
                  <span>{DEMANDA_STATUS_LABELS[item.label as keyof typeof DEMANDA_STATUS_LABELS] || item.label}</span>
                  <span>{item.valor} ({item.pct}%)</span>
                </div>
                <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${item.pct}%`, height: '100%', background: STATUS_COR[item.label] || '#9ca3af' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>Prioridade</h3>
          <div className="grid gap-10 mt-16">
            {data.total_por_prioridade.map((item) => (
              <div key={item.label} className="flex flex-col gap-4">
                <div className="flex justify-between text-sm">
                  <span>{PRIORIDADE_LABELS[item.label as keyof typeof PRIORIDADE_LABELS] || item.label}</span>
                  <span>{item.valor} ({item.pct}%)</span>
                </div>
                <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${item.pct}%`, height: '100%', background: PRIORIDADE_COR[item.label] || '#9ca3af' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Demandas por Responsável</h3>
        <div className="grid grid-cols-2 gap-20 mt-16">
          {data.total_por_responsavel.map((item) => (
            <div key={item.label} className="flex justify-between items-center p-8 border-b">
              <span>{item.label}</span>
              <span className="badge badge-info">{item.valor}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

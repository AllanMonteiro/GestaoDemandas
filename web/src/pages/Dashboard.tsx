import { useEffect, useState } from 'react';

import { api, GestaoDashboard, GestaoDemandasStatus, GESTAO_STATUS_COR, ItemContagem, ItemContagemPct } from '../api';

const PRIORIDADE_COR: Record<string, string> = {
  Baixa: '#6b7280',
  Média: '#3b82f6',
  Alta: '#f59e0b',
  Crítica: '#ef4444',
};

const STATUS_LABEL_TO_KEY: Record<string, GestaoDemandasStatus> = {
  Nova: 'nova',
  'Em Triagem': 'triagem',
  'Aguardando Informações': 'aguardando_info',
  Aprovada: 'aprovada',
  'Em Execução': 'execucao',
  'Em Validação': 'validacao',
  Concluída: 'concluida',
  Cancelada: 'cancelada',
};

function KpiCard({
  titulo,
  valor,
  unidade,
  cor,
  destaque,
}: {
  titulo: string;
  valor: string | number;
  unidade?: string;
  cor: string;
  destaque?: boolean;
}) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderTop: `4px solid ${cor}`,
        borderRadius: 8,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {titulo}
      </div>
      <div style={{ fontSize: destaque ? 36 : 28, fontWeight: 700, color: cor, lineHeight: 1.1 }}>
        {valor}
        {unidade && (
          <span style={{ fontSize: 14, fontWeight: 400, color: '#6b7280', marginLeft: 4 }}>{unidade}</span>
        )}
      </div>
    </div>
  );
}

function BarraHorizontal({
  label,
  valor,
  pct,
  cor,
  total,
}: {
  label: string;
  valor: number;
  pct?: number;
  cor: string;
  total?: number;
}) {
  const largura = pct ?? (total && total > 0 ? (valor / total) * 100 : 0);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
      <div
        style={{
          width: 148,
          flexShrink: 0,
          color: '#374151',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={label}
      >
        {label}
      </div>
      <div style={{ flex: 1, background: '#f3f4f6', borderRadius: 4, height: 14, overflow: 'hidden' }}>
        <div
          style={{
            width: `${largura > 0 ? Math.max(largura, 2) : 0}%`,
            height: '100%',
            background: cor,
            borderRadius: 4,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
      <div style={{ width: 60, textAlign: 'right', color: '#374151', fontWeight: 600, flexShrink: 0 }}>
        {valor}
        {pct !== undefined && (
          <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400, marginLeft: 3 }}>{pct}%</span>
        )}
      </div>
    </div>
  );
}

function PainelBarras({
  titulo,
  itens,
  corFn,
}: {
  titulo: string;
  itens: (ItemContagem | ItemContagemPct)[];
  corFn: (label: string) => string;
}) {
  const total = itens.reduce((s, i) => s + i.valor, 0);
  return (
    <div className="card" style={{ padding: 16 }}>
      <h4 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: '#374151' }}>{titulo}</h4>
      {itens.length === 0 ? (
        <div style={{ fontSize: 13, color: '#9ca3af' }}>Sem dados.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {itens.map((item) => (
            <BarraHorizontal
              key={item.label}
              label={item.label}
              valor={item.valor}
              pct={'pct' in item ? item.pct : undefined}
              cor={corFn(item.label)}
              total={total}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SlaGauge({ noPrazo, vencido }: { noPrazo: number; vencido: number }) {
  const total = noPrazo + vencido;
  if (total === 0) {
    return (
      <div className="card" style={{ padding: 16 }}>
        <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600, color: '#374151' }}>
          SLA — Cumprimento de Prazo
        </h4>
        <div style={{ fontSize: 13, color: '#9ca3af' }}>Nenhuma demanda com prazo definido ainda.</div>
      </div>
    );
  }
  const pctOk = Math.round((noPrazo / total) * 100);
  const pctVenc = 100 - pctOk;

  return (
    <div className="card" style={{ padding: 16 }}>
      <h4 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: '#374151' }}>
        SLA — Cumprimento de Prazo
      </h4>
      <div style={{ height: 20, borderRadius: 6, overflow: 'hidden', display: 'flex', marginBottom: 12 }}>
        <div style={{ width: `${pctOk}%`, background: '#22c55e', transition: 'width 0.4s' }} />
        <div style={{ width: `${pctVenc}%`, background: '#ef4444', transition: 'width 0.4s' }} />
      </div>
      <div style={{ display: 'flex', gap: 28, fontSize: 13 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: '#22c55e', flexShrink: 0 }} />
          <span>
            No prazo: <strong>{noPrazo}</strong>
            <span style={{ color: '#6b7280', marginLeft: 4 }}>({pctOk}%)</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: '#ef4444', flexShrink: 0 }} />
          <span>
            Vencido: <strong>{vencido}</strong>
            <span style={{ color: '#6b7280', marginLeft: 4 }}>({pctVenc}%)</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [dados, setDados] = useState<GestaoDashboard | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  const carregar = async () => {
    setCarregando(true);
    setErro('');
    try {
      const { data } = await api.get<GestaoDashboard>('/gestao-demandas/dashboard/resumo');
      setDados(data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setErro(e?.response?.data?.detail || 'Falha ao carregar dashboard.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const mesAtual = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  const gargalo = dados?.por_status.find(
    (s) => !['Concluída', 'Cancelada'].includes(s.label) && s.pct > 40
  );

  return (
    <div className="grid gap-16">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Dashboard Gerencial</h2>
        <button type="button" className="btn-secondary" onClick={() => void carregar()} disabled={carregando}>
          {carregando ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {erro && <div className="error">{erro}</div>}

      {carregando && !dados && (
        <div className="card" style={{ textAlign: 'center', color: '#6b7280', padding: 32 }}>
          Carregando indicadores...
        </div>
      )}

      {dados && (
        <>
          {/* KPIs principais */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 12 }}>
            <KpiCard titulo="Abertas" valor={dados.total_abertas} cor="#3b82f6" destaque />
            <KpiCard titulo="Atrasadas" valor={dados.total_atrasadas} cor="#ef4444" destaque />
            <KpiCard titulo={`Concluídas em ${mesAtual}`} valor={dados.total_concluidas_mes} cor="#22c55e" destaque />
            <KpiCard
              titulo="Tempo Médio"
              valor={dados.tempo_medio_atendimento_dias ?? '—'}
              unidade={dados.tempo_medio_atendimento_dias !== null ? 'dias' : undefined}
              cor="#8b5cf6"
            />
            <KpiCard titulo="Canceladas" valor={dados.total_canceladas} cor="#9ca3af" />
          </div>

          {/* SLA */}
          <SlaGauge noPrazo={dados.sla_no_prazo} vencido={dados.sla_vencido} />

          {/* Alerta de gargalo */}
          {gargalo && (
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 8,
                padding: '12px 16px',
                fontSize: 13,
                color: '#92400e',
                display: 'flex',
                gap: 8,
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 16 }}>⚠</span>
              <span>
                Possível gargalo detectado: <strong>{gargalo.pct}%</strong> das demandas estão com status{' '}
                <strong>"{gargalo.label}"</strong>. Verifique bloqueios nessa etapa.
              </span>
            </div>
          )}

          {/* Gargalos por status + Prioridade */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <PainelBarras
              titulo="Gargalos por Status"
              itens={dados.por_status}
              corFn={(label) => {
                const key = STATUS_LABEL_TO_KEY[label];
                return key ? (GESTAO_STATUS_COR[key] ?? '#6b7280') : '#6b7280';
              }}
            />
            <PainelBarras
              titulo="Distribuição por Prioridade"
              itens={dados.por_prioridade}
              corFn={(label) => PRIORIDADE_COR[label] ?? '#6b7280'}
            />
          </div>

          {/* Setor + Responsável */}
          {(dados.por_setor.length > 0 || dados.por_responsavel.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {dados.por_setor.length > 0 && (
                <PainelBarras
                  titulo="Demandas por Setor"
                  itens={dados.por_setor}
                  corFn={() => '#0ea5e9'}
                />
              )}
              {dados.por_responsavel.length > 0 && (
                <PainelBarras
                  titulo="Demandas por Responsável"
                  itens={dados.por_responsavel}
                  corFn={() => '#8b5cf6'}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

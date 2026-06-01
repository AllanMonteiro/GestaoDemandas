import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  api,
  DemandaListItem,
  GESTAO_STATUS_COR,
  GESTAO_STATUS_LABELS,
  getApiErrorMessage,
} from '../api';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function DemandasCalendario() {
  const navigate = useNavigate();
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [demandas, setDemandas] = useState<DemandaListItem[]>([]);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const carregar = async () => {
      try {
        setCarregando(true);
        const { data } = await api.get<DemandaListItem[]>('/gestao-demandas', {
          params: { incluir_subdemandas: true },
        });
        setDemandas(data);
      } catch (err: unknown) {
        setErro(getApiErrorMessage(err, 'Falha ao carregar demandas.'));
      } finally {
        setCarregando(false);
      }
    };
    void carregar();
  }, []);

  const demandasPorDia = useMemo(() => {
    const map = new Map<string, DemandaListItem[]>();
    demandas.forEach((d) => {
      if (d.prazo) {
        const chave = d.prazo.slice(0, 10);
        if (!map.has(chave)) map.set(chave, []);
        map.get(chave)!.push(d);
      }
    });
    return map;
  }, [demandas]);

  const diasDoMes = useMemo(() => {
    const primeiro = new Date(ano, mes, 1);
    const ultimo = new Date(ano, mes + 1, 0);
    const dias: (Date | null)[] = [];
    for (let i = 0; i < primeiro.getDay(); i++) dias.push(null);
    for (let d = 1; d <= ultimo.getDate(); d++) dias.push(new Date(ano, mes, d));
    while (dias.length % 7 !== 0) dias.push(null);
    return dias;
  }, [ano, mes]);

  const mesAnterior = () => {
    if (mes === 0) { setMes(11); setAno((a) => a - 1); }
    else setMes((m) => m - 1);
  };

  const proximoMes = () => {
    if (mes === 11) { setMes(0); setAno((a) => a + 1); }
    else setMes((m) => m + 1);
  };

  const hojeStr = toIso(hoje);

  const totalMes = useMemo(() => {
    const prefixo = `${ano}-${String(mes + 1).padStart(2, '0')}`;
    const total = demandas.filter((d) => d.prazo?.startsWith(prefixo)).length;
    const subs = demandas.filter((d) => d.prazo?.startsWith(prefixo) && d.parent_demanda_id).length;
    return { total, subs };
  }, [demandas, ano, mes]);

  return (
    <div className="grid gap-16">
      <div className="between">
        <h2>Calendário de Demandas</h2>
        {totalMes.total > 0 && (
          <span style={{ fontSize: 13, color: '#56738f' }}>
            {totalMes.total} demanda{totalMes.total !== 1 ? 's' : ''} com prazo neste mês
            {totalMes.subs > 0 && ` (${totalMes.subs} subdemanda${totalMes.subs !== 1 ? 's' : ''})`}
          </span>
        )}
      </div>

      {erro && <div className="error">{erro}</div>}

      <div className="card">
        <div className="between" style={{ marginBottom: 20 }}>
          <button type="button" className="btn-secondary" onClick={mesAnterior}>
            ← Anterior
          </button>
          <h3 style={{ margin: 0 }}>{MESES[mes]} {ano}</h3>
          <button type="button" className="btn-secondary" onClick={proximoMes}>
            Próximo →
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
          {DIAS_SEMANA.map((dia) => (
            <div
              key={dia}
              style={{ textAlign: 'center', fontWeight: 700, fontSize: 12, color: '#56738f', padding: '4px 0' }}
            >
              {dia}
            </div>
          ))}
        </div>

        {carregando ? (
          <p className="muted-text" style={{ textAlign: 'center', padding: 40 }}>Carregando demandas...</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {diasDoMes.map((dia, i) => {
              if (!dia) {
                return <div key={`vazio-${i}`} style={{ minHeight: 90, background: '#f8fafc', borderRadius: 6 }} />;
              }

              const chave = toIso(dia);
              const isHoje = chave === hojeStr;
              const demandasDoDia = demandasPorDia.get(chave) || [];

              return (
                <div
                  key={chave}
                  style={{
                    minHeight: 90,
                    border: isHoje ? '2px solid #0f6cbd' : '1px solid #e2eaf3',
                    borderRadius: 6,
                    padding: '6px 4px',
                    background: isHoje ? '#eef4fb' : '#fff',
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: isHoje ? 700 : 500,
                      color: isHoje ? '#0f6cbd' : '#1b466b',
                      marginBottom: 4,
                      textAlign: 'right',
                    }}
                  >
                    {dia.getDate()}
                  </div>

                  {demandasDoDia.map((d) => {
                    const cor = GESTAO_STATUS_COR[d.status as keyof typeof GESTAO_STATUS_COR] || '#6b7280';
                    const label = GESTAO_STATUS_LABELS[d.status as keyof typeof GESTAO_STATUS_LABELS] || d.status;
                    const isSub = !!d.parent_demanda_id;
                    return (
                      <div
                        key={d.id}
                        onClick={() => navigate(`/demandas/${d.id}`)}
                        title={`${d.codigo} · ${d.titulo}\nStatus: ${label}\nResponsável: ${d.responsavel_nome || '—'}`}
                        style={{
                          background: isSub ? 'transparent' : cor,
                          color: isSub ? cor : '#fff',
                          border: isSub ? `1px solid ${cor}` : 'none',
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '2px 5px',
                          borderRadius: 3,
                          marginBottom: 2,
                          marginLeft: isSub ? 4 : 0,
                          cursor: 'pointer',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isSub ? '↳ ' : ''}{d.codigo} {d.titulo}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <h4 style={{ margin: '0 0 10px' }}>Legenda</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {Object.entries(GESTAO_STATUS_COR).map(([status, cor]) => (
            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: cor as string }} />
              <span>{GESTAO_STATUS_LABELS[status as keyof typeof GESTAO_STATUS_LABELS] || status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';

import { PRIORIDADE_LABELS, PRIORIDADE_COR, Projeto, TarefaProjeto, TAREFA_PROJETO_STATUS_LABELS, Usuario } from '../api';

type Props = {
  projeto: Projeto | null;
  tarefas: TarefaProjeto[];
  usuariosMap: Map<number, string>;
};

type GanttWeek = {
  index: number;
  startDate: Date;
  endDate: Date;
};

type TarefaGantt = {
  tarefa: TarefaProjeto;
  inicio: Date;
  fim: Date;
  responsavelNome: string;
};

const DAY_MS = 1000 * 60 * 60 * 24;
const WEEK_WIDTH = 132;
const SEMANAS_POR_TELA = 8;

const progressoPorStatus: Record<string, number> = {
  backlog: 5,
  nova: 8,
  a_fazer: 15,
  triagem: 20,
  aguardando_info: 25,
  aprovada: 35,
  em_andamento: 55,
  execucao: 60,
  em_revisao: 78,
  validacao: 82,
  bloqueada: 22,
  concluida: 100,
  cancelada: 0,
};

function toDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function diffDays(start: Date, end: Date): number {
  const startUTC = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUTC = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.max(0, Math.floor((endUTC - startUTC) / DAY_MS));
}

function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

function formatDateBR(date: Date): string {
  return date.toLocaleDateString('pt-BR');
}

function formatWeekCompact(startDate: Date, endDate: Date): string {
  const inicio = startDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const fim = endDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `${inicio} - ${fim}`;
}

function calcularSemanaPorData(semanas: GanttWeek[], inicioEscala: Date, fimEscala: Date, referencia: Date): number | null {
  if (semanas.length === 0) return null;
  const dia = startOfDay(referencia);
  if (dia < inicioEscala) return 1;
  if (dia > fimEscala) return semanas.length;
  return Math.floor(diffDays(inicioEscala, dia) / 7) + 1;
}

function prioridadeClassName(prioridade: TarefaProjeto['prioridade']): string {
  switch (prioridade) {
    case 'baixa':
      return 'gantt-bar-baixa';
    case 'media':
      return 'gantt-bar-media';
    case 'alta':
      return 'gantt-bar-alta';
    case 'critica':
      return 'gantt-bar-critica';
    default:
      return 'gantt-bar-media';
  }
}

export default function ProjetoGantt({ projeto, tarefas, usuariosMap }: Props) {
  const [semanaExibicao, setSemanaExibicao] = useState(1);
  const [semanaSelecionada, setSemanaSelecionada] = useState<number | null>(null);

  const tarefasComDatas = useMemo<TarefaGantt[]>(() => {
    return tarefas
      .map((tarefa) => {
        const inicioRaw = tarefa.start_date || tarefa.due_date || projeto?.data_inicio || projeto?.data_fim_prevista;
        const fimRaw = tarefa.due_date || tarefa.start_date || projeto?.data_fim_prevista || projeto?.data_inicio;
        if (!inicioRaw || !fimRaw) return null;
        const inicio = startOfDay(toDate(inicioRaw));
        const fim = startOfDay(toDate(fimRaw));
        return {
          tarefa,
          inicio: inicio <= fim ? inicio : fim,
          fim: fim >= inicio ? fim : inicio,
          responsavelNome: tarefa.responsavel_id ? usuariosMap.get(tarefa.responsavel_id) || `Usuario ${tarefa.responsavel_id}` : '-',
        };
      })
      .filter((item): item is TarefaGantt => Boolean(item))
      .sort((a, b) => a.inicio.getTime() - b.inicio.getTime() || a.fim.getTime() - b.fim.getTime());
  }, [projeto?.data_fim_prevista, projeto?.data_inicio, tarefas, usuariosMap]);

  const tarefasSemDatas = useMemo(
    () => tarefas.filter((tarefa) => !tarefa.start_date && !tarefa.due_date),
    [tarefas]
  );

  const escala = useMemo(() => {
    if (!tarefasComDatas.length) return null;
    const minDate = tarefasComDatas.reduce((acc, item) => (item.inicio < acc ? item.inicio : acc), tarefasComDatas[0].inicio);
    const maxDate = tarefasComDatas.reduce((acc, item) => (item.fim > acc ? item.fim : acc), tarefasComDatas[0].fim);
    const inicioEscala = startOfWeek(minDate);
    const fimEscala = addDays(startOfWeek(maxDate), 6);
    const totalSemanas = Math.floor(diffDays(inicioEscala, fimEscala) / 7) + 1;
    const semanas: GanttWeek[] = Array.from({ length: totalSemanas }, (_, index) => {
      const startDate = addDays(inicioEscala, index * 7);
      const endDate = addDays(startDate, 6);
      return {
        index: index + 1,
        startDate,
        endDate,
      };
    });
    return { inicioEscala, fimEscala, semanas, minDate, maxDate };
  }, [tarefasComDatas]);

  const totalSemanas = escala?.semanas.length || 1;
  const semanaHoje = useMemo(() => {
    if (!escala) return null;
    return calcularSemanaPorData(escala.semanas, escala.inicioEscala, escala.fimEscala, new Date());
  }, [escala]);

  useEffect(() => {
    setSemanaExibicao((atual) => {
      if (atual < 1) return 1;
      if (atual > totalSemanas) return totalSemanas;
      return atual;
    });
  }, [totalSemanas]);

  const faixaVisivel = useMemo(() => {
    if (!escala) return null;
    const inicioSemana = Math.max(0, Math.min(semanaExibicao - 1, escala.semanas.length - 1));
    const fimSemana = Math.min(escala.semanas.length, inicioSemana + SEMANAS_POR_TELA);
    const semanasVisiveis = escala.semanas.slice(inicioSemana, fimSemana);
    if (!semanasVisiveis.length) return null;
    return {
      semanasVisiveis,
      startWeekOffset: inicioSemana,
      endWeekOffset: fimSemana - 1,
      timelineWidth: semanasVisiveis.length * WEEK_WIDTH,
    };
  }, [escala, semanaExibicao]);

  useEffect(() => {
    if (!faixaVisivel) return;
    const inicioVisivel = faixaVisivel.startWeekOffset + 1;
    const fimVisivel = faixaVisivel.endWeekOffset + 1;
    if (!semanaSelecionada || semanaSelecionada < inicioVisivel || semanaSelecionada > fimVisivel) {
      setSemanaSelecionada(inicioVisivel);
    }
  }, [faixaVisivel, semanaSelecionada]);

  const semanaSelecionadaInfo = useMemo(() => {
    if (!escala || !semanaSelecionada) return null;
    return escala.semanas.find((week) => week.index === semanaSelecionada) || null;
  }, [escala, semanaSelecionada]);

  const irParaSemanaHoje = () => {
    if (!semanaHoje) return;
    const maxInicio = Math.max(1, totalSemanas - SEMANAS_POR_TELA + 1);
    const inicioFaixa = Math.min(maxInicio, Math.max(1, semanaHoje - Math.floor(SEMANAS_POR_TELA / 2)));
    setSemanaExibicao(inicioFaixa);
    setSemanaSelecionada(semanaHoje);
  };

  if (!projeto) {
    return <div className="card">Selecione uma demanda para visualizar o Gantt.</div>;
  }

  if (!tarefas.length) {
    return <div className="card">Essa demanda ainda nao possui subdemandas para montar o Gantt.</div>;
  }

  if (!escala || !faixaVisivel) {
    return (
      <div className="card grid gap-12">
        <h3>Gantt das Subdemandas</h3>
        <p className="muted-text">
          Nenhuma subdemanda possui data de inicio ou prazo ainda. Cadastre datas para visualizar a timeline.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-16">
      <div className="card cronograma-toolbar">
        <div className="cronograma-toolbar-meta">
          <span>
            <strong>Demanda:</strong> {projeto.codigo} - {projeto.nome}
          </span>
          <span>
            <strong>Inicio:</strong> {formatDateBR(escala.minDate)}
          </span>
          <span>
            <strong>Fim:</strong> {formatDateBR(escala.maxDate)}
          </span>
        </div>

        <div className="cronograma-toolbar-filters">
          <div className="cronograma-semana-inline">
            <span>Semana inicial</span>
            <select value={semanaExibicao} onChange={(e) => setSemanaExibicao(Number(e.target.value))}>
              {Array.from({ length: totalSemanas }, (_, index) => index + 1).map((semana) => (
                <option key={semana} value={semana}>
                  Semana {semana}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="btn-secondary cronograma-btn-hoje" onClick={irParaSemanaHoje}>
            Ir para hoje
          </button>
        </div>
      </div>

      <div className="card gantt-header">
        <h3 style={{ marginBottom: 8 }}>Cronograma em Gantt</h3>
        <div className="gantt-week-detail">
          <strong>Janela visivel:</strong>
          <span>
            Semana {faixaVisivel.startWeekOffset + 1} a {faixaVisivel.endWeekOffset + 1}
          </span>
          {semanaSelecionadaInfo && (
            <>
              <strong>Semana selecionada:</strong>
              <span>{formatWeekCompact(semanaSelecionadaInfo.startDate, semanaSelecionadaInfo.endDate)}</span>
            </>
          )}
        </div>
      </div>

      <div className="card gantt-sheet-scroll">
        <div className="gantt-sheet" style={{ minWidth: 540 + faixaVisivel.timelineWidth }}>
          <div className="gantt-sheet-row gantt-sheet-row-head gantt-sheet-row-project">
            <div className="gantt-left-head gantt-left-head-project">
              <div>Subdemanda</div>
              <div>Setor</div>
              <div>Responsavel</div>
              <div>Status</div>
              <div>Prazo</div>
            </div>
            <div className="gantt-right-head">
              <div className="gantt-week-head-row">
                {faixaVisivel.semanasVisiveis.map((week) => (
                  <button
                    key={week.index}
                    type="button"
                    className={semanaSelecionada === week.index ? 'gantt-week-head-cell active' : 'gantt-week-head-cell'}
                    style={{ width: WEEK_WIDTH }}
                    onClick={() => setSemanaSelecionada(week.index)}
                  >
                    <span>Semana {week.index}</span>
                    <small>{formatWeekCompact(week.startDate, week.endDate)}</small>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {tarefasComDatas.map(({ tarefa, inicio, fim, responsavelNome }) => {
            const duracaoDias = Math.max(1, diffDays(inicio, fim) + 1);
            const offsetSemanas = diffDays(escala.inicioEscala, inicio) / 7 - faixaVisivel.startWeekOffset;
            const larguraSemanas = duracaoDias / 7;
            const left = Math.max(0, offsetSemanas * WEEK_WIDTH);
            const width = Math.max(42, larguraSemanas * WEEK_WIDTH);
            const percentual = progressoPorStatus[tarefa.status] ?? 20;

            return (
              <div key={tarefa.id} className="gantt-sheet-row gantt-task-row gantt-sheet-row-project">
                <div className="gantt-left-row gantt-left-row-project">
                  <div className="gantt-task-title">
                    <strong>{tarefa.titulo}</strong>
                    <small>
                      {formatDateBR(inicio)} ate {formatDateBR(fim)}
                    </small>
                  </div>
                  <div>{tarefa.setor || '-'}</div>
                  <div>{responsavelNome}</div>
                  <div>{TAREFA_PROJETO_STATUS_LABELS[tarefa.status]}</div>
                  <div>{tarefa.due_date || '-'}</div>
                </div>

                <div className="gantt-right-row">
                  <div className="gantt-week-grid">
                    {faixaVisivel.semanasVisiveis.map((week) => (
                      <div
                        key={week.index}
                        className={semanaSelecionada === week.index ? 'gantt-week-grid-cell active' : 'gantt-week-grid-cell'}
                        style={{ width: WEEK_WIDTH }}
                      />
                    ))}
                  </div>

                  <div
                    className={`gantt-bar ${prioridadeClassName(tarefa.prioridade)}`}
                    style={{ left, width, borderColor: PRIORIDADE_COR[tarefa.prioridade] }}
                    title={`${tarefa.titulo} | ${PRIORIDADE_LABELS[tarefa.prioridade]} | ${TAREFA_PROJETO_STATUS_LABELS[tarefa.status]}`}
                  >
                    <div className="gantt-bar-progress" style={{ width: `${percentual}%` }} />
                    <span className="gantt-bar-label">{tarefa.titulo}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!!tarefasSemDatas.length && (
        <div className="card grid gap-12">
          <h3>Subdemandas sem datas</h3>
          <div className="projeto-gantt-missing-list">
            {tarefasSemDatas.map((tarefa) => (
              <div key={tarefa.id} className="projeto-gantt-missing-item">
                <strong>{tarefa.titulo}</strong>
                <span>{tarefa.setor || 'Sem setor'} | {TAREFA_PROJETO_STATUS_LABELS[tarefa.status]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

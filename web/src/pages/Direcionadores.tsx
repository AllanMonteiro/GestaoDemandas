import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  api,
  ATIVIDADE_SUBDEMANDA_STATUS_LABELS,
  AtividadeSubdemanda,
  PRIORIDADE_LABELS,
  Projeto,
  PROJETO_STATUS_LABELS,
  TarefaProjeto,
  TAREFA_PROJETO_STATUS_LABELS,
} from '../api';

type SubdemandaDirecionador = {
  id: number;
  titulo: string;
  descricao?: string | null;
  status: TarefaProjeto['status'];
  prioridade: TarefaProjeto['prioridade'];
  due_date?: string | null;
  atividades: AtividadeSubdemanda[];
};

type DemandaDirecionador = {
  id: number;
  codigo: string;
  nome: string;
  descricao?: string | null;
  status: Projeto['status'];
  prioridade: Projeto['prioridade'];
  data_fim_prevista?: string | null;
  subdemandas: SubdemandaDirecionador[];
};

const CLASSE_ATIVIDADE_POR_STATUS: Record<AtividadeSubdemanda['status'], string> = {
  pendente: 'driver-idea-melhoria',
  concluida: 'driver-idea-neutra',
};

function ordenarTexto(a?: string | null, b?: string | null): number {
  return (a || '').localeCompare(b || '', 'pt-BR');
}

function statusDemandaAtiva(status: Projeto['status']): boolean {
  return status !== 'concluido' && status !== 'cancelado';
}

function statusSubdemandaAtiva(status: TarefaProjeto['status']): boolean {
  return status !== 'concluida';
}

function statusAtividadeAtiva(status: AtividadeSubdemanda['status']): boolean {
  return status !== 'concluida';
}

export default function Direcionadores() {
  const navigate = useNavigate();
  const [demandas, setDemandas] = useState<DemandaDirecionador[]>([]);
  const [mostrarApenasAtivas, setMostrarApenasAtivas] = useState(true);
  const [mostrarResumo, setMostrarResumo] = useState(false);
  const [subunidadeAtivaId, setSubunidadeAtivaId] = useState<number | 'todas'>('todas');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const carregarDirecionadores = async () => {
    setCarregando(true);
    setErro('');
    try {
      const { data: projetos } = await api.get<Projeto[]>('/projetos');
      const demandasMontadas = await Promise.all(
        projetos.map(async (projeto) => {
          const { data: tarefas } = await api.get<TarefaProjeto[]>(`/projetos/${projeto.id}/tarefas`);
          const tarefasOrdenadas = [...tarefas].sort(
            (a, b) => a.ordem - b.ordem || ordenarTexto(a.titulo, b.titulo) || b.id - a.id
          );

          const subdemandas = await Promise.all(
            tarefasOrdenadas.map(async (tarefa) => {
              let atividades: AtividadeSubdemanda[] = [];
              try {
                const resp = await api.get<AtividadeSubdemanda[]>(`/tarefas/${tarefa.id}/atividades`);
                atividades = resp.data;
              } catch (err: any) {
                // Compatibilidade com API antiga que ainda não expõe rotas de atividades.
                if (err?.response?.status !== 404) throw err;
              }
              return {
                id: tarefa.id,
                titulo: tarefa.titulo,
                descricao: tarefa.descricao,
                status: tarefa.status,
                prioridade: tarefa.prioridade,
                due_date: tarefa.due_date,
                atividades: [...atividades].sort((a, b) => a.ordem - b.ordem || a.id - b.id),
              } satisfies SubdemandaDirecionador;
            })
          );

          return {
            id: projeto.id,
            codigo: projeto.codigo,
            nome: projeto.nome,
            descricao: projeto.descricao,
            status: projeto.status,
            prioridade: projeto.prioridade,
            data_fim_prevista: projeto.data_fim_prevista,
            subdemandas,
          } satisfies DemandaDirecionador;
        })
      );

      demandasMontadas.sort((a, b) => ordenarTexto(`${a.codigo} ${a.nome}`, `${b.codigo} ${b.nome}`));
      setDemandas(demandasMontadas);
    } catch (err: any) {
      setErro(err?.response?.data?.detail || 'Falha ao carregar direcionadores de demandas.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregarDirecionadores();
  }, []);

  const estrutura = useMemo(() => {
    const demandasBase = demandas
      .map((demanda) => {
        const subdemandasFiltradas = demanda.subdemandas
          .map((subdemanda) => {
            const atividadesFiltradas = mostrarApenasAtivas
              ? subdemanda.atividades.filter((atividade) => statusAtividadeAtiva(atividade.status))
              : subdemanda.atividades;
            return {
              ...subdemanda,
              atividades: atividadesFiltradas,
            };
          })
          .filter(
            (subdemanda) =>
              !mostrarApenasAtivas ||
              statusSubdemandaAtiva(subdemanda.status) ||
              subdemanda.atividades.length > 0
          );

        return {
          ...demanda,
          subdemandas: subdemandasFiltradas,
        };
      })
      .filter(
        (demanda) =>
          !mostrarApenasAtivas ||
          statusDemandaAtiva(demanda.status) ||
          demanda.subdemandas.length > 0
      );

    if (subunidadeAtivaId === 'todas') return demandasBase;
    return demandasBase.filter((demanda) => demanda.id === subunidadeAtivaId);
  }, [demandas, mostrarApenasAtivas, subunidadeAtivaId]);

  useEffect(() => {
    if (subunidadeAtivaId === 'todas') return;
    const existe = demandas.some((item) => item.id === subunidadeAtivaId);
    if (!existe) {
      setSubunidadeAtivaId('todas');
    }
  }, [demandas, subunidadeAtivaId]);

  const resumo = useMemo(() => {
    const primarios = estrutura.length;
    const secundarios = estrutura.reduce((acc, item) => acc + item.subdemandas.length, 0);
    const atividades = estrutura.reduce(
      (acc, item) => acc + item.subdemandas.reduce((subAcc, sub) => subAcc + sub.atividades.length, 0),
      0
    );
    const secundariosSemAtividades = estrutura.reduce(
      (acc, item) => acc + item.subdemandas.filter((sub) => sub.atividades.length === 0).length,
      0
    );
    return {
      primarios,
      secundarios,
      atividades,
      secundariosSemAtividades,
    };
  }, [estrutura]);

  return (
    <div className="grid gap-16">
      <div className="between">
        <h2>Diagrama de Direcionadores de Demandas</h2>
        <div className="drivers-toolbar-actions">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={mostrarApenasAtivas}
              onChange={(e) => setMostrarApenasAtivas(e.target.checked)}
            />
            <span>Mostrar apenas ativas</span>
          </label>
          <button type="button" className="btn-secondary" onClick={() => setMostrarResumo((state) => !state)}>
            {mostrarResumo ? 'Ocultar resumo' : 'Relatorio de resumo'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => void carregarDirecionadores()}>
            Atualizar
          </button>
          <button type="button" className="btn-secondary" onClick={() => window.print()}>
            Imprimir diagrama
          </button>
        </div>
      </div>

      {erro && <div className="error">{erro}</div>}
      {carregando && <div className="card">Carregando direcionadores...</div>}

      {mostrarResumo && (
        <div className="card drivers-summary">
          <div>
            <span>Direcionadores primarios</span>
            <strong>{resumo.primarios}</strong>
          </div>
          <div>
            <span>Direcionadores secundarios</span>
            <strong>{resumo.secundarios}</strong>
          </div>
          <div>
            <span>Atividades</span>
            <strong>{resumo.atividades}</strong>
          </div>
          <div>
            <span>Secundarios sem atividades</span>
            <strong>{resumo.secundariosSemAtividades}</strong>
          </div>
          <div>
            <span>Subunidade ativa</span>
            <strong>{subunidadeAtivaId === 'todas' ? 'Todas' : subunidadeAtivaId}</strong>
          </div>
        </div>
      )}

      <div className="card">
        <div className="driver-subunidade-tabs">
          <button
            type="button"
            className={subunidadeAtivaId === 'todas' ? 'driver-subunidade-tab active' : 'driver-subunidade-tab'}
            onClick={() => setSubunidadeAtivaId('todas')}
          >
            Todas as subunidades
          </button>
          {demandas.map((demanda) => (
            <button
              key={demanda.id}
              type="button"
              className={subunidadeAtivaId === demanda.id ? 'driver-subunidade-tab active' : 'driver-subunidade-tab'}
              onClick={() => setSubunidadeAtivaId(demanda.id)}
            >
              {demanda.codigo} - {demanda.nome}
            </button>
          ))}
        </div>
      </div>

      <div className="card drivers-board">
        {estrutura.length === 0 ? (
          <p>Nao ha demandas/subdemandas para os filtros atuais.</p>
        ) : (
          <>
            <div className="drivers-columns-header">
              <h3>Direcionador primario (demanda)</h3>
              <h3>Direcionador secundario (subdemanda)</h3>
              <h3>Atividades</h3>
            </div>

            <div className="drivers-rows">
              {estrutura.map((demanda) => (
                <div key={demanda.id} className="drivers-row">
                  <div className="drivers-col">
                    <article className="driver-card driver-card-primary">
                      <span className="driver-code">{demanda.codigo}</span>
                      <p>{demanda.nome}</p>
                      <div className="driver-card-footer">
                        <span>{PROJETO_STATUS_LABELS[demanda.status]}</span>
                        <span>{PRIORIDADE_LABELS[demanda.prioridade]}</span>
                        <span>Prazo: {demanda.data_fim_prevista || '-'}</span>
                        <span>{demanda.subdemandas.length} subdemandas</span>
                      </div>
                    </article>
                  </div>

                  <div className="drivers-col">
                    {demanda.subdemandas.length === 0 ? (
                      <article className="driver-card driver-card-secondary">
                        <span className="driver-code">Sem subdemanda</span>
                        <p>Esta demanda ainda nao possui subdemandas.</p>
                        <div className="driver-card-footer">
                          <button type="button" className="btn-secondary" onClick={() => navigate('/demandas')}>
                            Abrir demandas
                          </button>
                        </div>
                      </article>
                    ) : (
                      demanda.subdemandas.map((subdemanda) => (
                        <article key={subdemanda.id} className="driver-card driver-card-secondary">
                          <span className="driver-code">SUB {subdemanda.id}</span>
                          <p>{subdemanda.titulo}</p>
                          <div className="driver-card-footer">
                            <span>{TAREFA_PROJETO_STATUS_LABELS[subdemanda.status]}</span>
                            <span>{PRIORIDADE_LABELS[subdemanda.prioridade]}</span>
                            <span>Prazo: {subdemanda.due_date || '-'}</span>
                            <span>{subdemanda.atividades.length} atividades</span>
                          </div>
                        </article>
                      ))
                    )}
                  </div>

                  <div className="drivers-col">
                    {demanda.subdemandas.length === 0 ? (
                      <article className="driver-idea-card driver-idea-empty">
                        <p>Sem subdemandas para listar atividades.</p>
                        <button type="button" className="btn-secondary" onClick={() => navigate('/demandas')}>
                          Cadastrar subdemanda
                        </button>
                      </article>
                    ) : (
                      demanda.subdemandas.map((subdemanda) => (
                        <div key={`atividades-${subdemanda.id}`} className="driver-idea-group">
                          {subdemanda.atividades.length === 0 ? (
                            <article className="driver-idea-card driver-idea-empty">
                              <p>Sem atividade cadastrada nesta subdemanda.</p>
                              <button type="button" className="btn-secondary" onClick={() => navigate('/demandas')}>
                                Cadastrar atividade
                              </button>
                            </article>
                          ) : (
                            subdemanda.atividades.map((atividade) => (
                              <article
                                key={atividade.id}
                                className={`driver-idea-card ${CLASSE_ATIVIDADE_POR_STATUS[atividade.status]}`}
                              >
                                <div className="driver-idea-head">
                                  <strong>{atividade.titulo}</strong>
                                  <span>{ATIVIDADE_SUBDEMANDA_STATUS_LABELS[atividade.status]}</span>
                                </div>
                                <p>{atividade.descricao || 'Sem descricao cadastrada.'}</p>
                                <div className="driver-idea-footer">
                                  <small>Ordem {atividade.ordem}</small>
                                  <button type="button" className="btn-secondary" onClick={() => navigate('/demandas')}>
                                    Abrir demanda
                                  </button>
                                </div>
                              </article>
                            ))
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

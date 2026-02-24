import { FormEvent, useEffect, useMemo, useState } from 'react';

import {
  api,
  Prioridade,
  PRIORIDADE_LABELS,
  Projeto,
  ProjetoStatus,
  PROJETO_STATUS_LABELS,
  TarefaProjeto,
  TarefaProjetoStatus,
  TAREFA_PROJETO_STATUS_LABELS,
  Usuario,
} from '../api';
import Table from '../components/Table';

const STATUS_PROJETO_LIST: ProjetoStatus[] = ['planejamento', 'em_andamento', 'pausado', 'concluido', 'cancelado'];
const STATUS_TAREFA_LIST: TarefaProjetoStatus[] = [
  'backlog',
  'a_fazer',
  'em_andamento',
  'em_revisao',
  'bloqueada',
  'concluida',
];
const PRIORIDADE_LIST: Prioridade[] = ['baixa', 'media', 'alta', 'critica'];

export default function Projetos() {
  const [usuarioAtual, setUsuarioAtual] = useState<Usuario | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [projetoSelecionadoId, setProjetoSelecionadoId] = useState<number | null>(null);
  const [demandaVinculoId, setDemandaVinculoId] = useState<number | null>(null);
  const [tarefas, setTarefas] = useState<TarefaProjeto[]>([]);
  const [filtroStatusProjeto, setFiltroStatusProjeto] = useState('');
  const [somenteAtrasados, setSomenteAtrasados] = useState(false);
  const [filtroStatusTarefa, setFiltroStatusTarefa] = useState('');
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [contagemSubdemandas, setContagemSubdemandas] = useState<Record<number, number>>({});

  const [novoProjeto, setNovoProjeto] = useState({
    codigo: '',
    nome: '',
    descricao: '',
    prioridade: 'media' as Prioridade,
    status: 'planejamento' as ProjetoStatus,
    data_inicio: '',
    data_fim_prevista: '',
    gerente_id: '',
    progresso: 0,
  });

  const [novaTarefa, setNovaTarefa] = useState({
    titulo: '',
    descricao: '',
    prioridade: 'media' as Prioridade,
    status: 'backlog' as TarefaProjetoStatus,
    responsavel_id: '',
    start_date: '',
    due_date: '',
    estimativa_horas: '',
  });

  const usuariosMap = useMemo(() => new Map(usuarios.map((u) => [u.id, u.nome])), [usuarios]);
  const demandaSelecionada = useMemo(
    () => projetos.find((projeto) => projeto.id === projetoSelecionadoId) || null,
    [projetos, projetoSelecionadoId]
  );

  const podeGerenciarProjetos = usuarioAtual?.role === 'ADMIN' || usuarioAtual?.role === 'GESTOR';
  const podeCriarTarefas = podeGerenciarProjetos || usuarioAtual?.role === 'AUDITOR';
  const podeEditarTarefa =
    usuarioAtual?.role === 'ADMIN' ||
    usuarioAtual?.role === 'GESTOR' ||
    usuarioAtual?.role === 'AUDITOR' ||
    usuarioAtual?.role === 'RESPONSAVEL';

  const carregarContexto = async () => {
    try {
      const [meResp, usuariosResp] = await Promise.all([
        api.get<Usuario>('/auth/me'),
        api.get<Usuario[]>('/usuarios').catch(() => ({ data: [] as Usuario[] })),
      ]);
      setUsuarioAtual(meResp.data);
      setUsuarios(usuariosResp.data);
    } catch {
      setErro('Nao foi possivel carregar contexto do usuario.');
    }
  };

  const carregarProjetos = async () => {
    setErro('');
    try {
      const { data } = await api.get<Projeto[]>('/projetos', {
        params: {
          status_projeto: filtroStatusProjeto || undefined,
          atrasados: somenteAtrasados || undefined,
        },
      });
      setProjetos(data);
      if (!data.length) {
        setContagemSubdemandas({});
        return;
      }
      const contagens = await Promise.all(
        data.map(async (demanda) => {
          try {
            const resp = await api.get<TarefaProjeto[]>(`/projetos/${demanda.id}/tarefas`);
            return [demanda.id, resp.data.length] as const;
          } catch {
            return [demanda.id, 0] as const;
          }
        })
      );
      setContagemSubdemandas(Object.fromEntries(contagens));
    } catch (err: any) {
      setErro(err?.response?.data?.detail || 'Falha ao carregar demandas.');
    }
  };

  const carregarTarefas = async (projetoId: number) => {
    setErro('');
    try {
      const { data } = await api.get<TarefaProjeto[]>(`/projetos/${projetoId}/tarefas`, {
        params: {
          status_tarefa: filtroStatusTarefa || undefined,
        },
      });
      setTarefas(data);
    } catch (err: any) {
      setErro(err?.response?.data?.detail || 'Falha ao carregar subdemandas.');
    }
  };

  useEffect(() => {
    void carregarContexto();
  }, []);

  useEffect(() => {
    void carregarProjetos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroStatusProjeto, somenteAtrasados]);

  useEffect(() => {
    if (!projetos.length) {
      setProjetoSelecionadoId(null);
      setDemandaVinculoId(null);
      setTarefas([]);
      return;
    }
    if (!projetoSelecionadoId || !projetos.some((projeto) => projeto.id === projetoSelecionadoId)) {
      setProjetoSelecionadoId(projetos[0].id);
    }
  }, [projetos, projetoSelecionadoId]);

  useEffect(() => {
    setDemandaVinculoId(projetoSelecionadoId);
  }, [projetoSelecionadoId]);

  useEffect(() => {
    if (!projetoSelecionadoId) {
      setTarefas([]);
      return;
    }
    void carregarTarefas(projetoSelecionadoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetoSelecionadoId, filtroStatusTarefa]);

  const criarProjeto = async (e: FormEvent) => {
    e.preventDefault();
    if (!podeGerenciarProjetos) return;
    setErro('');
    setMensagem('');
    try {
      const { data: demandaCriada } = await api.post<Projeto>('/projetos', {
        codigo: novoProjeto.codigo.trim(),
        nome: novoProjeto.nome.trim(),
        descricao: novoProjeto.descricao || undefined,
        prioridade: novoProjeto.prioridade,
        status: novoProjeto.status,
        data_inicio: novoProjeto.data_inicio || undefined,
        data_fim_prevista: novoProjeto.data_fim_prevista || undefined,
        gerente_id: novoProjeto.gerente_id ? Number(novoProjeto.gerente_id) : undefined,
        progresso: Number(novoProjeto.progresso) || 0,
      });
      setNovoProjeto({
        codigo: '',
        nome: '',
        descricao: '',
        prioridade: 'media',
        status: 'planejamento',
        data_inicio: '',
        data_fim_prevista: '',
        gerente_id: '',
        progresso: 0,
      });
      setProjetoSelecionadoId(demandaCriada.id);
      setFiltroStatusTarefa('');
      setMensagem(`Demanda criada com sucesso. Demanda ativa: ${demandaCriada.codigo} - ${demandaCriada.nome}.`);
      await carregarProjetos();
      await carregarTarefas(demandaCriada.id);
    } catch (err: any) {
      setErro(err?.response?.data?.detail || 'Falha ao criar demanda.');
    }
  };

  const criarTarefa = async (e: FormEvent) => {
    e.preventDefault();
    if (!podeCriarTarefas) return;
    const demandaAlvoId = demandaVinculoId || projetoSelecionadoId;
    if (!demandaAlvoId) {
      setErro('Selecione uma demanda antes de criar subdemanda.');
      return;
    }
    setErro('');
    setMensagem('');
    try {
      await api.post(`/projetos/${demandaAlvoId}/tarefas`, {
        titulo: novaTarefa.titulo.trim(),
        descricao: novaTarefa.descricao || undefined,
        prioridade: novaTarefa.prioridade,
        status: novaTarefa.status,
        responsavel_id: novaTarefa.responsavel_id ? Number(novaTarefa.responsavel_id) : undefined,
        start_date: novaTarefa.start_date || undefined,
        due_date: novaTarefa.due_date || undefined,
        estimativa_horas: novaTarefa.estimativa_horas ? Number(novaTarefa.estimativa_horas) : undefined,
      });
      setNovaTarefa({
        titulo: '',
        descricao: '',
        prioridade: 'media',
        status: 'backlog',
        responsavel_id: '',
        start_date: '',
        due_date: '',
        estimativa_horas: '',
      });
      const demandaAlvo = projetos.find((projeto) => projeto.id === demandaAlvoId) || null;
      const rotuloDemanda = demandaAlvo ? `${demandaAlvo.codigo} - ${demandaAlvo.nome}` : `ID ${demandaAlvoId}`;
      setMensagem(`Subdemanda criada e vinculada a demanda ${rotuloDemanda}.`);
      setProjetoSelecionadoId(demandaAlvoId);
      setDemandaVinculoId(demandaAlvoId);
      await carregarProjetos();
      await carregarTarefas(demandaAlvoId);
    } catch (err: any) {
      setErro(err?.response?.data?.detail || 'Falha ao criar subdemanda.');
    }
  };

  const atualizarStatusProjeto = async (projetoId: number, statusProjeto: ProjetoStatus) => {
    if (!podeGerenciarProjetos) return;
    setErro('');
    setMensagem('');
    try {
      await api.patch(`/projetos/${projetoId}/status`, { status: statusProjeto });
      setMensagem('Status da demanda atualizado.');
      await carregarProjetos();
    } catch (err: any) {
      setErro(err?.response?.data?.detail || 'Falha ao atualizar status da demanda.');
    }
  };

  const atualizarStatusTarefa = async (tarefaId: number, statusTarefa: TarefaProjetoStatus) => {
    if (!podeEditarTarefa) return;
    setErro('');
    setMensagem('');
    try {
      await api.patch(`/tarefas/${tarefaId}/status`, { status: statusTarefa });
      setMensagem('Status da subdemanda atualizado.');
      if (projetoSelecionadoId) {
        await carregarTarefas(projetoSelecionadoId);
      }
    } catch (err: any) {
      setErro(err?.response?.data?.detail || 'Falha ao atualizar subdemanda.');
    }
  };

  const removerProjeto = async (projetoId: number) => {
    if (!podeGerenciarProjetos) return;
    setErro('');
    setMensagem('');
    try {
      await api.delete(`/projetos/${projetoId}`);
      setMensagem('Demanda removida.');
      await carregarProjetos();
    } catch (err: any) {
      setErro(err?.response?.data?.detail || 'Falha ao remover demanda.');
    }
  };

  const removerTarefa = async (tarefaId: number) => {
    if (!podeCriarTarefas || !projetoSelecionadoId) return;
    setErro('');
    setMensagem('');
    try {
      await api.delete(`/tarefas/${tarefaId}`);
      setMensagem('Subdemanda removida.');
      await carregarProjetos();
      await carregarTarefas(projetoSelecionadoId);
    } catch (err: any) {
      setErro(err?.response?.data?.detail || 'Falha ao remover subdemanda.');
    }
  };

  return (
    <div className="grid gap-16">
      <h2>Gestao de Demandas</h2>

      <div className="card">
        <div className="filters-row">
          <label className="form-row compact">
            <span>Status da Demanda</span>
            <select value={filtroStatusProjeto} onChange={(e) => setFiltroStatusProjeto(e.target.value)}>
              <option value="">Todos</option>
              {STATUS_PROJETO_LIST.map((status) => (
                <option key={status} value={status}>
                  {PROJETO_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>

          <label className="form-row compact checkbox-row">
            <input
              type="checkbox"
              checked={somenteAtrasados}
              onChange={(e) => setSomenteAtrasados(e.target.checked)}
            />
            <span>Somente atrasados</span>
          </label>
        </div>

        {erro && <div className="error">{erro}</div>}
        {mensagem && <div className="success">{mensagem}</div>}

        <Table
          rows={projetos}
          emptyText="Nenhuma demanda encontrada."
          columns={[
            {
              title: 'Abrir',
              render: (projeto) => (
                <button type="button" className="btn-secondary" onClick={() => setProjetoSelecionadoId(projeto.id)}>
                  {projetoSelecionadoId === projeto.id ? 'Selecionado' : 'Selecionar'}
                </button>
              ),
            },
            { title: 'Codigo', render: (projeto) => projeto.codigo },
            { title: 'Nome', render: (projeto) => projeto.nome },
            {
              title: 'Status',
              render: (projeto) =>
                podeGerenciarProjetos ? (
                  <select
                    value={projeto.status}
                    onChange={(e) => atualizarStatusProjeto(projeto.id, e.target.value as ProjetoStatus)}
                  >
                    {STATUS_PROJETO_LIST.map((status) => (
                      <option key={status} value={status}>
                        {PROJETO_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                ) : (
                  PROJETO_STATUS_LABELS[projeto.status]
                ),
            },
            { title: 'Prioridade', render: (projeto) => PRIORIDADE_LABELS[projeto.prioridade] },
            { title: 'Progresso', render: (projeto) => `${projeto.progresso}%` },
            { title: 'Subdemandas', render: (projeto) => contagemSubdemandas[projeto.id] ?? 0 },
            {
              title: 'Responsavel',
              render: (projeto) =>
                projeto.gerente_id ? usuariosMap.get(projeto.gerente_id) || projeto.gerente_id : '-',
            },
            { title: 'Prazo', render: (projeto) => projeto.data_fim_prevista || '-' },
            {
              title: 'Acao',
              render: (projeto) =>
                podeGerenciarProjetos ? (
                  <button type="button" className="btn-danger" onClick={() => removerProjeto(projeto.id)}>
                    Remover
                  </button>
                ) : (
                  '-'
                ),
            },
          ]}
        />
      </div>

      {podeGerenciarProjetos && (
        <div className="card">
          <h3>Nova Demanda</h3>
          <form className="grid gap-12" onSubmit={criarProjeto}>
            <div className="grid three-col gap-12">
              <label className="form-row">
                <span>Codigo</span>
                <input
                  value={novoProjeto.codigo}
                  onChange={(e) => setNovoProjeto((prev) => ({ ...prev, codigo: e.target.value }))}
                  required
                />
              </label>
              <label className="form-row">
                <span>Nome</span>
                <input
                  value={novoProjeto.nome}
                  onChange={(e) => setNovoProjeto((prev) => ({ ...prev, nome: e.target.value }))}
                  required
                />
              </label>
              <label className="form-row">
                <span>Responsavel</span>
                <select
                  value={novoProjeto.gerente_id}
                  onChange={(e) => setNovoProjeto((prev) => ({ ...prev, gerente_id: e.target.value }))}
                >
                  <option value="">Nao definido</option>
                  {usuarios.map((usuario) => (
                    <option key={usuario.id} value={usuario.id}>
                      {usuario.nome}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="form-row">
              <span>Descricao</span>
              <textarea
                value={novoProjeto.descricao}
                onChange={(e) => setNovoProjeto((prev) => ({ ...prev, descricao: e.target.value }))}
                rows={3}
              />
            </label>

            <div className="grid four-col gap-12">
              <label className="form-row">
                <span>Status Inicial</span>
                <select
                  value={novoProjeto.status}
                  onChange={(e) => setNovoProjeto((prev) => ({ ...prev, status: e.target.value as ProjetoStatus }))}
                >
                  {STATUS_PROJETO_LIST.map((status) => (
                    <option key={status} value={status}>
                      {PROJETO_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-row">
                <span>Prioridade</span>
                <select
                  value={novoProjeto.prioridade}
                  onChange={(e) => setNovoProjeto((prev) => ({ ...prev, prioridade: e.target.value as Prioridade }))}
                >
                  {PRIORIDADE_LIST.map((prioridade) => (
                    <option key={prioridade} value={prioridade}>
                      {PRIORIDADE_LABELS[prioridade]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-row">
                <span>Inicio</span>
                <input
                  type="date"
                  value={novoProjeto.data_inicio}
                  onChange={(e) => setNovoProjeto((prev) => ({ ...prev, data_inicio: e.target.value }))}
                />
              </label>
              <label className="form-row">
                <span>Fim Previsto</span>
                <input
                  type="date"
                  value={novoProjeto.data_fim_prevista}
                  onChange={(e) => setNovoProjeto((prev) => ({ ...prev, data_fim_prevista: e.target.value }))}
                />
              </label>
            </div>

            <button type="submit">Criar Demanda</button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="between">
          <h3>Subdemandas da Demanda</h3>
          <label className="form-row compact">
            <span>Status</span>
            <select value={filtroStatusTarefa} onChange={(e) => setFiltroStatusTarefa(e.target.value)}>
              <option value="">Todos</option>
              {STATUS_TAREFA_LIST.map((status) => (
                <option key={status} value={status}>
                  {TAREFA_PROJETO_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="muted-text" style={{ marginTop: 8 }}>
          Demanda ativa:{' '}
          <strong>{demandaSelecionada ? `${demandaSelecionada.codigo} - ${demandaSelecionada.nome}` : 'nenhuma'}</strong>
        </div>

        {!projetoSelecionadoId && <div className="muted-text">Selecione uma demanda para visualizar as subdemandas.</div>}

        {projetoSelecionadoId && (
          <Table
            rows={tarefas}
            emptyText="Sem subdemandas para os filtros atuais."
            columns={[
              { title: 'Titulo', render: (tarefa) => tarefa.titulo },
              {
                title: 'Responsavel',
                render: (tarefa) =>
                  tarefa.responsavel_id ? usuariosMap.get(tarefa.responsavel_id) || tarefa.responsavel_id : '-',
              },
              { title: 'Prioridade', render: (tarefa) => PRIORIDADE_LABELS[tarefa.prioridade] },
              { title: 'Inicio', render: (tarefa) => tarefa.start_date || '-' },
              { title: 'Prazo', render: (tarefa) => tarefa.due_date || '-' },
              { title: 'Horas', render: (tarefa) => tarefa.horas_registradas },
              {
                title: 'Status',
                render: (tarefa) =>
                  podeEditarTarefa ? (
                    <select
                      value={tarefa.status}
                      onChange={(e) => atualizarStatusTarefa(tarefa.id, e.target.value as TarefaProjetoStatus)}
                    >
                      {STATUS_TAREFA_LIST.map((status) => (
                        <option key={status} value={status}>
                          {TAREFA_PROJETO_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    TAREFA_PROJETO_STATUS_LABELS[tarefa.status]
                  ),
              },
              {
                title: 'Acao',
                render: (tarefa) =>
                  podeCriarTarefas ? (
                    <button type="button" className="btn-danger" onClick={() => removerTarefa(tarefa.id)}>
                      Remover
                    </button>
                  ) : (
                    '-'
                  ),
              },
            ]}
          />
        )}
      </div>

      {projetoSelecionadoId && podeCriarTarefas && (
        <div className="card">
          <h3>Nova Subdemanda</h3>
          <p className="muted-text">
            Vinculo atual: <strong>{demandaSelecionada ? `${demandaSelecionada.codigo} - ${demandaSelecionada.nome}` : '-'}</strong>
          </p>
          <form className="grid gap-12" onSubmit={criarTarefa}>
            <div className="grid three-col gap-12">
              <label className="form-row">
                <span>Vincular a Demanda</span>
                <select
                  value={demandaVinculoId ?? ''}
                  onChange={(e) => setDemandaVinculoId(e.target.value ? Number(e.target.value) : null)}
                  required
                >
                  <option value="">Selecione</option>
                  {projetos.map((projeto) => (
                    <option key={projeto.id} value={projeto.id}>
                      {projeto.codigo} - {projeto.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-row">
                <span>Titulo</span>
                <input
                  value={novaTarefa.titulo}
                  onChange={(e) => setNovaTarefa((prev) => ({ ...prev, titulo: e.target.value }))}
                  required
                />
              </label>
              <label className="form-row">
                <span>Responsavel</span>
                <select
                  value={novaTarefa.responsavel_id}
                  onChange={(e) => setNovaTarefa((prev) => ({ ...prev, responsavel_id: e.target.value }))}
                >
                  <option value="">Nao definido</option>
                  {usuarios.map((usuario) => (
                    <option key={usuario.id} value={usuario.id}>
                      {usuario.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-row">
                <span>Status Inicial</span>
                <select
                  value={novaTarefa.status}
                  onChange={(e) =>
                    setNovaTarefa((prev) => ({ ...prev, status: e.target.value as TarefaProjetoStatus }))
                  }
                >
                  {STATUS_TAREFA_LIST.map((status) => (
                    <option key={status} value={status}>
                      {TAREFA_PROJETO_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="form-row">
              <span>Descricao</span>
              <textarea
                value={novaTarefa.descricao}
                onChange={(e) => setNovaTarefa((prev) => ({ ...prev, descricao: e.target.value }))}
                rows={3}
              />
            </label>

            <div className="grid four-col gap-12">
              <label className="form-row">
                <span>Prioridade</span>
                <select
                  value={novaTarefa.prioridade}
                  onChange={(e) => setNovaTarefa((prev) => ({ ...prev, prioridade: e.target.value as Prioridade }))}
                >
                  {PRIORIDADE_LIST.map((prioridade) => (
                    <option key={prioridade} value={prioridade}>
                      {PRIORIDADE_LABELS[prioridade]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-row">
                <span>Inicio</span>
                <input
                  type="date"
                  value={novaTarefa.start_date}
                  onChange={(e) => setNovaTarefa((prev) => ({ ...prev, start_date: e.target.value }))}
                />
              </label>
              <label className="form-row">
                <span>Prazo</span>
                <input
                  type="date"
                  value={novaTarefa.due_date}
                  onChange={(e) => setNovaTarefa((prev) => ({ ...prev, due_date: e.target.value }))}
                />
              </label>
              <label className="form-row">
                <span>Estimativa (h)</span>
                <input
                  type="number"
                  min={0}
                  value={novaTarefa.estimativa_horas}
                  onChange={(e) => setNovaTarefa((prev) => ({ ...prev, estimativa_horas: e.target.value }))}
                />
              </label>
            </div>

            <button type="submit">Criar Subdemanda</button>
          </form>
        </div>
      )}
    </div>
  );
}

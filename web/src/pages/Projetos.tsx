import { FormEvent, useEffect, useMemo, useState } from 'react';

import {
  ATIVIDADE_SUBDEMANDA_STATUS_LABELS,
  AtividadeSubdemanda,
  AtividadeSubdemandaStatus,
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
const STATUS_ATIVIDADE_LIST: AtividadeSubdemandaStatus[] = ['pendente', 'concluida'];
const PRIORIDADE_LIST: Prioridade[] = ['baixa', 'media', 'alta', 'critica'];

export default function Projetos() {
  const [usuarioAtual, setUsuarioAtual] = useState<Usuario | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [projetoSelecionadoId, setProjetoSelecionadoId] = useState<number | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<'demandas' | 'subdemandas'>('demandas');
  const [tarefas, setTarefas] = useState<TarefaProjeto[]>([]);
  const [tarefaSelecionadaId, setTarefaSelecionadaId] = useState<number | null>(null);
  const [atividades, setAtividades] = useState<AtividadeSubdemanda[]>([]);
  const [filtroStatusProjeto, setFiltroStatusProjeto] = useState('');
  const [somenteAtrasados, setSomenteAtrasados] = useState(false);
  const [filtroStatusTarefa, setFiltroStatusTarefa] = useState('');
  const [filtroStatusAtividade, setFiltroStatusAtividade] = useState('');
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

  const [novaAtividade, setNovaAtividade] = useState({
    titulo: '',
    descricao: '',
    ordem: '',
  });

  const usuariosMap = useMemo(() => new Map(usuarios.map((u) => [u.id, u.nome])), [usuarios]);
  const demandaSelecionada = useMemo(
    () => projetos.find((projeto) => projeto.id === projetoSelecionadoId) || null,
    [projetos, projetoSelecionadoId]
  );
  const subdemandaSelecionada = useMemo(
    () => tarefas.find((tarefa) => tarefa.id === tarefaSelecionadaId) || null,
    [tarefas, tarefaSelecionadaId]
  );

  const podeGerenciarProjetos = usuarioAtual?.role === 'ADMIN' || usuarioAtual?.role === 'GESTOR';
  const podeCriarTarefas = podeGerenciarProjetos || usuarioAtual?.role === 'AUDITOR';
  const podeEditarTarefa =
    usuarioAtual?.role === 'ADMIN' ||
    usuarioAtual?.role === 'GESTOR' ||
    usuarioAtual?.role === 'AUDITOR' ||
    usuarioAtual?.role === 'RESPONSAVEL';
  const podeCriarAtividades = podeCriarTarefas || usuarioAtual?.role === 'RESPONSAVEL';

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

  const carregarAtividades = async (tarefaId: number) => {
    setErro('');
    try {
      const { data } = await api.get<AtividadeSubdemanda[]>(`/tarefas/${tarefaId}/atividades`, {
        params: {
          status_atividade: filtroStatusAtividade || undefined,
        },
      });
      setAtividades(data);
    } catch (err: any) {
      setErro(err?.response?.data?.detail || 'Falha ao carregar atividades.');
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
      setTarefas([]);
      return;
    }
    if (!projetoSelecionadoId || !projetos.some((projeto) => projeto.id === projetoSelecionadoId)) {
      setProjetoSelecionadoId(projetos[0].id);
    }
  }, [projetos, projetoSelecionadoId]);

  useEffect(() => {
    if (!projetoSelecionadoId) {
      setTarefas([]);
      setTarefaSelecionadaId(null);
      setAtividades([]);
      return;
    }
    void carregarTarefas(projetoSelecionadoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetoSelecionadoId, filtroStatusTarefa]);

  useEffect(() => {
    if (!tarefas.length) {
      setTarefaSelecionadaId(null);
      setAtividades([]);
      return;
    }
    if (!tarefaSelecionadaId || !tarefas.some((tarefa) => tarefa.id === tarefaSelecionadaId)) {
      setTarefaSelecionadaId(tarefas[0].id);
    }
  }, [tarefas, tarefaSelecionadaId]);

  useEffect(() => {
    if (!tarefaSelecionadaId) {
      setAtividades([]);
      return;
    }
    void carregarAtividades(tarefaSelecionadaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefaSelecionadaId, filtroStatusAtividade]);

  const abrirSubdemandasDaDemanda = (projetoId: number) => {
    setProjetoSelecionadoId(projetoId);
    setAbaAtiva('subdemandas');
  };

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
    const demandaAlvoId = projetoSelecionadoId;
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

  const alternarCheckSubdemanda = async (tarefa: TarefaProjeto, checked: boolean) => {
    const novoStatus: TarefaProjetoStatus = checked ? 'concluida' : 'a_fazer';
    await atualizarStatusTarefa(tarefa.id, novoStatus);
  };

  const criarAtividade = async (e: FormEvent) => {
    e.preventDefault();
    if (!podeCriarAtividades || !tarefaSelecionadaId) return;
    setErro('');
    setMensagem('');
    try {
      await api.post(`/tarefas/${tarefaSelecionadaId}/atividades`, {
        titulo: novaAtividade.titulo.trim(),
        descricao: novaAtividade.descricao || undefined,
        ordem: novaAtividade.ordem ? Number(novaAtividade.ordem) : 0,
      });
      setNovaAtividade({ titulo: '', descricao: '', ordem: '' });
      setMensagem('Atividade cadastrada na subdemanda.');
      await carregarAtividades(tarefaSelecionadaId);
    } catch (err: any) {
      setErro(err?.response?.data?.detail || 'Falha ao cadastrar atividade.');
    }
  };

  const atualizarStatusAtividade = async (atividadeId: number, statusAtividade: AtividadeSubdemandaStatus) => {
    if (!podeEditarTarefa) return;
    setErro('');
    setMensagem('');
    try {
      await api.patch(`/atividades/${atividadeId}/status`, { status: statusAtividade });
      setMensagem('Status da atividade atualizado.');
      if (tarefaSelecionadaId) {
        await carregarAtividades(tarefaSelecionadaId);
      }
    } catch (err: any) {
      setErro(err?.response?.data?.detail || 'Falha ao atualizar atividade.');
    }
  };

  const alternarCheckAtividade = async (atividade: AtividadeSubdemanda, checked: boolean) => {
    const novoStatus: AtividadeSubdemandaStatus = checked ? 'concluida' : 'pendente';
    await atualizarStatusAtividade(atividade.id, novoStatus);
  };

  const removerAtividade = async (atividadeId: number) => {
    if (!podeCriarAtividades || !tarefaSelecionadaId) return;
    setErro('');
    setMensagem('');
    try {
      await api.delete(`/atividades/${atividadeId}`);
      setMensagem('Atividade removida.');
      await carregarAtividades(tarefaSelecionadaId);
    } catch (err: any) {
      setErro(err?.response?.data?.detail || 'Falha ao remover atividade.');
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
        <div className="demandas-tabs">
          <button
            type="button"
            className={abaAtiva === 'demandas' ? 'demandas-tab active' : 'demandas-tab'}
            onClick={() => setAbaAtiva('demandas')}
          >
            Demandas
          </button>
          <button
            type="button"
            className={abaAtiva === 'subdemandas' ? 'demandas-tab active' : 'demandas-tab'}
            onClick={() => setAbaAtiva('subdemandas')}
            disabled={!projetos.length}
          >
            Subdemandas
          </button>
        </div>
        <div className="muted-text" style={{ marginTop: 10 }}>
          {demandaSelecionada
            ? `Demanda ativa: ${demandaSelecionada.codigo} - ${demandaSelecionada.nome}`
            : 'Selecione uma demanda para abrir as subdemandas.'}
        </div>
        {erro && <div className="error">{erro}</div>}
        {mensagem && <div className="success">{mensagem}</div>}
      </div>

      {abaAtiva === 'demandas' && (
        <>
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

        <Table
          rows={projetos}
          emptyText="Nenhuma demanda encontrada."
          columns={[
            {
              title: 'Abrir',
              render: (projeto) => (
                <button type="button" className="btn-secondary" onClick={() => abrirSubdemandasDaDemanda(projeto.id)}>
                  Abrir Subdemandas
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

        </>
      )}

      {abaAtiva === 'subdemandas' && (
        <>
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

        <label className="form-row compact" style={{ marginTop: 10 }}>
          <span>Selecionar Demanda</span>
          <select
            value={projetoSelecionadoId ?? ''}
            onChange={(e) => setProjetoSelecionadoId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Selecione</option>
            {projetos.map((projeto) => (
              <option key={projeto.id} value={projeto.id}>
                {projeto.codigo} - {projeto.nome}
              </option>
            ))}
          </select>
        </label>

        {!!projetos.length && (
          <div className="demanda-selector-grid">
            {projetos.map((projeto) => (
              <button
                key={projeto.id}
                type="button"
                className={projetoSelecionadoId === projeto.id ? 'demanda-selector-btn active' : 'demanda-selector-btn'}
                onClick={() => setProjetoSelecionadoId(projeto.id)}
              >
                <strong>{projeto.codigo}</strong>
                <span>{projeto.nome}</span>
                <small>{contagemSubdemandas[projeto.id] ?? 0} subdemandas</small>
              </button>
            ))}
          </div>
        )}

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
              {
                title: 'Check',
                render: (tarefa) => (
                  <label className="subdemanda-check">
                    <input
                      type="checkbox"
                      checked={tarefa.status === 'concluida'}
                      onChange={(e) => void alternarCheckSubdemanda(tarefa, e.target.checked)}
                      disabled={!podeEditarTarefa}
                    />
                    <span>{tarefa.status === 'concluida' ? 'Feito' : 'Pendente'}</span>
                  </label>
                ),
              },
              {
                title: 'Atividades',
                render: (tarefa) => (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setTarefaSelecionadaId(tarefa.id)}
                  >
                    {tarefaSelecionadaId === tarefa.id ? 'Selecionada' : 'Abrir'}
                  </button>
                ),
              },
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

      <div className="card">
        <div className="between">
          <h3>Atividades da Subdemanda</h3>
          <label className="form-row compact">
            <span>Status</span>
            <select value={filtroStatusAtividade} onChange={(e) => setFiltroStatusAtividade(e.target.value)}>
              <option value="">Todos</option>
              {STATUS_ATIVIDADE_LIST.map((statusAtividade) => (
                <option key={statusAtividade} value={statusAtividade}>
                  {ATIVIDADE_SUBDEMANDA_STATUS_LABELS[statusAtividade]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!!tarefas.length && (
          <div className="subdemanda-tabs" style={{ marginTop: 10 }}>
            {tarefas.map((tarefa) => (
              <button
                key={tarefa.id}
                type="button"
                className={tarefaSelecionadaId === tarefa.id ? 'subdemanda-tab active' : 'subdemanda-tab'}
                onClick={() => setTarefaSelecionadaId(tarefa.id)}
              >
                {tarefa.titulo}
              </button>
            ))}
          </div>
        )}

        <div className="muted-text" style={{ marginTop: 8 }}>
          Subdemanda ativa: <strong>{subdemandaSelecionada ? subdemandaSelecionada.titulo : 'nenhuma'}</strong>
        </div>

        {!tarefaSelecionadaId && (
          <div className="muted-text">Selecione uma subdemanda para cadastrar e acompanhar atividades.</div>
        )}

        {tarefaSelecionadaId && (
          <>
            {atividades.length === 0 ? (
              <div className="muted-text" style={{ marginTop: 10 }}>
                Sem atividades para os filtros atuais.
              </div>
            ) : (
              <ul className="atividade-checklist">
                {atividades.map((atividade) => (
                  <li
                    key={atividade.id}
                    className={atividade.status === 'concluida' ? 'atividade-item done' : 'atividade-item'}
                  >
                    <label className="subdemanda-check atividade-main">
                      <input
                        type="checkbox"
                        checked={atividade.status === 'concluida'}
                        onChange={(e) => void alternarCheckAtividade(atividade, e.target.checked)}
                        disabled={!podeEditarTarefa}
                      />
                      <span className="atividade-title">{atividade.titulo}</span>
                    </label>
                    <div className="atividade-meta">
                      <small>
                        {ATIVIDADE_SUBDEMANDA_STATUS_LABELS[atividade.status]} | Ordem {atividade.ordem}
                      </small>
                      {atividade.descricao && <p>{atividade.descricao}</p>}
                    </div>
                    {podeCriarAtividades && (
                      <button type="button" className="btn-danger" onClick={() => removerAtividade(atividade.id)}>
                        Remover
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tarefaSelecionadaId && podeCriarAtividades && (
          <form className="grid gap-12" style={{ marginTop: 12 }} onSubmit={criarAtividade}>
            <div className="grid three-col gap-12">
              <label className="form-row">
                <span>Titulo da Atividade</span>
                <input
                  value={novaAtividade.titulo}
                  onChange={(e) => setNovaAtividade((prev) => ({ ...prev, titulo: e.target.value }))}
                  required
                />
              </label>
              <label className="form-row">
                <span>Ordem</span>
                <input
                  type="number"
                  min={0}
                  value={novaAtividade.ordem}
                  onChange={(e) => setNovaAtividade((prev) => ({ ...prev, ordem: e.target.value }))}
                />
              </label>
              <label className="form-row">
                <span>Descricao</span>
                <input
                  value={novaAtividade.descricao}
                  onChange={(e) => setNovaAtividade((prev) => ({ ...prev, descricao: e.target.value }))}
                />
              </label>
            </div>
            <button type="submit">Cadastrar Atividade</button>
          </form>
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
        </>
      )}
    </div>
  );
}

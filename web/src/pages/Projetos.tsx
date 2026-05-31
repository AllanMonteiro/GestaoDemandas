import { FormEvent, useEffect, useMemo, useState } from 'react';

import {
  ATIVIDADE_SUBDEMANDA_STATUS_LABELS,
  AtividadeSetorConfig,
  AtividadeSubdemanda,
  AtividadeSubdemandaStatus,
  api,
  getApiErrorMessage,
  Prioridade,
  PRIORIDADE_LABELS,
  Projeto,
  ProjetoStatus,
  PROJETO_STATUS_LABELS,
  TarefaProjeto,
  TarefaProjetoStatus,
  TAREFA_PROJETO_STATUS_LABELS,
  Usuario,
  DemandaHistorico,
  DemandaHistoricoTipo,
} from '../api';
import ProjetoGantt from '../components/ProjetoGantt';
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
  const [abaAtiva, setAbaAtiva] = useState<'demandas' | 'subdemandas' | 'gantt'>('demandas');
  const [tarefas, setTarefas] = useState<TarefaProjeto[]>([]);
  const [tarefaSelecionadaId, setTarefaSelecionadaId] = useState<number | null>(null);
  const [atividades, setAtividades] = useState<AtividadeSubdemanda[]>([]);
  const [atividadesPorSubdemanda, setAtividadesPorSubdemanda] = useState<Record<number, AtividadeSubdemanda[]>>({});
  const [setoresAtividade, setSetoresAtividade] = useState<AtividadeSetorConfig[]>([]);
  const [historico, setHistorico] = useState<DemandaHistorico[]>([]);
  const [novoComentario, setNovoComentario] = useState('');
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
    status: 'nova' as TarefaProjetoStatus,
    responsavel_id: '',
    solicitante_id: '',
    setor: '',
    start_date: '',
    due_date: '',
    estimativa_horas: '',
  });

  const [novaAtividade, setNovaAtividade] = useState({
    titulo: '',
    descricao: '',
    setor: '',
    subatividade: '',
    ordem: '',
  });

  const [subatividadesSelecionadas, setSubatividadesSelecionadas] = useState<string[]>([]);
  const [subdemandaComFormAberto, setSubdemandaComFormAberto] = useState<number | null>(null);

  const usuariosMap = useMemo(() => new Map(usuarios.map((u) => [u.id, u.nome])), [usuarios]);
  const demandaSelecionada = useMemo(
    () => projetos.find((projeto) => projeto.id === projetoSelecionadoId) || null,
    [projetos, projetoSelecionadoId]
  );
  const subdemandaSelecionada = useMemo(
    () => tarefas.find((tarefa) => tarefa.id === tarefaSelecionadaId) || null,
    [tarefas, tarefaSelecionadaId]
  );
  const subatividadesDisponiveis = useMemo(() => {
    const setorSelecionado = setoresAtividade.find((setor) => setor.nome === novaAtividade.setor);
    if (!setorSelecionado) return [];
    return setorSelecionado.subatividades
      .filter((subatividade) => subatividade.ativo)
      .slice()
      .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
  }, [novaAtividade.setor, setoresAtividade]);
  const atividadesAgrupadas = useMemo(() => {
    const agrupado = new Map<
      string,
      {
        setor: string;
        subgrupos: Map<string, AtividadeSubdemanda[]>;
      }
    >();

    atividades
      .slice()
      .sort((a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo))
      .forEach((atividade) => {
        const setor = atividade.setor || 'Sem setor';
        const subatividade = atividade.subatividade || 'Sem subatividade';
        if (!agrupado.has(setor)) {
          agrupado.set(setor, { setor, subgrupos: new Map() });
        }
        const grupoSetor = agrupado.get(setor);
        if (!grupoSetor) return;
        if (!grupoSetor.subgrupos.has(subatividade)) {
          grupoSetor.subgrupos.set(subatividade, []);
        }
        grupoSetor.subgrupos.get(subatividade)?.push(atividade);
      });

    return Array.from(agrupado.values()).map((grupo) => ({
      setor: grupo.setor,
      subgrupos: Array.from(grupo.subgrupos.entries()).map(([subatividade, itens]) => ({
        subatividade,
        itens,
      })),
    }));
  }, [atividades]);

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
      const [meResp, usuariosResp, setoresResp] = await Promise.all([
        api.get<Usuario>('/auth/me'),
        api.get<Usuario[]>('/usuarios').catch(() => ({ data: [] as Usuario[] })),
        api.get<AtividadeSetorConfig[]>('/configuracoes/atividades-setores', {
          params: { ativos_apenas: true },
        }),
      ]);
      setUsuarioAtual(meResp.data);
      setUsuarios(usuariosResp.data);
      setSetoresAtividade(setoresResp.data);
    } catch (err: unknown) {
      setErro(getApiErrorMessage(err, 'Nao foi possivel carregar contexto do usuario.'));
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

      // Carregar as atividades de todas as tarefas em paralelo
      const atividadesCarregadas = await Promise.all(
        data.map(async (tarefa) => {
          try {
            const resp = await api.get<AtividadeSubdemanda[]>(`/tarefas/${tarefa.id}/atividades`);
            return [tarefa.id, resp.data] as const;
          } catch {
            return [tarefa.id, [] as AtividadeSubdemanda[]] as const;
          }
        })
      );
      setAtividadesPorSubdemanda(Object.fromEntries(atividadesCarregadas));
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
      setAtividadesPorSubdemanda((prev) => ({
        ...prev,
        [tarefaId]: data,
      }));
    } catch (err: any) {
      setErro(err?.response?.data?.detail || 'Falha ao carregar atividades.');
    }
  };

  const carregarHistorico = async (tarefaId: number) => {
    try {
      const { data } = await api.get<DemandaHistorico[]>(`/tarefas/${tarefaId}/historico`);
      setHistorico(data);
    } catch (err: any) {
      console.error('Falha ao carregar historico:', err);
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
      setTarefaSelecionadaId(null);
      setTarefas([]);
      setAtividades([]);
      return;
    }
    if (projetoSelecionadoId && !projetos.some((projeto) => projeto.id === projetoSelecionadoId)) {
      setProjetoSelecionadoId(null);
      setTarefaSelecionadaId(null);
      setTarefas([]);
      setAtividades([]);
    }
  }, [projetos, projetoSelecionadoId]);

  useEffect(() => {
    if (!projetoSelecionadoId) {
      setTarefas([]);
      setTarefaSelecionadaId(null);
      setAtividades([]);
      setHistorico([]);
      return;
    }
    setTarefaSelecionadaId(null);
    setTarefas([]);
    setAtividades([]);
    setHistorico([]);
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
      setHistorico([]);
      return;
    }
    void carregarAtividades(tarefaSelecionadaId);
    void carregarHistorico(tarefaSelecionadaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefaSelecionadaId, filtroStatusAtividade]);

  const abrirSubdemandasDaDemanda = (projetoId: number) => {
    setProjetoSelecionadoId(projetoId);
    setAbaAtiva('subdemandas');
  };

  const abrirGanttDaDemanda = (projetoId: number) => {
    setProjetoSelecionadoId(projetoId);
    setAbaAtiva('gantt');
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
        solicitante_id: novaTarefa.solicitante_id ? Number(novaTarefa.solicitante_id) : undefined,
        setor: novaTarefa.setor || undefined,
        start_date: novaTarefa.start_date || undefined,
        due_date: novaTarefa.due_date || undefined,
        estimativa_horas: novaTarefa.estimativa_horas ? Number(novaTarefa.estimativa_horas) : undefined,
      });
      setNovaTarefa({
        titulo: '',
        descricao: '',
        prioridade: 'media',
        status: 'nova',
        responsavel_id: '',
        solicitante_id: '',
        setor: '',
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
      if (tarefaId === tarefaSelecionadaId) {
        await carregarHistorico(tarefaId);
      }
    } catch (err: any) {
      setErro(err?.response?.data?.detail || 'Falha ao atualizar subdemanda.');
    }
  };

  const alternarCheckSubdemanda = async (tarefa: TarefaProjeto, checked: boolean) => {
    const novoStatus: TarefaProjetoStatus = checked ? 'concluida' : 'a_fazer';
    await atualizarStatusTarefa(tarefa.id, novoStatus);
  };

  const criarAtividade = async (e: FormEvent, tarefaId: number) => {
    e.preventDefault();
    if (!podeCriarAtividades) return;

    const temSelecionadas = subatividadesSelecionadas.length > 0;
    const temCustomizada = novaAtividade.titulo.trim() !== '';

    if (!temSelecionadas && !temCustomizada) {
      setErro('Selecione pelo menos uma subatividade do catálogo ou digite uma atividade customizada.');
      return;
    }

    setErro('');
    setMensagem('');
    try {
      const promessas = [];

      // 1. Cadastrar subatividades selecionadas via checkbox
      for (const nomeSub of subatividadesSelecionadas) {
        const subConfig = subatividadesDisponiveis.find((s) => s.nome === nomeSub);
        const ordem = subConfig ? subConfig.ordem : 0;

        promessas.push(
          api.post(`/tarefas/${tarefaId}/atividades`, {
            titulo: nomeSub,
            descricao: novaAtividade.descricao || undefined,
            setor: novaAtividade.setor || undefined,
            subatividade: nomeSub,
            ordem: ordem,
          })
        );
      }

      // 2. Cadastrar atividade customizada
      if (temCustomizada) {
        promessas.push(
          api.post(`/tarefas/${tarefaId}/atividades`, {
            titulo: novaAtividade.titulo.trim(),
            descricao: novaAtividade.descricao || undefined,
            setor: novaAtividade.setor || undefined,
            subatividade: undefined,
            ordem: novaAtividade.ordem ? Number(novaAtividade.ordem) : 0,
          })
        );
      }

      await Promise.all(promessas);

      setNovaAtividade({ titulo: '', descricao: '', setor: '', subatividade: '', ordem: '' });
      setSubatividadesSelecionadas([]);
      setSubdemandaComFormAberto(null);
      setMensagem(`${promessas.length} atividade(s) cadastrada(s) na subdemanda.`);
      await carregarAtividades(tarefaId);
    } catch (err: unknown) {
      setErro(getApiErrorMessage(err, 'Falha ao cadastrar atividade(s).'));
    }
  };

  const atualizarStatusAtividade = async (atividadeId: number, statusAtividade: AtividadeSubdemandaStatus, tarefaId: number) => {
    if (!podeEditarTarefa) return;
    setErro('');
    setMensagem('');
    try {
      await api.patch(`/atividades/${atividadeId}/status`, { status: statusAtividade });
      setMensagem('Status da atividade atualizado.');
      await carregarAtividades(tarefaId);
    } catch (err: any) {
      setErro(err?.response?.data?.detail || 'Falha ao atualizar atividade.');
    }
  };

  const alternarCheckAtividade = async (atividade: AtividadeSubdemanda, checked: boolean) => {
    const novoStatus: AtividadeSubdemandaStatus = checked ? 'concluida' : 'pendente';
    await atualizarStatusAtividade(atividade.id, novoStatus, atividade.tarefa_id);
  };

  const removerAtividade = async (atividadeId: number, tarefaId: number) => {
    if (!podeCriarAtividades) return;
    setErro('');
    setMensagem('');
    try {
      await api.delete(`/atividades/${atividadeId}`);
      setMensagem('Atividade removida.');
      await carregarAtividades(tarefaId);
    } catch (err: any) {
      setErro(err?.response?.data?.detail || 'Falha ao remover atividade.');
    }
  };

  const adicionarComentario = async (e: FormEvent) => {
    e.preventDefault();
    if (!tarefaSelecionadaId || !novoComentario.trim()) return;
    try {
      await api.post(`/tarefas/${tarefaSelecionadaId}/historico`, {
        tipo: 'comentario',
        conteudo: novoComentario.trim(),
      });
      setNovoComentario('');
      await carregarHistorico(tarefaSelecionadaId);
    } catch (err: any) {
      setErro('Falha ao adicionar comentario.');
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
          <button
            type="button"
            className={abaAtiva === 'gantt' ? 'demandas-tab active' : 'demandas-tab'}
            onClick={() => setAbaAtiva('gantt')}
            disabled={!projetos.length}
          >
            Gantt
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
          onRowClick={(projeto) => abrirSubdemandasDaDemanda(projeto.id)}
          columns={[
            {
              title: 'Abrir',
              render: (projeto) => (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn-secondary" onClick={() => abrirSubdemandasDaDemanda(projeto.id)}>
                    Subdemandas
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => abrirGanttDaDemanda(projeto.id)}>
                    Gantt
                  </button>
                </div>
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
          <h3>Novo Projeto</h3>
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

      {abaAtiva === 'gantt' && (
        <ProjetoGantt projeto={demandaSelecionada} tarefas={tarefas} usuariosMap={usuariosMap} />
      )}

      {abaAtiva === 'subdemandas' && (
        <>
          <div className="demanda-layout-grid">
          <div className="demanda-sidebar">
      <div className="card">
        <div className="between">
          <h3>Demandas</h3>
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
          <div className="subdemandas-accordion-list" style={{ marginTop: '16px', display: 'grid', gap: '16px' }}>
            {tarefas.length === 0 ? (
              <div className="muted-text" style={{ padding: '24px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                Sem subdemandas para os filtros atuais.
              </div>
            ) : (
              tarefas.map((tarefa) => {
                const atividadesDaTarefa = atividadesPorSubdemanda[tarefa.id] || [];
                const isSelecionada = tarefaSelecionadaId === tarefa.id;
                
                return (
                  <div
                    key={tarefa.id}
                    className={`card subdemanda-accordion-card ${isSelecionada ? 'selected' : ''}`}
                    style={{
                      borderLeft: isSelecionada ? '5px solid #0f70b7' : '5px solid #bfd4e7',
                      padding: '16px',
                      boxShadow: '0 4px 12px rgba(17, 49, 73, 0.04)',
                      transition: 'all 0.2s ease',
                      borderRadius: '12px',
                      background: '#ffffff',
                      display: 'grid',
                      gap: '12px'
                    }}
                  >
                    {/* Subdemanda Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <label className="subdemanda-check" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={tarefa.status === 'concluida'}
                            onChange={(e) => void alternarCheckSubdemanda(tarefa, e.target.checked)}
                            disabled={!podeEditarTarefa}
                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                          />
                          <strong style={{ fontSize: '15px', color: '#1a4568', textDecoration: tarefa.status === 'concluida' ? 'line-through' : 'none' }}>
                            {tarefa.titulo}
                          </strong>
                        </label>
                        
                        <span className="badge" style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: tarefa.status === 'concluida' ? '#def7ec' : '#e1effe', color: tarefa.status === 'concluida' ? '#03543f' : '#1e429f', fontWeight: 600 }}>
                          {TAREFA_PROJETO_STATUS_LABELS[tarefa.status]}
                        </span>
                        <span className="badge" style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>
                          {PRIORIDADE_LABELS[tarefa.prioridade]}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', fontSize: '12.5px', color: '#4a5568' }}>
                        <span><strong>Resp:</strong> {tarefa.responsavel_id ? usuariosMap.get(tarefa.responsavel_id) : 'Sem responsável'}</span>
                        {tarefa.due_date && <span><strong>Prazo:</strong> {tarefa.due_date}</span>}
                        <span><strong>Horas:</strong> {tarefa.horas_registradas}h</span>
                        
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '12px', height: '28px', minWidth: '80px', fontWeight: 600 }}
                            onClick={() => setTarefaSelecionadaId(tarefa.id)}
                          >
                            {isSelecionada ? 'Gerenciando' : 'Gerenciar'}
                          </button>
                          {podeCriarTarefas && (
                            <button
                              type="button"
                              className="btn-danger"
                              style={{ padding: '4px 8px', fontSize: '12px', height: '28px', fontWeight: 600 }}
                              onClick={() => removerTarefa(tarefa.id)}
                            >
                              Excluir
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {tarefa.descricao && (
                      <p style={{ margin: '0 0 0 26px', fontSize: '13px', color: '#4d6a86', background: '#f7fbff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e9f2fb' }}>
                        {tarefa.descricao}
                      </p>
                    )}

                    {/* Atividades da Subdemanda Nested Checklist */}
                    <div style={{ marginLeft: '26px', borderTop: '1px dashed #d5e4f1', paddingTop: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h4 style={{ fontSize: '13.5px', margin: 0, color: '#173a5a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          📋 Atividades ({atividadesDaTarefa.filter(a => a.status === 'concluida').length}/{atividadesDaTarefa.length})
                        </h4>
                      </div>

                      {atividadesDaTarefa.length === 0 ? (
                        <p style={{ fontSize: '12.5px', color: '#7a8c9e', fontStyle: 'italic', margin: '4px 0 0' }}>
                          Sem atividades cadastradas. Use o painel abaixo selecionando esta subdemanda para cadastrar atividades em lote.
                        </p>
                      ) : (
                        <div style={{ display: 'grid', gap: '6px' }}>
                          {atividadesDaTarefa.map((atividade) => (
                            <div
                              key={atividade.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                background: atividade.status === 'concluida' ? '#edf7ee' : '#f8fbff',
                                border: '1px solid',
                                borderColor: atividade.status === 'concluida' ? '#baddbf' : '#cfe0ef',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <input
                                  type="checkbox"
                                  checked={atividade.status === 'concluida'}
                                  onChange={(e) => void alternarCheckAtividade(atividade, e.target.checked)}
                                  disabled={!podeEditarTarefa}
                                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                />
                                <div style={{ display: 'grid' }}>
                                  <span style={{
                                    fontSize: '13px',
                                    fontWeight: 700,
                                    color: atividade.status === 'concluida' ? '#3e6f57' : '#1b466b',
                                    textDecoration: atividade.status === 'concluida' ? 'line-through' : 'none'
                                  }}>
                                    {atividade.titulo}
                                  </span>
                                  {atividade.descricao && (
                                    <small style={{ fontSize: '11px', color: '#56738f', marginTop: '2px' }}>{atividade.descricao}</small>
                                  )}
                                </div>
                              </div>
                              
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {atividade.setor && (
                                  <span style={{ fontSize: '10.5px', padding: '2px 6px', background: '#eef5fc', color: '#355673', borderRadius: '4px', fontWeight: 600 }}>
                                    {atividade.setor} {atividade.subatividade ? `· ${atividade.subatividade}` : ''}
                                  </span>
                                )}
                                {podeCriarAtividades && (
                                  <button
                                    type="button"
                                    className="btn-danger"
                                    style={{
                                      padding: '2px 6px',
                                      fontSize: '10.5px',
                                      height: '22px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      borderRadius: '4px',
                                      background: '#b83636',
                                      border: 'none',
                                      fontWeight: 600
                                    }}
                                    onClick={() => removerAtividade(atividade.id, tarefa.id)}
                                  >
                                    Remover
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Formulário inline para adicionar atividades */}
                    {podeCriarAtividades && (
                      <div style={{ marginLeft: '26px', marginTop: '10px', borderTop: '1px dashed #d5e4f1', paddingTop: '12px' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: '12px', padding: '4px 14px', borderRadius: '6px', fontWeight: 600 }}
                          onClick={() => {
                            if (subdemandaComFormAberto === tarefa.id) {
                              setSubdemandaComFormAberto(null);
                            } else {
                              setSubdemandaComFormAberto(tarefa.id);
                              setTarefaSelecionadaId(tarefa.id);
                              setNovaAtividade({ titulo: '', descricao: '', setor: '', subatividade: '', ordem: '' });
                              setSubatividadesSelecionadas([]);
                            }
                          }}
                        >
                          {subdemandaComFormAberto === tarefa.id ? '✕ Fechar' : '＋ Adicionar Atividade'}
                        </button>

                        {subdemandaComFormAberto === tarefa.id && (
                          <form
                            className="grid gap-12"
                            style={{ marginTop: 12, background: '#f8fbff', padding: '16px', borderRadius: '8px', border: '1px solid #d4e6f5' }}
                            onSubmit={(e) => void criarAtividade(e, tarefa.id)}
                          >
                            <div className="grid two-col gap-12">
                              {setoresAtividade.length ? (
                                <label className="form-row">
                                  <span>Setor</span>
                                  <select
                                    value={novaAtividade.setor}
                                    onChange={(e) => {
                                      setNovaAtividade((prev) => ({ ...prev, setor: e.target.value, subatividade: '' }));
                                      setSubatividadesSelecionadas([]);
                                    }}
                                  >
                                    <option value="">Selecione</option>
                                    {setoresAtividade.map((setor) => (
                                      <option key={setor.id} value={setor.nome}>{setor.nome}</option>
                                    ))}
                                  </select>
                                </label>
                              ) : (
                                <label className="form-row">
                                  <span>Setor</span>
                                  <input
                                    value={novaAtividade.setor}
                                    onChange={(e) => {
                                      setNovaAtividade((prev) => ({ ...prev, setor: e.target.value }));
                                      setSubatividadesSelecionadas([]);
                                    }}
                                    placeholder="Ex: Manejo Florestal"
                                  />
                                </label>
                              )}
                              {subatividadesDisponiveis.length === 0 && (
                                <label className="form-row">
                                  <span>Subatividade</span>
                                  <input
                                    value={novaAtividade.subatividade}
                                    onChange={(e) => setNovaAtividade((prev) => ({ ...prev, subatividade: e.target.value }))}
                                    placeholder="Ex: Certificacao"
                                  />
                                </label>
                              )}
                            </div>

                            {subatividadesDisponiveis.length > 0 && (
                              <div className="form-row" style={{ marginTop: 4 }}>
                                <span>Subatividades do Catálogo (marque para cadastrar em lote)</span>
                                <div style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                  gap: '10px',
                                  padding: '12px',
                                  background: '#f9fafb',
                                  borderRadius: '8px',
                                  border: '1px solid #e5e7eb',
                                  marginTop: '6px',
                                  maxHeight: '180px',
                                  overflowY: 'auto'
                                }}>
                                  {subatividadesDisponiveis.map((sub) => (
                                    <label key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>
                                      <input
                                        type="checkbox"
                                        checked={subatividadesSelecionadas.includes(sub.nome)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setSubatividadesSelecionadas((prev) => [...prev, sub.nome]);
                                          } else {
                                            setSubatividadesSelecionadas((prev) => prev.filter((name) => name !== sub.nome));
                                          }
                                        }}
                                      />
                                      <span>{sub.nome}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="grid two-col gap-12">
                              <label className="form-row">
                                <span>Título da Atividade {subatividadesSelecionadas.length > 0 ? 'Customizada (opcional)' : '*'}</span>
                                <input
                                  value={novaAtividade.titulo}
                                  onChange={(e) => setNovaAtividade((prev) => ({ ...prev, titulo: e.target.value }))}
                                  required={subatividadesSelecionadas.length === 0}
                                  placeholder={subatividadesSelecionadas.length > 0 ? 'Opcional: adicionar atividade extra...' : 'Digite o título da atividade...'}
                                />
                              </label>
                              <label className="form-row">
                                <span>Ordem</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={novaAtividade.ordem}
                                  onChange={(e) => setNovaAtividade((prev) => ({ ...prev, ordem: e.target.value }))}
                                  placeholder="0"
                                />
                              </label>
                            </div>

                            <label className="form-row">
                              <span>Descrição</span>
                              <input
                                value={novaAtividade.descricao}
                                onChange={(e) => setNovaAtividade((prev) => ({ ...prev, descricao: e.target.value }))}
                                placeholder="Descrição opcional..."
                              />
                            </label>

                            <button type="submit" style={{ fontSize: '13px', padding: '8px 16px' }}>
                              {subatividadesSelecionadas.length > 0
                                ? `Cadastrar ${subatividadesSelecionadas.length + (novaAtividade.titulo.trim() !== '' ? 1 : 0)} Atividade(s)`
                                : 'Cadastrar Atividade'}
                            </button>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
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
              <div className="atividade-group-list">
                {atividadesAgrupadas.map((grupo) => (
                  <section key={grupo.setor} className="atividade-sector-group">
                    <div className="atividade-sector-header">
                      <strong>{grupo.setor}</strong>
                      <span>
                        {grupo.subgrupos.reduce((total, subgrupo) => total + subgrupo.itens.length, 0)} atividades
                      </span>
                    </div>

                    <div className="grid gap-12">
                      {grupo.subgrupos.map((subgrupo) => (
                        <div key={`${grupo.setor}-${subgrupo.subatividade}`} className="atividade-subgroup-card">
                          <div className="atividade-subgroup-header">
                            <strong>{subgrupo.subatividade}</strong>
                            <small>{subgrupo.itens.length} item(ns)</small>
                          </div>
                          <ul className="atividade-checklist atividade-checklist-grouped">
                            {subgrupo.itens.map((atividade) => (
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
                                  <button
                                    type="button"
                                    className="btn-danger"
                                    onClick={() => removerAtividade(atividade.id, atividade.tarefa_id)}
                                  >
                                    Remover
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}

        <div className="timeline-section" style={{ marginTop: 24 }}>
          <h3>Timeline / Histórico</h3>
          <div className="timeline-container">
            <div className="comment-box">
              <form onSubmit={adicionarComentario}>
                <textarea
                  placeholder="Escreva um comentário ou atualização..."
                  value={novoComentario}
                  onChange={(e) => setNovoComentario(e.target.value)}
                  rows={2}
                  className="form-control"
                  style={{ width: '100%', marginBottom: 8, padding: 8 }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn-secondary" disabled={!novoComentario.trim()}>
                    Enviar Comentário
                  </button>
                </div>
              </form>
            </div>
            <div className="timeline-list" style={{ marginTop: 16 }}>
              {historico.length === 0 ? (
                <div className="muted-text">Nenhuma movimentação registrada.</div>
              ) : (
                historico.map((h) => (
                  <div key={h.id} className={`timeline-item type-${h.tipo}`} style={{ 
                    padding: '12px 0', 
                    borderBottom: '1px solid var(--border-color, #eee)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4
                  }}>
                    <div className="timeline-header" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <strong style={{ color: 'var(--primary-color)' }}>
                        {h.created_by ? (usuariosMap.get(h.created_by) || `Usuário ${h.created_by}`) : 'Sistema'}
                      </strong>
                      <small className="muted-text">{new Date(h.created_at).toLocaleString()}</small>
                    </div>
                    <div className="timeline-body" style={{ fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>{h.conteudo}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      </div>

      {projetoSelecionadoId && podeCriarTarefas && (
        <div className="card">
          <h3>Nova Subdemanda</h3>
          <p className="muted-text">
            Vinculo atual: <strong>{demandaSelecionada ? `${demandaSelecionada.codigo} - ${demandaSelecionada.nome}` : '-'}</strong>
          </p>
          <form className="grid gap-12" onSubmit={criarTarefa}>
            <label className="form-row">
              <span>Demanda pai</span>
              <input
                value={demandaSelecionada ? `${demandaSelecionada.codigo} - ${demandaSelecionada.nome}` : ''}
                readOnly
              />
            </label>

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
                <span>Solicitante</span>
                <select
                  value={novaTarefa.solicitante_id}
                  onChange={(e) => setNovaTarefa((prev) => ({ ...prev, solicitante_id: e.target.value }))}
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
                <span>Setor / Area</span>
                <input
                  value={novaTarefa.setor}
                  onChange={(e) => setNovaTarefa((prev) => ({ ...prev, setor: e.target.value }))}
                  placeholder="Ex: TI, RH, Comercial"
                />
              </label>
            </div>

            <div className="grid two-col gap-12">
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

            <button type="submit">Criar Demanda</button>
          </form>
        </div>
      )}
        </div>
        </>
      )}
    </div>
  );
}

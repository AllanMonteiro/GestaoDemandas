import { useEffect, useMemo, useState } from 'react';

import {
  api,
  PROJETO_STATUS_LABELS,
  Projeto,
  ProjetosDashboardResumo,
  TAREFA_PROJETO_STATUS_LABELS,
  TarefaProjetoStatus,
} from '../api';
import Table from '../components/Table';

const ORDEM_TAREFAS: TarefaProjetoStatus[] = [
  'backlog',
  'a_fazer',
  'em_andamento',
  'em_revisao',
  'bloqueada',
  'concluida',
];

export default function ProjetosDashboard() {
  const [resumo, setResumo] = useState<ProjetosDashboardResumo | null>(null);
  const [projetosAtrasados, setProjetosAtrasados] = useState<Projeto[]>([]);
  const [erro, setErro] = useState('');

  const carregar = async () => {
    setErro('');
    try {
      const [resumoResp, projetosResp] = await Promise.all([
        api.get<ProjetosDashboardResumo>('/projetos-dashboard/resumo'),
        api.get<Projeto[]>('/projetos', { params: { atrasados: true } }),
      ]);
      setResumo(resumoResp.data);
      setProjetosAtrasados(projetosResp.data);
    } catch (err: any) {
      setErro(err?.response?.data?.detail || 'Falha ao carregar dashboard de projetos.');
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const tarefasMap = useMemo(() => {
    const map = new Map<TarefaProjetoStatus, number>();
    if (!resumo) return map;
    resumo.tarefas_por_status.forEach((item) => map.set(item.status, item.quantidade));
    return map;
  }, [resumo]);

  return (
    <div className="grid gap-16">
      <div className="between">
        <h2>Dashboard de Projetos</h2>
        <button type="button" className="btn-secondary" onClick={() => void carregar()}>
          Atualizar
        </button>
      </div>

      {erro && <div className="error">{erro}</div>}

      {!resumo && !erro && <div className="card">Carregando indicadores...</div>}

      {resumo && (
        <>
          <div className="cards-status">
            <div className="card status-card status-risco-atencao">
              <h3>Total de Projetos</h3>
              <strong>{resumo.total_projetos}</strong>
            </div>
            <div className="card status-card status-risco-alto">
              <h3>Projetos Atrasados</h3>
              <strong>{resumo.projetos_atrasados}</strong>
            </div>
            <div className="card status-card status-risco-medio">
              <h3>Tarefas Atrasadas</h3>
              <strong>{resumo.tarefas_atrasadas}</strong>
            </div>
          </div>

          <div className="card">
            <h3>Status dos Projetos</h3>
            <Table
              rows={resumo.projetos_por_status}
              emptyText="Sem dados de projeto."
              columns={[
                { title: 'Status', render: (item) => PROJETO_STATUS_LABELS[item.status] },
                { title: 'Quantidade', render: (item) => item.quantidade },
              ]}
            />
          </div>

          <div className="card">
            <h3>Pipeline de Tarefas</h3>
            <Table
              rows={ORDEM_TAREFAS.map((status) => ({
                status,
                quantidade: tarefasMap.get(status) || 0,
              }))}
              emptyText="Sem tarefas."
              columns={[
                { title: 'Status', render: (item) => TAREFA_PROJETO_STATUS_LABELS[item.status] },
                { title: 'Quantidade', render: (item) => item.quantidade },
              ]}
            />
          </div>
        </>
      )}

      <div className="card">
        <h3>Projetos no Prazo Critico</h3>
        <Table
          rows={projetosAtrasados}
          emptyText="Nenhum projeto atrasado."
          columns={[
            { title: 'Codigo', render: (projeto) => projeto.codigo },
            { title: 'Nome', render: (projeto) => projeto.nome },
            { title: 'Status', render: (projeto) => PROJETO_STATUS_LABELS[projeto.status] },
            { title: 'Prioridade', render: (projeto) => projeto.prioridade },
            { title: 'Prazo', render: (projeto) => projeto.data_fim_prevista || '-' },
            { title: 'Progresso', render: (projeto) => `${projeto.progresso}%` },
          ]}
        />
      </div>
    </div>
  );
}

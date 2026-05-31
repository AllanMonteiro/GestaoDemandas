import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8002/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  },
);

type ApiValidationDetailItem = {
  loc?: Array<string | number>;
  msg?: string;
};

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) {
    return fallback;
  }

  const detail = error.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item: ApiValidationDetailItem) => {
        if (!item || typeof item !== 'object') return null;
        const field = item.loc?.length ? String(item.loc[item.loc.length - 1]).replace(/_/g, ' ') : '';
        const message = typeof item.msg === 'string' ? item.msg : '';
        if (!field && !message) return null;
        return field ? `${field}: ${message}` : message;
      })
      .filter((message): message is string => Boolean(message));

    if (messages.length) {
      return messages.join(' | ');
    }
  }

  return fallback;
}

export type Role = 'ADMIN' | 'GESTOR' | 'AUDITOR' | 'RESPONSAVEL' | 'SOLICITANTE';

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  role: Role;
  created_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  usuario: Usuario;
}

export interface ProgramaCertificacao {
  id: number;
  codigo: string;
  nome: string;
  descricao?: string | null;
  created_at: string;
}

export interface ConfiguracaoSistema {
  id: number;
  nome_empresa: string;
  logo_url?: string | null;
  logo_preview_url?: string | null;
  updated_by?: number | null;
  created_at: string;
  updated_at: string;
}

export interface AtividadeSubatividadeConfig {
  id: number;
  setor_id: number;
  nome: string;
  ativo: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export interface AtividadeSetorConfig {
  id: number;
  nome: string;
  ativo: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
  subatividades: AtividadeSubatividadeConfig[];
}

export interface Auditoria {
  id: number;
  programa_id: number;
  year: number;
  tipo?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  organismo_certificador?: string | null;
  padrao_utilizado?: string | null;
  escopo?: string | null;
  created_at: string;
}

export interface Principio {
  id: number;
  programa_id: number;
  codigo?: string | null;
  titulo: string;
  descricao?: string | null;
  created_at: string;
}

export interface Criterio {
  id: number;
  programa_id: number;
  principio_id: number;
  codigo?: string | null;
  titulo: string;
  descricao?: string | null;
}

export interface Indicador {
  id: number;
  programa_id: number;
  criterio_id: number;
  codigo?: string | null;
  titulo: string;
  descricao?: string | null;
}

export type StatusConformidade =
  | 'conforme'
  | 'nc_menor'
  | 'nc_maior'
  | 'oportunidade_melhoria'
  | 'nao_se_aplica';

export const STATUS_CONFORMIDADE_LABELS: Record<StatusConformidade, string> = {
  conforme: 'Conforme',
  nc_menor: 'Não Conformidade Menor',
  nc_maior: 'Não Conformidade Maior',
  oportunidade_melhoria: 'Oportunidade de Melhoria',
  nao_se_aplica: 'Não se Aplica',
};

export interface Avaliacao {
  id: number;
  programa_id: number;
  indicator_id: number;
  auditoria_ano_id: number;
  status_conformidade: StatusConformidade;
  observacoes?: string | null;
  assessed_at: string;
  updated_at: string;
}

export type KindEvidencia = 'arquivo' | 'link' | 'texto';

export interface TipoEvidencia {
  id: number;
  programa_id?: number | null;
  criterio_id?: number | null;
  indicador_id?: number | null;
  nome: string;
  descricao?: string | null;
  status_conformidade: StatusConformidade;
}

export interface Evidencia {
  id: number;
  programa_id: number;
  avaliacao_id: number;
  tipo_evidencia_id?: number | null;
  kind: KindEvidencia;
  url_or_path: string;
  observacoes?: string | null;
  created_by: number;
  created_at: string;
}

export type StatusDocumento = 'em_construcao' | 'em_revisao' | 'aprovado' | 'reprovado';

export const STATUS_DOCUMENTO_LABELS: Record<StatusDocumento, string> = {
  em_construcao: 'Em Construção',
  em_revisao: 'Em Revisão',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
};

export interface DocumentoEvidencia {
  id: number;
  programa_id: number;
  auditoria_ano_id: number;
  evidencia_id: number;
  titulo: string;
  conteudo?: string | null;
  versao: number;
  status_documento: StatusDocumento;
  observacoes_revisao?: string | null;
  data_limite?: string | null;
  responsavel_id?: number | null;
  revisado_por_id?: number | null;
  data_revisao?: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export type StatusMonitoramentoCriterio = 'sem_dados' | 'conforme' | 'alerta' | 'critico';

export const STATUS_MONITORAMENTO_CRITERIO_LABELS: Record<StatusMonitoramentoCriterio, string> = {
  sem_dados: 'Sem Dados',
  conforme: 'Conforme',
  alerta: 'Alerta',
  critico: 'Crítico',
};

export interface MonitoramentoCriterio {
  id: number;
  programa_id: number;
  auditoria_ano_id: number;
  criterio_id: number;
  mes_referencia: string;
  status_monitoramento: StatusMonitoramentoCriterio;
  observacoes?: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export type StatusNotificacaoMonitoramento = 'aberta' | 'em_tratamento' | 'resolvida' | 'cancelada';

export const STATUS_NOTIFICACAO_MONITORAMENTO_LABELS: Record<StatusNotificacaoMonitoramento, string> = {
  aberta: 'Aberta',
  em_tratamento: 'Em Tratamento',
  resolvida: 'Resolvida',
  cancelada: 'Cancelada',
};

export interface NotificacaoMonitoramento {
  id: number;
  programa_id: number;
  auditoria_ano_id: number;
  criterio_id: number;
  monitoramento_id: number;
  titulo: string;
  descricao?: string | null;
  severidade: Prioridade;
  status_notificacao: StatusNotificacaoMonitoramento;
  responsavel_id?: number | null;
  prazo?: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface ResolucaoNotificacao {
  id: number;
  programa_id: number;
  notificacao_id: number;
  descricao: string;
  resultado?: string | null;
  created_by: number;
  created_at: string;
}

export type StatusAnaliseNc = 'aberta' | 'em_analise' | 'concluida';

export const STATUS_ANALISE_NC_LABELS: Record<StatusAnaliseNc, string> = {
  aberta: 'Aberta',
  em_analise: 'Em Analise',
  concluida: 'Concluida',
};

export interface AnaliseNc {
  id: number;
  programa_id: number;
  auditoria_ano_id: number;
  avaliacao_id: number;
  demanda_id?: number | null;
  titulo_problema: string;
  contexto?: string | null;
  porque_1?: string | null;
  porque_2?: string | null;
  porque_3?: string | null;
  porque_4?: string | null;
  porque_5?: string | null;
  causa_raiz?: string | null;
  acao_corretiva?: string | null;
  swot_forcas?: string | null;
  swot_fraquezas?: string | null;
  swot_oportunidades?: string | null;
  swot_ameacas?: string | null;
  status_analise: StatusAnaliseNc;
  responsavel_id?: number | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export type StatusAndamento =
  | 'aberta'
  | 'em_andamento'
  | 'em_validacao'
  | 'concluida'
  | 'bloqueada';

export const STATUS_ANDAMENTO_LABELS: Record<StatusAndamento, string> = {
  aberta: 'Aberta',
  em_andamento: 'Em Andamento',
  em_validacao: 'Em Validação',
  concluida: 'Concluída',
  bloqueada: 'Bloqueada',
};
export type DemandaStatus =
  | 'nova'
  | 'em_triagem'
  | 'aguardando_informacoes'
  | 'aprovada'
  | 'em_execucao'
  | 'em_validacao'
  | 'concluida'
  | 'cancelada'
  | 'backlog'
  | 'a_fazer'
  | 'em_andamento'
  | 'em_revisao'
  | 'bloqueada'
  | 'triagem'
  | 'aguardando_info'
  | 'execucao'
  | 'validacao';

export const DEMANDA_STATUS_LABELS: Record<DemandaStatus, string> = {
  nova: 'Nova',
  em_triagem: 'Em Triagem',
  aguardando_informacoes: 'Aguardando Informações',
  aprovada: 'Aprovada',
  em_execucao: 'Em Execução',
  em_validacao: 'Em Validação',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  backlog: 'Backlog',
  a_fazer: 'A Fazer',
  em_andamento: 'Em Andamento',
  em_revisao: 'Em Revisão',
  bloqueada: 'Bloqueada',
  triagem: 'Triagem',
  aguardando_info: 'Aguardando Info',
  execucao: 'Execução',
  validacao: 'Validação',
};

export type Prioridade = 'baixa' | 'media' | 'alta' | 'critica';

export const PRIORIDADE_LABELS: Record<Prioridade, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
};

export const PRIORIDADE_COR: Record<Prioridade, string> = {
  baixa: '#6b7280',
  media: '#3b82f6',
  alta: '#f59e0b',
  critica: '#ef4444',
};

export interface Demanda {
  id: number;
  programa_id: number;
  avaliacao_id: number;
  titulo: string;
  padrao?: string | null;
  descricao?: string | null;
  responsavel_id?: number | null;
  start_date?: string | null;
  due_date?: string | null;
  status_andamento: StatusAndamento;
  prioridade: Prioridade;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: number;
  entidade: string;
  entidade_id: number;
  acao: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';
  old_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
  created_by?: number | null;
  programa_id?: number | null;
  auditoria_ano_id?: number | null;
  created_at: string;
}

export interface AvaliacaoDetalhe {
  avaliacao: Avaliacao;
  indicador: Indicador;
  criterio: Criterio;
  principio: Principio;
  evidencias: Evidencia[];
  demandas: Demanda[];
  logs: AuditLog[];
}

export interface ResumoStatusItem {
  status_conformidade: StatusConformidade;
  label: string;
  quantidade: number;
}

export interface AvaliacaoSemEvidenciaItem {
  avaliacao_id: number;
  indicator_id: number;
  indicador_titulo: string;
  status_conformidade: StatusConformidade;
}

export interface NcPorPrincipioItem {
  principio_id: number;
  principio_titulo: string;
  nc_menor: number;
  nc_maior: number;
  total_nc: number;
}

export interface ResumoConformidadeCertificacaoItem {
  programa_id: number;
  programa_nome: string;
  year: number;
  conformes: number;
  nao_conformes: number;
  oportunidades_melhoria: number;
  nao_se_aplica: number;
  total_avaliacoes: number;
}

export interface CronogramaGanttItem {
  demanda_id: number;
  avaliacao_id: number;
  auditoria_id: number;
  programa_id: number;
  indicador_titulo: string;
  titulo: string;
  responsavel_nome?: string | null;
  prioridade: Prioridade;
  status_andamento: StatusAndamento;
  status_conformidade: StatusConformidade;
  data_inicio: string;
  data_fim: string;
}

export interface MonitoramentoMensalItem {
  mes: number;
  mes_nome: string;
  principios_cadastrados: number;
  principios_monitorados: number;
  criterios_cadastrados: number;
  criterios_monitorados: number;
  avaliacoes_registradas: number;
  evidencias_registradas: number;
}

export type ProjetoStatus = 'planejamento' | 'em_andamento' | 'pausado' | 'concluido' | 'cancelado';

export const PROJETO_STATUS_LABELS: Record<ProjetoStatus, string> = {
  planejamento: 'Planejamento',
  em_andamento: 'Em Andamento',
  pausado: 'Pausado',
  concluido: 'Concluido',
  cancelado: 'Cancelado',
};

export type TarefaProjetoStatus = DemandaStatus;

export const TAREFA_PROJETO_STATUS_LABELS: Record<TarefaProjetoStatus, string> = DEMANDA_STATUS_LABELS;

export type AtividadeSubdemandaStatus = 'pendente' | 'concluida';

export const ATIVIDADE_SUBDEMANDA_STATUS_LABELS: Record<AtividadeSubdemandaStatus, string> = {
  pendente: 'Pendente',
  concluida: 'Concluida',
};

export interface Projeto {
  id: number;
  codigo: string;
  nome: string;
  descricao?: string | null;
  status: ProjetoStatus;
  prioridade: Prioridade;
  progresso: number;
  data_inicio?: string | null;
  data_fim_prevista?: string | null;
  data_fim_real?: string | null;
  gerente_id?: number | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface TarefaProjeto {
  id: number;
  projeto_id: number;
  titulo: string;
  descricao?: string | null;
  status: TarefaProjetoStatus;
  prioridade: Prioridade;
  responsavel_id?: number | null;
  solicitante_id?: number | null;
  setor?: string | null;
  motivo_cancelamento?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
  estimativa_horas?: number | null;
  horas_registradas: number;
  ordem: number;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export type DemandaHistoricoTipo = 'comentario' | 'status' | 'anexo' | 'sistema';

export interface DemandaHistorico {
  id: number;
  demanda_id: number;
  tipo: DemandaHistoricoTipo;
  conteudo: string;
  old_status?: string | null;
  new_status?: string | null;
  created_by?: number | null;
  created_at: string;
}

export interface AtividadeSubdemanda {
  id: number;
  tarefa_id: number;
  titulo: string;
  descricao?: string | null;
  setor?: string | null;
  subatividade?: string | null;
  status: AtividadeSubdemandaStatus;
  ordem: number;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface ResumoProjetosStatusItem {
  status: ProjetoStatus;
  label: string;
  quantidade: number;
}

export interface ResumoTarefasStatusItem {
  status: TarefaProjetoStatus;
  label: string;
  quantidade: number;
}

export interface ProjetosDashboardResumo {
  total_projetos: number;
  projetos_atrasados: number;
  tarefas_atrasadas: number;
  projetos_por_status: ResumoProjetosStatusItem[];
  tarefas_por_status: ResumoTarefasStatusItem[];
}

// ── Gestão de Demandas (standalone) ──────────────────────────────────────────

export type GestaoDemandasStatus = DemandaStatus;

export const GESTAO_STATUS_LABELS: Record<GestaoDemandasStatus, string> = DEMANDA_STATUS_LABELS;

export const GESTAO_STATUS_LIST: GestaoDemandasStatus[] = [
  'nova',
  'em_triagem',
  'aguardando_informacoes',
  'aprovada',
  'em_execucao',
  'em_validacao',
  'concluida',
  'cancelada',
];

export const GESTAO_STATUS_COR: Partial<Record<GestaoDemandasStatus, string>> = {
  nova: '#6b7280',
  em_triagem: '#3b82f6',
  aguardando_informacoes: '#f59e0b',
  aprovada: '#8b5cf6',
  em_execucao: '#0ea5e9',
  em_validacao: '#f97316',
  concluida: '#22c55e',
  cancelada: '#ef4444',
};

export interface GestaoDemanda {
  id: number;
  titulo: string;
  descricao?: string | null;
  solicitante_id?: number | null;
  responsavel_id?: number | null;
  setor?: string | null;
  prioridade: Prioridade;
  status: GestaoDemandasStatus;
  prazo?: string | null;
  data_abertura: string;
  data_conclusao?: string | null;
  motivo_cancelamento?: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface ProfissionalDemanda {
  id: number;
  codigo: string;
  titulo: string;
  descricao?: string | null;
  solicitante_id?: number | null;
  solicitante_nome?: string | null;
  responsavel_id?: number | null;
  responsavel_nome?: string | null;
  parent_demanda_id?: number | null;
  parent_titulo?: string | null;
  setor?: string | null;
  prioridade: Prioridade;
  status: DemandaStatus;
  prazo?: string | null;
  data_abertura: string;
  data_conclusao?: string | null;
  motivo_cancelamento?: string | null;
  criado_em: string;
  atualizado_em: string;
  subdemandas: ProfissionalDemandaListItem[];
}

export interface ProfissionalDemandaListItem {
  id: number;
  codigo: string;
  titulo: string;
  parent_demanda_id?: number | null;
  solicitante_nome?: string | null;
  responsavel_nome?: string | null;
  prioridade: Prioridade;
  status: DemandaStatus;
  prazo?: string | null;
  atraso?: number | null;
  total_subdemandas?: number;
}

export type DemandaListItem = ProfissionalDemandaListItem;

export interface DemandaComentario {
  id: number;
  demanda_id: number;
  usuario_id: number | null;
  usuario_nome?: string | null;
  comentario: string;
  criado_em: string;
}

export interface DemandaAnexo {
  id: number;
  demanda_id: number;
  usuario_id: number | null;
  usuario_nome?: string | null;
  nome_arquivo: string;
  content_type?: string | null;
  tamanho?: number | null;
  storage_key: string;
  criado_em: string;
  observacoes?: string | null;
  file_url?: string;
}

export type DemandaAnaliseMetodo =
  | '5_PORQUES'
  | '4W2H'
  | '5W2H'
  | 'ISHIKAWA'
  | 'GUT'
  | 'ESFORCO_IMPACTO'
  | 'PDCA';

export const DEMANDA_ANALISE_METODO_LABELS: Record<DemandaAnaliseMetodo, string> = {
  '5_PORQUES': '5 Porques',
  '4W2H': '4W2H',
  '5W2H': '5W2H',
  ISHIKAWA: 'Ishikawa',
  GUT: 'Matriz GUT',
  ESFORCO_IMPACTO: 'Esforco x Impacto',
  PDCA: 'PDCA',
};

export const DEMANDA_ANALISE_METODOS: DemandaAnaliseMetodo[] = [
  '5_PORQUES',
  '4W2H',
  '5W2H',
  'ISHIKAWA',
  'GUT',
  'ESFORCO_IMPACTO',
  'PDCA',
];

export type DemandaAnaliseStatus = 'rascunho' | 'em_analise' | 'plano_definido' | 'em_execucao' | 'concluido' | 'cancelado';

export const DEMANDA_ANALISE_STATUS_LABELS: Record<DemandaAnaliseStatus, string> = {
  rascunho: 'Rascunho',
  em_analise: 'Em Analise',
  plano_definido: 'Plano Definido',
  em_execucao: 'Em Execucao',
  concluido: 'Concluido',
  cancelado: 'Cancelado',
};

export const DEMANDA_ANALISE_STATUS_LIST: DemandaAnaliseStatus[] = [
  'rascunho',
  'em_analise',
  'plano_definido',
  'em_execucao',
  'concluido',
  'cancelado',
];

export interface DemandaAnaliseCampo {
  id: number;
  analise_id: number;
  chave: string;
  valor?: string | null;
  ordem: number;
}

export interface DemandaAnalise {
  id: number;
  demanda_id: number;
  metodo: DemandaAnaliseMetodo;
  problema?: string | null;
  causa_raiz?: string | null;
  status: DemandaAnaliseStatus;
  responsavel_id?: number | null;
  responsavel_nome?: string | null;
  criado_em: string;
  atualizado_em: string;
  campos: DemandaAnaliseCampo[];
  campos_map: Record<string, string | null>;
  pontuacao_total?: number | null;
  classificacao?: string | null;
}

export interface ItemContagem {
  label: string;
  valor: number;
}

export interface ItemContagemPct {
  label: string;
  valor: number;
  pct: number;
}

export interface GestaoDashboard {
  total_abertas: number;
  total_atrasadas: number;
  total_concluidas_mes: number;
  total_canceladas: number;
  tempo_medio_atendimento_dias: number | null;
  sla_no_prazo: number;
  sla_vencido: number;
  por_status: ItemContagemPct[];
  por_prioridade: ItemContagemPct[];
  por_setor: ItemContagem[];
  por_responsavel: ItemContagem[];
  total_por_status: ItemContagemPct[];
  total_por_prioridade: ItemContagemPct[];
  total_por_responsavel: ItemContagem[];
  tempo_medio_conclusao: number | null;
  sla_cumprido_percentual: number;
}

export type DemandaTipoEvento = 'criado' | 'comentario' | 'status_alterado' | 'campo_alterado';

export interface DemandaEvento {
  id: number;
  demanda_id: number;
  usuario_id: number | null;
  tipo_evento: DemandaTipoEvento | string;
  campo_alterado: string | null;
  valor_anterior: string | null;
  valor_novo: string | null;
  usuario_nome: string | null;
  criado_em: string;
}

export interface HomeData {
  resumo: GestaoDashboard;
  atrasadas: DemandaListItem[];
  minhas_demandas: DemandaListItem[];
  recentes: DemandaListItem[];
}

export const fetchHome = () => api.get<HomeData>('/gestao-demandas/dashboard/home').then((r) => r.data);

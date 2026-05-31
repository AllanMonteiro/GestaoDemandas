import { DEMANDA_ANALISE_STATUS_LABELS, DemandaAnaliseStatus } from '../api';

const STATUS_CLASS_MAP: Record<DemandaAnaliseStatus, string> = {
  rascunho: 'demand-analysis-status-rascunho',
  em_analise: 'demand-analysis-status-em-analise',
  plano_definido: 'demand-analysis-status-plano-definido',
  em_execucao: 'demand-analysis-status-em-execucao',
  concluido: 'demand-analysis-status-concluido',
  cancelado: 'demand-analysis-status-cancelado',
};

export default function DemandAnalysisStatusBadge({ status }: { status: DemandaAnaliseStatus }) {
  return (
    <span className={`demand-analysis-status-badge ${STATUS_CLASS_MAP[status]}`}>
      {DEMANDA_ANALISE_STATUS_LABELS[status]}
    </span>
  );
}

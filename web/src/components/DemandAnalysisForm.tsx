import { useEffect, useMemo, useState } from 'react';

import {
  DEMANDA_ANALISE_METODO_LABELS,
  DEMANDA_ANALISE_METODOS,
  DEMANDA_ANALISE_STATUS_LABELS,
  DEMANDA_ANALISE_STATUS_LIST,
  DemandaAnalise,
  DemandaAnaliseMetodo,
  DemandaAnaliseStatus,
  Usuario,
} from '../api';

type FieldKind = 'input' | 'textarea' | 'select';

type MethodFieldConfig = {
  key: string;
  label: string;
  kind?: FieldKind;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
};

export type DemandAnalysisSubmitPayload = {
  metodo: DemandaAnaliseMetodo;
  problema?: string;
  causa_raiz?: string;
  status: DemandaAnaliseStatus;
  responsavel_id?: number;
  campos: Array<{ chave: string; valor: string; ordem: number }>;
};

type Props = {
  initialAnalise?: DemandaAnalise | null;
  usuarios: Usuario[];
  currentUserRole?: Usuario['role'];
  defaultResponsavelId?: number | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (payload: DemandAnalysisSubmitPayload) => void;
};

const FIELD_CONFIG_BY_METHOD: Record<DemandaAnaliseMetodo, MethodFieldConfig[]> = {
  '5_PORQUES': [
    { key: 'porque_1', label: 'Por que 1?', kind: 'textarea' },
    { key: 'porque_2', label: 'Por que 2?', kind: 'textarea' },
    { key: 'porque_3', label: 'Por que 3?', kind: 'textarea' },
    { key: 'porque_4', label: 'Por que 4?', kind: 'textarea' },
    { key: 'porque_5', label: 'Por que 5?', kind: 'textarea' },
    { key: 'acao_recomendada', label: 'Acao recomendada', kind: 'textarea' },
  ],
  '4W2H': [
    { key: 'what', label: 'What / O que sera feito?', kind: 'textarea' },
    { key: 'why', label: 'Why / Por que sera feito?', kind: 'textarea' },
    { key: 'where', label: 'Where / Onde sera feito?' },
    { key: 'when', label: 'When / Quando sera feito?' },
    { key: 'who', label: 'Who / Quem sera responsavel?' },
    { key: 'how', label: 'How / Como sera feito?', kind: 'textarea' },
  ],
  '5W2H': [
    { key: 'what', label: 'What / O que sera feito?', kind: 'textarea' },
    { key: 'why', label: 'Why / Por que sera feito?', kind: 'textarea' },
    { key: 'where', label: 'Where / Onde sera feito?' },
    { key: 'when', label: 'When / Quando sera feito?' },
    { key: 'who', label: 'Who / Quem sera responsavel?' },
    { key: 'how', label: 'How / Como sera feito?', kind: 'textarea' },
    { key: 'how_much', label: 'How much / Quanto vai custar?' },
  ],
  ISHIKAWA: [
    { key: 'metodo', label: 'Metodo', kind: 'textarea' },
    { key: 'maquina_sistema', label: 'Maquina / Sistema', kind: 'textarea' },
    { key: 'mao_de_obra_pessoas', label: 'Mao de obra / Pessoas', kind: 'textarea' },
    { key: 'material_insumos', label: 'Material / Insumos', kind: 'textarea' },
    { key: 'meio_ambiente', label: 'Meio ambiente / Ambiente', kind: 'textarea' },
    { key: 'medicao_indicadores', label: 'Medicao / Indicadores', kind: 'textarea' },
    { key: 'causa_provavel', label: 'Causa provavel', kind: 'textarea' },
  ],
  GUT: [
    {
      key: 'gravidade',
      label: 'Gravidade',
      kind: 'select',
      options: [1, 2, 3, 4, 5].map((value) => ({ value: String(value), label: String(value) })),
    },
    {
      key: 'urgencia',
      label: 'Urgencia',
      kind: 'select',
      options: [1, 2, 3, 4, 5].map((value) => ({ value: String(value), label: String(value) })),
    },
    {
      key: 'tendencia',
      label: 'Tendencia',
      kind: 'select',
      options: [1, 2, 3, 4, 5].map((value) => ({ value: String(value), label: String(value) })),
    },
  ],
  ESFORCO_IMPACTO: [
    {
      key: 'impacto',
      label: 'Impacto',
      kind: 'select',
      options: [
        { value: 'baixo', label: 'Baixo' },
        { value: 'medio', label: 'Medio' },
        { value: 'alto', label: 'Alto' },
      ],
    },
    {
      key: 'esforco',
      label: 'Esforco',
      kind: 'select',
      options: [
        { value: 'baixo', label: 'Baixo' },
        { value: 'medio', label: 'Medio' },
        { value: 'alto', label: 'Alto' },
      ],
    },
  ],
  PDCA: [
    { key: 'plan', label: 'Plan / Planejar', kind: 'textarea' },
    { key: 'do', label: 'Do / Executar', kind: 'textarea' },
    { key: 'check', label: 'Check / Verificar', kind: 'textarea' },
    { key: 'act', label: 'Act / Agir ou padronizar', kind: 'textarea' },
    { key: 'resultado_esperado', label: 'Resultado esperado', kind: 'textarea' },
    { key: 'resultado_obtido', label: 'Resultado obtido', kind: 'textarea' },
    {
      key: 'proximo_ciclo_necessario',
      label: 'Proximo ciclo necessario?',
      kind: 'select',
      options: [
        { value: 'sim', label: 'Sim' },
        { value: 'nao', label: 'Nao' },
      ],
    },
  ],
};

function getDefaultMethod(initialAnalise?: DemandaAnalise | null): DemandaAnaliseMetodo {
  return initialAnalise?.metodo || '5_PORQUES';
}

function getDefaultStatus(initialAnalise?: DemandaAnalise | null): DemandaAnaliseStatus {
  return initialAnalise?.status || 'rascunho';
}

function classifyGutScore(score: number): string {
  if (score <= 25) return 'Baixa prioridade';
  if (score <= 75) return 'Media prioridade';
  return 'Alta prioridade';
}

function classifyEffortImpact(impacto?: string, esforco?: string): string {
  if (!impacto || !esforco) return '-';
  if (impacto === 'alto' && esforco === 'baixo') return 'Prioridade maxima';
  if (impacto === 'alto' && esforco === 'alto') return 'Projeto estrategico';
  if (impacto === 'baixo' && esforco === 'baixo') return 'Fazer se houver tempo';
  if (impacto === 'baixo' && esforco === 'alto') return 'Evitar ou repensar';
  return 'Prioridade intermediaria';
}

function buildInitialFields(initialAnalise?: DemandaAnalise | null): Record<string, string> {
  const result: Record<string, string> = {};
  const source = initialAnalise?.campos_map || {};
  Object.entries(source).forEach(([key, value]) => {
    if (value != null) result[key] = value;
  });
  return result;
}

function buildPayloadFields(method: DemandaAnaliseMetodo, fields: Record<string, string>) {
  const configs = FIELD_CONFIG_BY_METHOD[method] || [];
  return configs
    .map((config, ordem) => ({
      chave: config.key,
      valor: fields[config.key]?.trim() || '',
      ordem,
    }))
    .filter((field) => field.valor);
}

export function getDemandAnalysisFieldConfigs(method: DemandaAnaliseMetodo) {
  return FIELD_CONFIG_BY_METHOD[method] || [];
}

export function getDemandAnalysisFieldLabel(method: DemandaAnaliseMetodo, key: string) {
  const config = FIELD_CONFIG_BY_METHOD[method]?.find((item) => item.key === key);
  if (config) return config.label;
  if (key === 'pontuacao_total') return 'Pontuacao total';
  if (key === 'classificacao_prioridade') return 'Classificacao';
  if (key === 'classificacao') return 'Classificacao';
  return key.replace(/_/g, ' ');
}

export default function DemandAnalysisForm({
  initialAnalise,
  usuarios,
  currentUserRole,
  defaultResponsavelId,
  isSaving,
  onClose,
  onSubmit,
}: Props) {
  const [metodo, setMetodo] = useState<DemandaAnaliseMetodo>(getDefaultMethod(initialAnalise));
  const [problema, setProblema] = useState(initialAnalise?.problema || '');
  const [causaRaiz, setCausaRaiz] = useState(initialAnalise?.causa_raiz || '');
  const [status, setStatus] = useState<DemandaAnaliseStatus>(getDefaultStatus(initialAnalise));
  const [responsavelId, setResponsavelId] = useState(
    initialAnalise?.responsavel_id ? String(initialAnalise.responsavel_id) : defaultResponsavelId ? String(defaultResponsavelId) : ''
  );
  const [fields, setFields] = useState<Record<string, string>>(buildInitialFields(initialAnalise));

  useEffect(() => {
    setMetodo(getDefaultMethod(initialAnalise));
    setProblema(initialAnalise?.problema || '');
    setCausaRaiz(initialAnalise?.causa_raiz || '');
    setStatus(getDefaultStatus(initialAnalise));
    setResponsavelId(
      initialAnalise?.responsavel_id ? String(initialAnalise.responsavel_id) : defaultResponsavelId ? String(defaultResponsavelId) : ''
    );
    setFields(buildInitialFields(initialAnalise));
  }, [defaultResponsavelId, initialAnalise]);

  const configs = useMemo(() => getDemandAnalysisFieldConfigs(metodo), [metodo]);
  const podeConcluirOuCancelar = currentUserRole === 'ADMIN' || currentUserRole === 'GESTOR';
  const statusDisponiveis = useMemo(
    () =>
      DEMANDA_ANALISE_STATUS_LIST.filter((statusItem) =>
        podeConcluirOuCancelar ? true : statusItem !== 'concluido' && statusItem !== 'cancelado'
      ),
    [podeConcluirOuCancelar]
  );

  const gutPreview = useMemo(() => {
    if (metodo !== 'GUT') return null;
    const gravidade = Number(fields.gravidade || 0);
    const urgencia = Number(fields.urgencia || 0);
    const tendencia = Number(fields.tendencia || 0);
    if (!gravidade || !urgencia || !tendencia) return null;
    const total = gravidade * urgencia * tendencia;
    return { total, classificacao: classifyGutScore(total) };
  }, [fields.gravidade, fields.tendencia, fields.urgencia, metodo]);

  const esforcoImpactoPreview = useMemo(() => {
    if (metodo !== 'ESFORCO_IMPACTO') return null;
    return classifyEffortImpact(fields.impacto, fields.esforco);
  }, [fields.esforco, fields.impacto, metodo]);

  const submit = (forcedStatus?: DemandaAnaliseStatus) => {
    onSubmit({
      metodo,
      problema: problema.trim() || undefined,
      causa_raiz: causaRaiz.trim() || undefined,
      status: forcedStatus || status,
      responsavel_id: responsavelId ? Number(responsavelId) : undefined,
      campos: buildPayloadFields(metodo, fields),
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content card demand-analysis-modal">
        <div className="demand-analysis-modal-head">
          <div>
            <h3>{initialAnalise ? 'Editar analise' : 'Nova analise'}</h3>
            <p>Escolha a metodologia e registre a causa, priorizacao e plano de acao da demanda.</p>
          </div>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="grid gap-12">
          <div className="grid two-col gap-12">
            <label className="form-row">
              <span>Metodologia</span>
              <select value={metodo} onChange={(e) => setMetodo(e.target.value as DemandaAnaliseMetodo)} disabled={!!initialAnalise}>
                {DEMANDA_ANALISE_METODOS.map((method) => (
                  <option key={method} value={method}>
                    {DEMANDA_ANALISE_METODO_LABELS[method]}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-row">
              <span>Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value as DemandaAnaliseStatus)}>
                {statusDisponiveis.map((statusItem) => (
                  <option key={statusItem} value={statusItem}>
                    {DEMANDA_ANALISE_STATUS_LABELS[statusItem]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid two-col gap-12">
            <label className="form-row">
              <span>Problema identificado</span>
              <textarea value={problema} onChange={(e) => setProblema(e.target.value)} rows={3} />
            </label>

            <label className="form-row">
              <span>Causa raiz</span>
              <textarea
                value={causaRaiz}
                onChange={(e) => setCausaRaiz(e.target.value)}
                rows={3}
                placeholder={metodo === '5_PORQUES' || metodo === 'ISHIKAWA' ? 'Campo importante para esta metodologia' : ''}
              />
            </label>
          </div>

          {!!usuarios.length && (
            <label className="form-row">
              <span>Responsavel pela analise</span>
              <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
                <option value="">Nao definido</option>
                {usuarios.map((usuario) => (
                  <option key={usuario.id} value={usuario.id}>
                    {usuario.nome}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="demand-analysis-method-grid">
            {configs.map((config) => (
              <label key={config.key} className="form-row demand-analysis-field">
                <span>{config.label}</span>
                {config.kind === 'textarea' ? (
                  <textarea
                    rows={3}
                    value={fields[config.key] || ''}
                    onChange={(e) => setFields((prev) => ({ ...prev, [config.key]: e.target.value }))}
                    placeholder={config.placeholder}
                  />
                ) : config.kind === 'select' ? (
                  <select
                    value={fields[config.key] || ''}
                    onChange={(e) => setFields((prev) => ({ ...prev, [config.key]: e.target.value }))}
                  >
                    <option value="">Selecione</option>
                    {config.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={fields[config.key] || ''}
                    onChange={(e) => setFields((prev) => ({ ...prev, [config.key]: e.target.value }))}
                    placeholder={config.placeholder}
                  />
                )}
              </label>
            ))}
          </div>

          {gutPreview && (
            <div className="demand-analysis-live-card">
              <strong>Pontuacao GUT em tempo real</strong>
              <span>Total: {gutPreview.total}</span>
              <small>{gutPreview.classificacao}</small>
            </div>
          )}

          {esforcoImpactoPreview && (
            <div className="demand-analysis-live-card">
              <strong>Classificacao automatica</strong>
              <span>{esforcoImpactoPreview}</span>
            </div>
          )}

          {metodo === '5_PORQUES' && (
            <div className="demand-analysis-helper">
              Idealmente registre os 5 porques, mas o sistema permite salvar de 1 a 5 respostas.
            </div>
          )}
        </div>

        <div className="demand-analysis-modal-actions">
          <button type="button" className="btn-secondary" disabled={isSaving} onClick={() => submit('rascunho')}>
            Salvar rascunho
          </button>
          <button type="button" className="btn-primary" disabled={isSaving} onClick={() => submit()}>
            {isSaving ? 'Salvando...' : initialAnalise ? 'Atualizar analise' : 'Criar analise'}
          </button>
        </div>
      </div>
    </div>
  );
}

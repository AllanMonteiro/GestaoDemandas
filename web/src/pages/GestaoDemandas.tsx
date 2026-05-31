import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import {
  api,
  DemandaEvento,
  GestaoDemanda,
  GestaoDemandasStatus,
  GESTAO_STATUS_COR,
  GESTAO_STATUS_LABELS,
  GESTAO_STATUS_LIST,
  Prioridade,
  PRIORIDADE_LABELS,
  Usuario,
} from '../api';

const PRIORIDADE_LIST: Prioridade[] = ['baixa', 'media', 'alta', 'critica'];

const PRIORIDADE_COR: Record<Prioridade, string> = {
  baixa: '#6b7280',
  media: '#3b82f6',
  alta: '#f59e0b',
  critica: '#ef4444',
};

function formatarData(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso + (iso.includes('T') ? '' : 'T00:00:00'));
  return d.toLocaleDateString('pt-BR');
}


function Badge({ label, cor = '#6b7280' }: { label: string; cor?: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 600,
        color: '#fff',
        background: cor,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

type FormDemanda = {
  titulo: string;
  descricao: string;
  solicitante_id: string;
  responsavel_id: string;
  setor: string;
  prioridade: Prioridade;
  prazo: string;
};

const FORM_VAZIO: FormDemanda = {
  titulo: '',
  descricao: '',
  solicitante_id: '',
  responsavel_id: '',
  setor: '',
  prioridade: 'media',
  prazo: '',
};

export default function GestaoDemandas() {
  const [usuarioAtual, setUsuarioAtual] = useState<Usuario | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [demandas, setDemandas] = useState<GestaoDemanda[]>([]);
  const [demandaSelecionada, setDemandaSelecionada] = useState<GestaoDemanda | null>(null);
  const [eventos, setEventos] = useState<DemandaEvento[]>([]);
  const [novoComentario, setNovoComentario] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [modalStatus, setModalStatus] = useState(false);
  const [novoStatus, setNovoStatus] = useState<GestaoDemandasStatus>('nova');
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [form, setForm] = useState<FormDemanda>(FORM_VAZIO);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroPrioridade, setFiltroPrioridade] = useState('');
  const [filtroResponsavel, setFiltroResponsavel] = useState('');
  const [filtroSetor, setFiltroSetor] = useState('');
  const [somenteAtrasadas, setSomenteAtrasadas] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [carregando, setCarregando] = useState(false);

  const usuariosMap = useMemo(() => new Map(usuarios.map((u) => [u.id, u.nome])), [usuarios]);
  const podeGerenciar =
    usuarioAtual?.role === 'ADMIN' || usuarioAtual?.role === 'GESTOR' || usuarioAtual?.role === 'AUDITOR';

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const params: Record<string, unknown> = {};
      if (filtroStatus) params.status = filtroStatus;
      if (filtroPrioridade) params.prioridade = filtroPrioridade;
      if (filtroResponsavel) params.responsavel_id = filtroResponsavel;
      if (filtroSetor) params.setor = filtroSetor;
      if (somenteAtrasadas) params.atrasadas = true;

      const [dResp, uResp, meResp] = await Promise.all([
        api.get<GestaoDemanda[]>('/gestao-demandas', { params }),
        api.get<Usuario[]>('/usuarios').catch(() => ({ data: [] as Usuario[] })),
        api.get<Usuario>('/auth/me').catch(() => ({ data: null })),
      ]);
      setDemandas(dResp.data);
      setUsuarios(uResp.data);
      if (meResp.data) setUsuarioAtual(meResp.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setErro(e?.response?.data?.detail || 'Falha ao carregar demandas.');
    } finally {
      setCarregando(false);
    }
  }, [filtroStatus, filtroPrioridade, filtroResponsavel, filtroSetor, somenteAtrasadas]);

  const carregarEventos = useCallback(async (id: number) => {
    try {
      const { data } = await api.get<DemandaEvento[]>(`/gestao-demandas/${id}/eventos`);
      setEventos(data);
    } catch {
      setEventos([]);
    }
  }, []);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  useEffect(() => {
    if (demandaSelecionada) {
      void carregarEventos(demandaSelecionada.id);
    }
  }, [demandaSelecionada, carregarEventos]);

  const selecionarDemanda = (d: GestaoDemanda) => {
    setDemandaSelecionada(d);
    setNovoComentario('');
    setErro('');
    setMensagem('');
  };

  const abrirModalNova = () => {
    setForm(FORM_VAZIO);
    setEditandoId(null);
    setModalAberto(true);
    setErro('');
  };

  const abrirModalEditar = (d: GestaoDemanda) => {
    setForm({
      titulo: d.titulo,
      descricao: d.descricao || '',
      solicitante_id: d.solicitante_id ? String(d.solicitante_id) : '',
      responsavel_id: d.responsavel_id ? String(d.responsavel_id) : '',
      setor: d.setor || '',
      prioridade: d.prioridade,
      prazo: d.prazo || '',
    });
    setEditandoId(d.id);
    setModalAberto(true);
    setErro('');
  };

  const salvarDemanda = async (e: FormEvent) => {
    e.preventDefault();
    setErro('');
    try {
      const payload = {
        titulo: form.titulo,
        descricao: form.descricao || null,
        solicitante_id: form.solicitante_id ? Number(form.solicitante_id) : null,
        responsavel_id: form.responsavel_id ? Number(form.responsavel_id) : null,
        setor: form.setor || null,
        prioridade: form.prioridade,
        prazo: form.prazo || null,
      };

      if (editandoId) {
        const { data } = await api.put<GestaoDemanda>(`/gestao-demandas/${editandoId}`, payload);
        setDemandaSelecionada(data);
      } else {
        await api.post<GestaoDemanda>('/gestao-demandas', payload);
      }

      setModalAberto(false);
      await carregarDados();
      if (editandoId) {
        void carregarEventos(editandoId);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setErro(e?.response?.data?.detail || 'Falha ao salvar demanda.');
    }
  };

  const abrirModalStatus = (d: GestaoDemanda) => {
    setNovoStatus(d.status);
    setMotivoCancelamento('');
    setModalStatus(true);
    setErro('');
  };

  const salvarStatus = async () => {
    if (!demandaSelecionada) return;
    setErro('');
    try {
      const { data } = await api.patch<GestaoDemanda>(`/gestao-demandas/${demandaSelecionada.id}/status`, {
        status: novoStatus,
        motivo_cancelamento: motivoCancelamento || null,
      });
      setDemandaSelecionada(data);
      setDemandas((prev) => prev.map((d) => (d.id === data.id ? data : d)));
      await carregarEventos(data.id);
      setModalStatus(false);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setErro(e?.response?.data?.detail || 'Falha ao alterar status.');
    }
  };

  const enviarComentario = async (e: FormEvent) => {
    e.preventDefault();
    if (!demandaSelecionada || !novoComentario.trim()) return;
    setErro('');
    try {
      await api.post(`/gestao-demandas/${demandaSelecionada.id}/comentarios`, { comentario: novoComentario.trim() });
      setNovoComentario('');
      await carregarEventos(demandaSelecionada.id);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setErro(e?.response?.data?.detail || 'Falha ao comentar.');
    }
  };

  const excluirDemanda = async (d: GestaoDemanda) => {
    if (!confirm(`Excluir a demanda "${d.titulo}"? Esta ação não pode ser desfeita.`)) return;
    setErro('');
    try {
      await api.delete(`/gestao-demandas/${d.id}`);
      setDemandaSelecionada(null);
      await carregarDados();
      setMensagem('Demanda excluída.');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setErro(e?.response?.data?.detail || 'Falha ao excluir.');
    }
  };

  const setores = useMemo(() => {
    const s = new Set(demandas.map((d) => d.setor).filter(Boolean) as string[]);
    return Array.from(s).sort();
  }, [demandas]);

  const isAtrasada = (d: GestaoDemanda) =>
    !!d.prazo && new Date(d.prazo) < new Date() && d.status !== 'concluida' && d.status !== 'cancelada';

  return (
    <div className="grid gap-16">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Gestão de Demandas</h2>
        {podeGerenciar && (
          <button type="button" className="btn-primary" onClick={abrirModalNova}>
            + Nova Demanda
          </button>
        )}
      </div>

      {erro && <div className="error">{erro}</div>}
      {mensagem && <div className="success">{mensagem}</div>}

      {/* Filtros */}
      <div className="card">
        <div className="filters-row">
          <label className="form-row compact">
            <span>Status</span>
            <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="">Todos</option>
              {GESTAO_STATUS_LIST.map((s) => (
                <option key={s} value={s}>
                  {GESTAO_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>

          <label className="form-row compact">
            <span>Prioridade</span>
            <select value={filtroPrioridade} onChange={(e) => setFiltroPrioridade(e.target.value)}>
              <option value="">Todas</option>
              {PRIORIDADE_LIST.map((p) => (
                <option key={p} value={p}>
                  {PRIORIDADE_LABELS[p]}
                </option>
              ))}
            </select>
          </label>

          <label className="form-row compact">
            <span>Responsável</span>
            <select value={filtroResponsavel} onChange={(e) => setFiltroResponsavel(e.target.value)}>
              <option value="">Todos</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </label>

          {setores.length > 0 && (
            <label className="form-row compact">
              <span>Setor</span>
              <select value={filtroSetor} onChange={(e) => setFiltroSetor(e.target.value)}>
                <option value="">Todos</option>
                {setores.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="form-row compact checkbox-row">
            <input type="checkbox" checked={somenteAtrasadas} onChange={(e) => setSomenteAtrasadas(e.target.checked)} />
            <span>Somente atrasadas</span>
          </label>
        </div>
      </div>

      {/* Layout dois painéis */}
      <div style={{ display: 'grid', gridTemplateColumns: demandaSelecionada ? '1fr 1.4fr' : '1fr', gap: 16 }}>
        {/* Lista */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {carregando ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Carregando...</div>
          ) : demandas.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Nenhuma demanda encontrada.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 13, fontWeight: 600 }}>#</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 13, fontWeight: 600 }}>Título</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 13, fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 13, fontWeight: 600 }}>Prioridade</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 13, fontWeight: 600 }}>Prazo</th>
                </tr>
              </thead>
              <tbody>
                {demandas.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => selecionarDemanda(d)}
                    style={{
                      cursor: 'pointer',
                      borderBottom: '1px solid #f3f4f6',
                      background: demandaSelecionada?.id === d.id ? '#eff6ff' : undefined,
                      borderLeft: demandaSelecionada?.id === d.id ? '3px solid #3b82f6' : '3px solid transparent',
                    }}
                  >
                    <td style={{ padding: '10px 12px', fontSize: 13, color: '#9ca3af', fontFamily: 'monospace' }}>
                      #{d.id}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 14 }}>
                      <div style={{ fontWeight: 500 }}>{d.titulo}</div>
                      {d.setor && <div style={{ fontSize: 12, color: '#6b7280' }}>{d.setor}</div>}
                      {isAtrasada(d) && (
                        <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>ATRASADA</div>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <Badge label={GESTAO_STATUS_LABELS[d.status]} cor={GESTAO_STATUS_COR[d.status]} />
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <Badge label={PRIORIDADE_LABELS[d.prioridade]} cor={PRIORIDADE_COR[d.prioridade]} />
                    </td>
                    <td
                      style={{
                        padding: '10px 12px',
                        fontSize: 13,
                        color: isAtrasada(d) ? '#ef4444' : '#374151',
                        fontWeight: isAtrasada(d) ? 600 : 400,
                      }}
                    >
                      {formatarData(d.prazo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Painel de detalhe */}
        {demandaSelecionada && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Cabeçalho do detalhe */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'monospace', marginBottom: 4 }}>
                    #{demandaSelecionada.id}
                  </div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{demandaSelecionada.titulo}</h3>
                </div>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#9ca3af' }}
                  onClick={() => setDemandaSelecionada(null)}
                >
                  ×
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <Badge
                  label={GESTAO_STATUS_LABELS[demandaSelecionada.status]}
                  cor={GESTAO_STATUS_COR[demandaSelecionada.status]}
                />
                <Badge
                  label={PRIORIDADE_LABELS[demandaSelecionada.prioridade]}
                  cor={PRIORIDADE_COR[demandaSelecionada.prioridade]}
                />
                {isAtrasada(demandaSelecionada) && <Badge label="ATRASADA" cor="#ef4444" />}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                {podeGerenciar && (
                  <>
                    <button type="button" className="btn-secondary" onClick={() => abrirModalEditar(demandaSelecionada)}>
                      Editar
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => abrirModalStatus(demandaSelecionada)}>
                      Alterar Status
                    </button>
                  </>
                )}
                {(usuarioAtual?.role === 'ADMIN' || usuarioAtual?.role === 'GESTOR') && (
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ color: '#ef4444', borderColor: '#ef4444' }}
                    onClick={() => excluirDemanda(demandaSelecionada)}
                  >
                    Excluir
                  </button>
                )}
              </div>
            </div>

            {/* Campos da demanda */}
            <div className="card" style={{ padding: 16 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: '#374151' }}>Detalhes</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13 }}>
                <Campo label="Solicitante" valor={usuariosMap.get(demandaSelecionada.solicitante_id ?? 0) || '-'} />
                <Campo label="Responsável" valor={usuariosMap.get(demandaSelecionada.responsavel_id ?? 0) || '-'} />
                <Campo label="Setor/Área" valor={demandaSelecionada.setor || '-'} />
                <Campo label="Prazo" valor={formatarData(demandaSelecionada.prazo)} />
                <Campo label="Data de Abertura" valor={formatarData(demandaSelecionada.data_abertura)} />
                <Campo label="Data de Conclusão" valor={formatarData(demandaSelecionada.data_conclusao)} />
              </div>

              {demandaSelecionada.descricao && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Descrição</div>
                  <div
                    style={{
                      fontSize: 13,
                      color: '#374151',
                      background: '#f9fafb',
                      borderRadius: 6,
                      padding: '8px 10px',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {demandaSelecionada.descricao}
                  </div>
                </div>
              )}

              {demandaSelecionada.motivo_cancelamento && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', marginBottom: 4 }}>
                    Motivo do Cancelamento
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: '#374151',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: 6,
                      padding: '8px 10px',
                    }}
                  >
                    {demandaSelecionada.motivo_cancelamento}
                  </div>
                </div>
              )}
            </div>

            {/* Histórico / Andamento */}
            <div className="card" style={{ padding: 16 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: '#374151' }}>
                Histórico de Andamento
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                {eventos.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: 12 }}>
                    Nenhum registro ainda.
                  </div>
                ) : (
                  eventos.map((ev) => <EntradaEvento key={ev.id} entrada={ev} />)
                )}
              </div>

              <form onSubmit={enviarComentario} style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={novoComentario}
                  onChange={(e) => setNovoComentario(e.target.value)}
                  placeholder="Adicionar comentário..."
                  style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
                />
                <button type="submit" className="btn-primary" disabled={!novoComentario.trim()}>
                  Comentar
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Modal criar/editar demanda */}
      {modalAberto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={(e) => e.target === e.currentTarget && setModalAberto(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 10,
              padding: 24,
              width: '100%',
              maxWidth: 560,
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <h3 style={{ margin: '0 0 16px' }}>{editandoId ? 'Editar Demanda' : 'Nova Demanda'}</h3>
            {erro && <div className="error">{erro}</div>}

            <form onSubmit={salvarDemanda} className="grid gap-12">
              <label className="form-row">
                <span>Título *</span>
                <input
                  required
                  value={form.titulo}
                  onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                />
              </label>

              <label className="form-row">
                <span>Descrição</span>
                <textarea
                  rows={3}
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                  style={{ resize: 'vertical' }}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="form-row">
                  <span>Solicitante</span>
                  <select
                    value={form.solicitante_id}
                    onChange={(e) => setForm((f) => ({ ...f, solicitante_id: e.target.value }))}
                  >
                    <option value="">— Selecionar —</option>
                    {usuarios.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nome}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-row">
                  <span>Responsável</span>
                  <select
                    value={form.responsavel_id}
                    onChange={(e) => setForm((f) => ({ ...f, responsavel_id: e.target.value }))}
                  >
                    <option value="">— Selecionar —</option>
                    {usuarios.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nome}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-row">
                  <span>Setor/Área</span>
                  <input
                    value={form.setor}
                    onChange={(e) => setForm((f) => ({ ...f, setor: e.target.value }))}
                    placeholder="Ex: TI, RH, Operações..."
                  />
                </label>

                <label className="form-row">
                  <span>Prioridade</span>
                  <select
                    value={form.prioridade}
                    onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value as Prioridade }))}
                  >
                    {PRIORIDADE_LIST.map((p) => (
                      <option key={p} value={p}>
                        {PRIORIDADE_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-row">
                  <span>Prazo</span>
                  <input
                    type="date"
                    value={form.prazo}
                    onChange={(e) => setForm((f) => ({ ...f, prazo: e.target.value }))}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" className="btn-secondary" onClick={() => setModalAberto(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editandoId ? 'Salvar' : 'Criar Demanda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal alterar status */}
      {modalStatus && demandaSelecionada && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={(e) => e.target === e.currentTarget && setModalStatus(false)}
        >
          <div style={{ background: '#fff', borderRadius: 10, padding: 24, width: '100%', maxWidth: 420 }}>
            <h3 style={{ margin: '0 0 16px' }}>Alterar Status</h3>
            {erro && <div className="error">{erro}</div>}

            <div className="grid gap-12">
              <label className="form-row">
                <span>Status atual</span>
                <Badge
                  label={GESTAO_STATUS_LABELS[demandaSelecionada.status]}
                  cor={GESTAO_STATUS_COR[demandaSelecionada.status]}
                />
              </label>

              <label className="form-row">
                <span>Novo status</span>
                <select
                  value={novoStatus}
                  onChange={(e) => setNovoStatus(e.target.value as GestaoDemandasStatus)}
                >
                  {GESTAO_STATUS_LIST.map((s) => (
                    <option key={s} value={s}>
                      {GESTAO_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>

              {novoStatus === 'cancelada' && (
                <label className="form-row">
                  <span>Motivo do cancelamento *</span>
                  <textarea
                    required
                    rows={3}
                    value={motivoCancelamento}
                    onChange={(e) => setMotivoCancelamento(e.target.value)}
                    placeholder="Descreva o motivo..."
                    style={{ resize: 'vertical' }}
                  />
                </label>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={() => setModalStatus(false)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={salvarStatus}
                  disabled={novoStatus === 'cancelada' && !motivoCancelamento.trim()}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>{valor}</div>
    </div>
  );
}

function EntradaEvento({ entrada }: { entrada: DemandaEvento }) {
  const tipo = entrada.tipo_evento;
  const icone = tipo === 'status_alterado' ? '↔' : tipo === 'criado' ? '✓' : tipo === 'campo_alterado' ? '✎' : '💬';
  const corFundo =
    tipo === 'status_alterado' ? '#eff6ff' : tipo === 'criado' ? '#f0fdf4' : tipo === 'campo_alterado' ? '#fefce8' : '#ffffff';
  const corBorda =
    tipo === 'status_alterado' ? '#bfdbfe' : tipo === 'criado' ? '#bbf7d0' : tipo === 'campo_alterado' ? '#fde68a' : '#d1fae5';

  const conteudo = (() => {
    if (tipo === 'comentario') return entrada.valor_novo ?? '';
    if (tipo === 'status_alterado')
      return `Status alterado de "${entrada.valor_anterior ?? '—'}" para "${entrada.valor_novo ?? '—'}"`;
    if (tipo === 'campo_alterado') {
      const campo = entrada.campo_alterado ?? 'campo';
      const anterior = entrada.valor_anterior ?? '—';
      const novo = entrada.valor_novo ?? '—';
      return `${campo}: "${anterior}" → "${novo}"`;
    }
    if (tipo === 'criado') return 'Demanda criada.';
    return entrada.valor_novo ?? '';
  })();

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        padding: '8px 10px',
        background: corFundo,
        border: `1px solid ${corBorda}`,
        borderRadius: 8,
        fontSize: 13,
      }}
    >
      <div style={{ fontSize: 15, minWidth: 20, textAlign: 'center', paddingTop: 1 }}>{icone}</div>
      <div style={{ flex: 1 }}>
        <div style={{ color: '#374151' }}>{conteudo}</div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>
          {entrada.usuario_nome && <span style={{ fontWeight: 500 }}>{entrada.usuario_nome} · </span>}
          {new Date(entrada.criado_em).toLocaleDateString('pt-BR')}{' '}
          {new Date(entrada.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

import { FormEvent, useEffect, useRef, useState } from 'react';
import { api, AtividadeSetorConfig, AtividadeSubatividadeConfig, ConfiguracaoSistema, getApiErrorMessage, Usuario } from '../api';

const ICONES_SUGERIDOS = [
  '🌳','🌱','🌿','🍃','🌾','🌲','🌴','🎋',
  '🤝','👥','🏘️','🏡','🏠','🏢','🏛️','🏗️',
  '📋','📄','📁','📂','📑','📊','📈','📉',
  '♻️','💧','🌊','☁️','🌍','☀️','🌙','⭐',
  '🦺','⛑️','🔒','🛡️','⚠️','🚧','🔑','🔐',
  '🐾','🦁','🦌','🦜','🐝','🦋','🐘','🐄',
  '⚙️','🔧','🔨','🛠️','🏭','🚜','🚛','✈️',
  '📚','📖','🗂️','💡','🔬','🧪','🎯','🏆',
  '🥇','🏅','🎖️','💰','💹','📌','✅','⭐',
  '🗑️','🚿','🧹','🧺','♻️','🌡️','💊','🩺',
];

type ModalAtividadeState = {
  aberto: boolean;
  modo: 'criar' | 'editar';
  dados: AtividadeSetorConfig | null;
};

type ModalSubatividadeState = {
  aberto: boolean;
  modo: 'criar' | 'editar';
  setorId: number | null;
  dados: AtividadeSubatividadeConfig | null;
};

type ConfirmarDeletar = {
  tipo: 'atividade' | 'subatividade';
  id: number;
  nome: string;
} | null;

const ICONE_PADRAO_ATIVIDADE = ['🌳','🤝','📋','♻️','🦺','🐾','⚙️','📚','🏭','🌱','💰','🎯'];

export default function Organograma() {
  const [setores, setSetores] = useState<AtividadeSetorConfig[]>([]);
  const [configuracao, setConfiguracao] = useState<ConfiguracaoSistema | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const [modalAtividade, setModalAtividade] = useState<ModalAtividadeState>({ aberto: false, modo: 'criar', dados: null });
  const [modalSubatividade, setModalSubatividade] = useState<ModalSubatividadeState>({ aberto: false, modo: 'criar', setorId: null, dados: null });
  const [confirmarDeletar, setConfirmarDeletar] = useState<ConfirmarDeletar>(null);

  const [formAtividade, setFormAtividade] = useState({ nome: '', icone: '🌳', ativo: true, ordem: 0 });
  const [formSub, setFormSub] = useState({ nome: '', icone: '📄', ativo: true, ordem: 0 });
  const [salvando, setSalvando] = useState(false);

  const importInputRef = useRef<HTMLInputElement>(null);

  const podeEditar = usuario?.role === 'ADMIN' || usuario?.role === 'GESTOR';

  const carregar = async () => {
    try {
      setErro('');
      const [setoresResp, configResp, userResp] = await Promise.all([
        api.get<AtividadeSetorConfig[]>('/configuracoes/atividades-setores'),
        api.get<ConfiguracaoSistema>('/configuracoes'),
        api.get<Usuario>('/auth/me'),
      ]);
      setSetores(setoresResp.data);
      setConfiguracao(configResp.data);
      setUsuario(userResp.data);
      const exp: Record<number, boolean> = {};
      setoresResp.data.forEach(s => { exp[s.id] = false; });
      setExpanded(prev => {
        const merged = { ...exp };
        Object.keys(prev).forEach(k => { if (k in merged) merged[Number(k)] = prev[Number(k)]; });
        return merged;
      });
    } catch (err) {
      setErro(getApiErrorMessage(err, 'Falha ao carregar organograma.'));
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { void carregar(); }, []);

  const flash = (msg: string) => {
    setMensagem(msg);
    setTimeout(() => setMensagem(''), 3000);
  };

  const toggleExpanded = (id: number) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  const expandirTudo = () => { const e: Record<number, boolean> = {}; setores.forEach(s => { e[s.id] = true; }); setExpanded(e); };
  const recolherTudo = () => { const e: Record<number, boolean> = {}; setores.forEach(s => { e[s.id] = false; }); setExpanded(e); };

  /* ─── Atividade CRUD ─── */
  const abrirCriarAtividade = () => {
    const proximaOrdem = setores.length > 0 ? Math.max(...setores.map(s => s.ordem)) + 1 : 0;
    setFormAtividade({ nome: '', icone: ICONE_PADRAO_ATIVIDADE[setores.length % ICONE_PADRAO_ATIVIDADE.length], ativo: true, ordem: proximaOrdem });
    setModalAtividade({ aberto: true, modo: 'criar', dados: null });
  };

  const abrirEditarAtividade = (setor: AtividadeSetorConfig) => {
    setFormAtividade({ nome: setor.nome, icone: setor.icone || '📋', ativo: setor.ativo, ordem: setor.ordem });
    setModalAtividade({ aberto: true, modo: 'editar', dados: setor });
  };

  const salvarAtividade = async (e: FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      if (modalAtividade.modo === 'criar') {
        await api.post('/configuracoes/atividades-setores', formAtividade);
        flash('Atividade criada com sucesso.');
      } else {
        await api.patch(`/configuracoes/atividades-setores/${modalAtividade.dados!.id}`, formAtividade);
        flash('Atividade atualizada com sucesso.');
      }
      setModalAtividade({ aberto: false, modo: 'criar', dados: null });
      await carregar();
    } catch (err) {
      setErro(getApiErrorMessage(err, 'Falha ao salvar atividade.'));
    } finally {
      setSalvando(false);
    }
  };

  const deletarAtividade = async (id: number) => {
    setSalvando(true);
    try {
      await api.delete(`/configuracoes/atividades-setores/${id}`);
      flash('Atividade removida.');
      setConfirmarDeletar(null);
      await carregar();
    } catch (err) {
      setErro(getApiErrorMessage(err, 'Falha ao remover atividade.'));
    } finally {
      setSalvando(false);
    }
  };

  /* ─── Subatividade CRUD ─── */
  const abrirCriarSubatividade = (setorId: number) => {
    const setor = setores.find(s => s.id === setorId);
    const proximaOrdem = setor && setor.subatividades.length > 0
      ? Math.max(...setor.subatividades.map(s => s.ordem)) + 1 : 0;
    setFormSub({ nome: '', icone: '📄', ativo: true, ordem: proximaOrdem });
    setModalSubatividade({ aberto: true, modo: 'criar', setorId, dados: null });
  };

  const abrirEditarSubatividade = (sub: AtividadeSubatividadeConfig) => {
    setFormSub({ nome: sub.nome, icone: sub.icone || '📄', ativo: sub.ativo, ordem: sub.ordem });
    setModalSubatividade({ aberto: true, modo: 'editar', setorId: sub.setor_id, dados: sub });
  };

  const salvarSubatividade = async (e: FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      if (modalSubatividade.modo === 'criar') {
        await api.post('/configuracoes/atividades-subatividades', { ...formSub, setor_id: modalSubatividade.setorId });
        flash('Subatividade criada com sucesso.');
      } else {
        await api.patch(`/configuracoes/atividades-subatividades/${modalSubatividade.dados!.id}`, formSub);
        flash('Subatividade atualizada com sucesso.');
      }
      setModalSubatividade({ aberto: false, modo: 'criar', setorId: null, dados: null });
      await carregar();
    } catch (err) {
      setErro(getApiErrorMessage(err, 'Falha ao salvar subatividade.'));
    } finally {
      setSalvando(false);
    }
  };

  const deletarSubatividade = async (id: number) => {
    setSalvando(true);
    try {
      await api.delete(`/configuracoes/atividades-subatividades/${id}`);
      flash('Subatividade removida.');
      setConfirmarDeletar(null);
      await carregar();
    } catch (err) {
      setErro(getApiErrorMessage(err, 'Falha ao remover subatividade.'));
    } finally {
      setSalvando(false);
    }
  };

  /* ─── Export / Import ─── */
  const exportarDados = () => {
    const payload = setores.map(s => ({
      nome: s.nome,
      icone: s.icone,
      ativo: s.ativo,
      ordem: s.ordem,
      subatividades: s.subatividades.map(sub => ({
        nome: sub.nome,
        icone: sub.icone,
        ativo: sub.ativo,
        ordem: sub.ordem,
      })),
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'organograma-atividades.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importarDados = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const dados = JSON.parse(text) as Array<{
        nome: string; icone?: string; ativo?: boolean; ordem?: number;
        subatividades?: Array<{ nome: string; icone?: string; ativo?: boolean; ordem?: number }>;
      }>;
      if (!Array.isArray(dados)) { setErro('Arquivo inválido: deve ser um array JSON.'); return; }
      setSalvando(true);
      let criados = 0;
      for (const item of dados) {
        const resp = await api.post<AtividadeSetorConfig>('/configuracoes/atividades-setores', {
          nome: item.nome, icone: item.icone ?? null, ativo: item.ativo ?? true, ordem: item.ordem ?? 0,
        });
        for (const sub of item.subatividades ?? []) {
          await api.post('/configuracoes/atividades-subatividades', {
            setor_id: resp.data.id, nome: sub.nome, icone: sub.icone ?? null, ativo: sub.ativo ?? true, ordem: sub.ordem ?? 0,
          });
        }
        criados++;
      }
      flash(`${criados} atividade(s) importada(s) com sucesso.`);
      await carregar();
    } catch (err) {
      setErro(getApiErrorMessage(err, 'Falha ao importar dados.'));
    } finally {
      setSalvando(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  /* ─── Render helpers ─── */
  function PickerIcone({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
      <div>
        <div className="org-icon-picker">
          {ICONES_SUGERIDOS.map(em => (
            <button
              key={em}
              type="button"
              className={`org-icon-btn${value === em ? ' selected' : ''}`}
              onClick={() => onChange(em)}
              title={em}
            >
              {em}
            </button>
          ))}
        </div>
        <input
          className="input"
          value={value}
          onChange={e => onChange(e.target.value)}
          maxLength={10}
          placeholder="Ou digite um emoji personalizado"
          style={{ marginTop: 8, width: '100%' }}
        />
      </div>
    );
  }

  if (carregando) {
    return <div className="card" style={{ textAlign: 'center', padding: 32 }}>Carregando organograma...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text)' }}>Organograma de Atividades</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '0.85rem' }}>
            Estrutura hierárquica das atividades e subatividades
          </p>
        </div>
        {podeEditar && (
          <button className="btn-primary" onClick={abrirCriarAtividade}>
            + Nova Atividade
          </button>
        )}
      </div>

      {erro && <div className="alert-danger" style={{ marginBottom: 12 }}>{erro} <button onClick={() => setErro('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button></div>}
      {mensagem && <div className="alert-success" style={{ marginBottom: 12 }}>{mensagem}</div>}

      {/* Árvore do organograma */}
      <div className="org-tree-scroll">
        <div className="org-tree-container">

          {/* Nó raiz */}
          <div className="org-root-row">
            <div className="org-node-root">
              <strong>{configuracao?.nome_empresa || 'Empresa'}</strong>
            </div>
          </div>

          {setores.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
              Nenhuma atividade cadastrada.{podeEditar && ' Clique em "+ Nova Atividade" para começar.'}
            </div>
          ) : (
            <>
              {/* Linha vertical do root para as atividades */}
              <div className="org-stem" />

              {/* Nível 1 — Atividades */}
              <div className="org-children-row">
                {setores.map(setor => (
                  <div key={setor.id} className="org-child-wrapper">
                    <div className="org-child-stem" />

                    {/* Card da atividade */}
                    <div className={`org-node org-node-activity${expanded[setor.id] ? ' org-node-expanded' : ''}`}>
                      {podeEditar && (
                        <div className="org-node-actions">
                          <button
                            className="org-action-btn"
                            title="Editar"
                            onClick={() => abrirEditarAtividade(setor)}
                          >✏️</button>
                          <button
                            className="org-action-btn org-action-danger"
                            title="Remover"
                            onClick={() => setConfirmarDeletar({ tipo: 'atividade', id: setor.id, nome: setor.nome })}
                          >🗑️</button>
                        </div>
                      )}
                      <div className="org-node-icon">{setor.icone || '📋'}</div>
                      <div className="org-node-name">{setor.nome}</div>
                      {podeEditar && (
                        <button
                          className="org-add-inline-btn"
                          title="Adicionar subatividade"
                          onClick={() => { abrirCriarSubatividade(setor.id); }}
                        >+</button>
                      )}
                      {setor.subatividades.length > 0 && (
                        <button
                          className="org-toggle-btn"
                          onClick={() => toggleExpanded(setor.id)}
                          title={expanded[setor.id] ? 'Recolher' : 'Expandir'}
                        >
                          {expanded[setor.id] ? '▲' : '▼'}
                        </button>
                      )}
                    </div>

                    {/* Nível 2 — Subatividades (quando expandido) */}
                    {expanded[setor.id] && setor.subatividades.length > 0 && (
                      <>
                        <div className="org-child-stem" />
                        <div className="org-children-row">
                          {setor.subatividades.map(sub => (
                            <div key={sub.id} className="org-child-wrapper">
                              <div className="org-child-stem" />
                              <div className="org-node org-node-sub">
                                {podeEditar && (
                                  <div className="org-node-actions">
                                    <button
                                      className="org-action-btn"
                                      title="Editar"
                                      onClick={() => abrirEditarSubatividade(sub)}
                                    >✏️</button>
                                    <button
                                      className="org-action-btn org-action-danger"
                                      title="Remover"
                                      onClick={() => setConfirmarDeletar({ tipo: 'subatividade', id: sub.id, nome: sub.nome })}
                                    >🗑️</button>
                                  </div>
                                )}
                                <div className="org-node-icon" style={{ fontSize: '1.4rem' }}>{sub.icone || '📄'}</div>
                                <div className="org-node-name">{sub.nome}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Ações globais */}
      <div className="org-bottom-actions">
        <button className="btn-outline" onClick={expandirTudo}>↓ Expandir tudo</button>
        <button className="btn-outline" onClick={recolherTudo}>↑ Recolher tudo</button>
        <button className="btn-outline" onClick={exportarDados}>⬇ Exportar dados</button>
        <button className="btn-outline" onClick={() => importInputRef.current?.click()} disabled={!podeEditar}>
          ⬆ Importar dados
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={importarDados}
        />
      </div>

      {/* ─── Modal: Atividade ─── */}
      {modalAtividade.aberto && (
        <div className="modal-overlay" onClick={() => setModalAtividade(s => ({ ...s, aberto: false }))}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2>{modalAtividade.modo === 'criar' ? 'Nova Atividade' : 'Editar Atividade'}</h2>
              <button className="modal-close" onClick={() => setModalAtividade(s => ({ ...s, aberto: false }))}>×</button>
            </div>
            <form onSubmit={salvarAtividade}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nome *</label>
                  <input
                    className="input"
                    required
                    value={formAtividade.nome}
                    onChange={e => setFormAtividade(s => ({ ...s, nome: e.target.value }))}
                    maxLength={120}
                    placeholder="Nome da atividade"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Ícone</label>
                  <PickerIcone
                    value={formAtividade.icone}
                    onChange={v => setFormAtividade(s => ({ ...s, icone: v }))}
                  />
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Ordem</label>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={formAtividade.ordem}
                      onChange={e => setFormAtividade(s => ({ ...s, ordem: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Status</label>
                    <select
                      className="input"
                      value={formAtividade.ativo ? 'ativo' : 'inativo'}
                      onChange={e => setFormAtividade(s => ({ ...s, ativo: e.target.value === 'ativo' }))}
                    >
                      <option value="ativo">Ativo</option>
                      <option value="inativo">Inativo</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setModalAtividade(s => ({ ...s, aberto: false }))}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal: Subatividade ─── */}
      {modalSubatividade.aberto && (
        <div className="modal-overlay" onClick={() => setModalSubatividade(s => ({ ...s, aberto: false }))}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2>{modalSubatividade.modo === 'criar' ? 'Nova Subatividade' : 'Editar Subatividade'}</h2>
              <button className="modal-close" onClick={() => setModalSubatividade(s => ({ ...s, aberto: false }))}>×</button>
            </div>
            <form onSubmit={salvarSubatividade}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nome *</label>
                  <input
                    className="input"
                    required
                    value={formSub.nome}
                    onChange={e => setFormSub(s => ({ ...s, nome: e.target.value }))}
                    maxLength={120}
                    placeholder="Nome da subatividade"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Ícone</label>
                  <PickerIcone
                    value={formSub.icone}
                    onChange={v => setFormSub(s => ({ ...s, icone: v }))}
                  />
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Ordem</label>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={formSub.ordem}
                      onChange={e => setFormSub(s => ({ ...s, ordem: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Status</label>
                    <select
                      className="input"
                      value={formSub.ativo ? 'ativo' : 'inativo'}
                      onChange={e => setFormSub(s => ({ ...s, ativo: e.target.value === 'ativo' }))}
                    >
                      <option value="ativo">Ativo</option>
                      <option value="inativo">Inativo</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setModalSubatividade(s => ({ ...s, aberto: false }))}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal: Confirmar exclusão ─── */}
      {confirmarDeletar && (
        <div className="modal-overlay" onClick={() => setConfirmarDeletar(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2>Confirmar Exclusão</h2>
              <button className="modal-close" onClick={() => setConfirmarDeletar(null)}>×</button>
            </div>
            <div className="modal-body">
              <p>
                Deseja remover {confirmarDeletar.tipo === 'atividade' ? 'a atividade' : 'a subatividade'}{' '}
                <strong>"{confirmarDeletar.nome}"</strong>?
              </p>
              {confirmarDeletar.tipo === 'atividade' && (
                <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>
                  ⚠️ Todas as subatividades associadas também serão removidas.
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmarDeletar(null)}>Cancelar</button>
              <button
                className="btn-danger"
                disabled={salvando}
                onClick={() => {
                  if (confirmarDeletar.tipo === 'atividade') void deletarAtividade(confirmarDeletar.id);
                  else void deletarSubatividade(confirmarDeletar.id);
                }}
              >
                {salvando ? 'Removendo...' : 'Remover'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

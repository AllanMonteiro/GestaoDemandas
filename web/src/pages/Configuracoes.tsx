import { FormEvent, useEffect, useMemo, useState } from 'react';

import { api, AtividadeSetorConfig, ConfiguracaoSistema, getApiErrorMessage, Usuario } from '../api';

type Props = {
  refreshConfiguracaoNoHeader: () => Promise<void>;
};

export default function Configuracoes({ refreshConfiguracaoNoHeader }: Props) {
  const [configuracao, setConfiguracao] = useState<ConfiguracaoSistema | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [setoresAtividade, setSetoresAtividade] = useState<AtividadeSetorConfig[]>([]);
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [arquivoLogo, setArquivoLogo] = useState<File | null>(null);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacaoNovaSenha, setConfirmacaoNovaSenha] = useState('');
  const [novoSetor, setNovoSetor] = useState({ nome: '', ordem: '0' });
  const [novaSubatividade, setNovaSubatividade] = useState({ setor_id: '', nome: '', ordem: '0' });
  const [novoUsuario, setNovoUsuario] = useState({ nome: '', email: '', role: 'RESPONSAVEL', senha: '' });
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const podeGerenciarCatalogo = usuario?.role === 'ADMIN' || usuario?.role === 'GESTOR';

  const opcoesSetor = useMemo(
    () =>
      setoresAtividade
        .slice()
        .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome)),
    [setoresAtividade]
  );

  const carregar = async () => {
    try {
      setErro('');
      const [configResp, usuarioResp, setoresResp] = await Promise.all([
        api.get<ConfiguracaoSistema>('/configuracoes'),
        api.get<Usuario>('/auth/me'),
        api.get<AtividadeSetorConfig[]>('/configuracoes/atividades-setores'),
      ]);
      setConfiguracao(configResp.data);
      setNomeEmpresa(configResp.data.nome_empresa);
      setUsuario(usuarioResp.data);
      setSetoresAtividade(setoresResp.data);
      if (usuarioResp.data.role === 'ADMIN') {
        const usuariosResp = await api.get<Usuario[]>('/auth/users');
        setUsuarios(usuariosResp.data);
      }
    } catch (err: unknown) {
      setErro(getApiErrorMessage(err, 'Falha ao carregar configuracoes.'));
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const salvarNomeEmpresa = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setErro('');
      setMensagem('');
      await api.put('/configuracoes', { nome_empresa: nomeEmpresa });
      await carregar();
      await refreshConfiguracaoNoHeader();
      setMensagem('Nome da empresa atualizado com sucesso.');
    } catch (err: unknown) {
      setErro(getApiErrorMessage(err, 'Falha ao atualizar nome da empresa.'));
    }
  };

  const uploadLogo = async (e: FormEvent) => {
    e.preventDefault();
    if (!arquivoLogo) {
      setErro('Selecione um arquivo de logo.');
      return;
    }
    try {
      setErro('');
      setMensagem('');
      const formData = new FormData();
      formData.append('file', arquivoLogo);
      await api.post('/configuracoes/logo-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setArquivoLogo(null);
      await carregar();
      await refreshConfiguracaoNoHeader();
      setMensagem('Logo da empresa atualizada com sucesso.');
    } catch (err: unknown) {
      setErro(getApiErrorMessage(err, 'Falha ao atualizar logo da empresa.'));
    }
  };

  const removerLogo = async () => {
    try {
      setErro('');
      setMensagem('');
      await api.put('/configuracoes', { logo_url: null });
      await carregar();
      await refreshConfiguracaoNoHeader();
      setMensagem('Logo removida com sucesso.');
    } catch (err: unknown) {
      setErro(getApiErrorMessage(err, 'Falha ao remover logo.'));
    }
  };

  const alterarSenhaLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (novaSenha !== confirmacaoNovaSenha) {
      setErro('A confirmacao da nova senha nao confere.');
      return;
    }
    try {
      setErro('');
      setMensagem('');
      await api.post('/auth/alterar-senha', {
        senha_atual: senhaAtual,
        nova_senha: novaSenha,
      });
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmacaoNovaSenha('');
      setMensagem('Senha de login alterada com sucesso.');
    } catch (err: unknown) {
      setErro(getApiErrorMessage(err, 'Falha ao alterar senha.'));
    }
  };

  const cadastrarSetor = async (e: FormEvent) => {
    e.preventDefault();
    if (!podeGerenciarCatalogo) return;
    try {
      setErro('');
      setMensagem('');
      await api.post('/configuracoes/atividades-setores', {
        nome: novoSetor.nome,
        ordem: Number(novoSetor.ordem || 0),
        ativo: true,
      });
      setNovoSetor({ nome: '', ordem: '0' });
      await carregar();
      setMensagem('Setor de atividade cadastrado com sucesso.');
    } catch (err: unknown) {
      setErro(getApiErrorMessage(err, 'Falha ao cadastrar setor de atividade.'));
    }
  };

  const cadastrarSubatividade = async (e: FormEvent) => {
    e.preventDefault();
    if (!podeGerenciarCatalogo) return;
    try {
      setErro('');
      setMensagem('');
      await api.post('/configuracoes/atividades-subatividades', {
        setor_id: Number(novaSubatividade.setor_id),
        nome: novaSubatividade.nome,
        ordem: Number(novaSubatividade.ordem || 0),
        ativo: true,
      });
      setNovaSubatividade((prev) => ({ ...prev, nome: '', ordem: '0' }));
      await carregar();
      setMensagem('Subatividade cadastrada com sucesso.');
    } catch (err: unknown) {
      setErro(getApiErrorMessage(err, 'Falha ao cadastrar subatividade.'));
    }
  };

  const alternarSetor = async (setor: AtividadeSetorConfig) => {
    if (!podeGerenciarCatalogo) return;
    try {
      setErro('');
      setMensagem('');
      await api.patch(`/configuracoes/atividades-setores/${setor.id}`, { ativo: !setor.ativo });
      await carregar();
      setMensagem(`Setor ${!setor.ativo ? 'ativado' : 'desativado'} com sucesso.`);
    } catch (err: unknown) {
      setErro(getApiErrorMessage(err, 'Falha ao atualizar setor.'));
    }
  };

  const alternarSubatividade = async (subatividadeId: number, ativo: boolean) => {
    if (!podeGerenciarCatalogo) return;
    try {
      setErro('');
      setMensagem('');
      await api.patch(`/configuracoes/atividades-subatividades/${subatividadeId}`, { ativo: !ativo });
      await carregar();
      setMensagem(`Subatividade ${!ativo ? 'ativada' : 'desativada'} com sucesso.`);
    } catch (err: unknown) {
      setErro(getApiErrorMessage(err, 'Falha ao atualizar subatividade.'));
    }
  };

  const removerSetor = async (setorId: number) => {
    if (!podeGerenciarCatalogo) return;
    try {
      setErro('');
      setMensagem('');
      await api.delete(`/configuracoes/atividades-setores/${setorId}`);
      if (novaSubatividade.setor_id === String(setorId)) {
        setNovaSubatividade({ setor_id: '', nome: '', ordem: '0' });
      }
      await carregar();
      setMensagem('Setor removido com sucesso.');
    } catch (err: unknown) {
      setErro(getApiErrorMessage(err, 'Falha ao remover setor.'));
    }
  };

  const cadastrarUsuario = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setErro('');
      setMensagem('');
      await api.post('/auth/register', novoUsuario);
      setNovoUsuario({ nome: '', email: '', role: 'RESPONSAVEL', senha: '' });
      await carregar();
      setMensagem('Usuário cadastrado com sucesso.');
    } catch (err: unknown) {
      setErro(getApiErrorMessage(err, 'Falha ao cadastrar usuário.'));
    }
  };

  const removerUsuario = async (userId: number) => {
    if (!confirm('Confirma a remoção deste usuário?')) return;
    try {
      setErro('');
      setMensagem('');
      await api.delete(`/auth/users/${userId}`);
      await carregar();
      setMensagem('Usuário removido com sucesso.');
    } catch (err: unknown) {
      setErro(getApiErrorMessage(err, 'Falha ao remover usuário.'));
    }
  };

  const removerSubatividade = async (subatividadeId: number) => {
    if (!podeGerenciarCatalogo) return;
    try {
      setErro('');
      setMensagem('');
      await api.delete(`/configuracoes/atividades-subatividades/${subatividadeId}`);
      await carregar();
      setMensagem('Subatividade removida com sucesso.');
    } catch (err: unknown) {
      setErro(getApiErrorMessage(err, 'Falha ao remover subatividade.'));
    }
  };

  return (
    <div className="grid gap-16">
      <h2>Configuracoes</h2>

      {erro && <div className="error">{erro}</div>}
      {mensagem && <div className="success">{mensagem}</div>}

      <div className="card grid gap-12">
        <h3>Nome da Empresa</h3>
        <form className="grid gap-12" onSubmit={salvarNomeEmpresa}>
          <label className="form-row">
            <span>Nome da empresa</span>
            <input
              value={nomeEmpresa}
              onChange={(e) => setNomeEmpresa(e.target.value)}
              placeholder="Digite o nome da empresa"
              required
            />
          </label>
          <button type="submit">Salvar Nome</button>
        </form>
      </div>

      <div className="card grid gap-12">
        <h3>Logo da Empresa</h3>
        <div className="config-logo-box">
          {configuracao?.logo_preview_url ? (
            <img src={configuracao.logo_preview_url} alt="Logo da empresa" className="config-logo-preview" />
          ) : (
            <p className="muted-text">Nenhuma logo cadastrada.</p>
          )}
        </div>

        <form className="grid gap-12" onSubmit={uploadLogo}>
          <label className="form-row">
            <span>Arquivo da logo</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(e) => setArquivoLogo(e.target.files?.[0] || null)}
            />
          </label>
          <button type="submit">Enviar Logo</button>
        </form>

        {configuracao?.logo_url && (
          <button type="button" onClick={removerLogo}>
            Remover Logo
          </button>
        )}
      </div>

      <div className="card grid gap-12">
        <div className="between">
          <div>
            <h3 style={{ marginBottom: 6 }}>Setores e Subatividades</h3>
            <p className="muted-text" style={{ margin: 0 }}>
              Cadastre aqui os setores e as atividades internas de cada setor para usar no modulo de projetos.
            </p>
          </div>
        </div>

        {podeGerenciarCatalogo ? (
          <>
            <div className="grid two-col gap-12">
              <form className="card grid gap-12" onSubmit={cadastrarSetor}>
                <h4 style={{ margin: 0 }}>Novo Setor</h4>
                <label className="form-row">
                  <span>Nome do setor</span>
                  <input
                    value={novoSetor.nome}
                    onChange={(e) => setNovoSetor((prev) => ({ ...prev, nome: e.target.value }))}
                    placeholder="Ex: Manejo Florestal"
                    required
                  />
                </label>
                <label className="form-row">
                  <span>Ordem</span>
                  <input
                    type="number"
                    min={0}
                    value={novoSetor.ordem}
                    onChange={(e) => setNovoSetor((prev) => ({ ...prev, ordem: e.target.value }))}
                  />
                </label>
                <button type="submit">Cadastrar Setor</button>
              </form>

              <form className="card grid gap-12" onSubmit={cadastrarSubatividade}>
                <h4 style={{ margin: 0 }}>Nova Subatividade</h4>
                <label className="form-row">
                  <span>Setor</span>
                  <select
                    value={novaSubatividade.setor_id}
                    onChange={(e) => setNovaSubatividade((prev) => ({ ...prev, setor_id: e.target.value }))}
                    required
                  >
                    <option value="">Selecione</option>
                    {opcoesSetor.map((setor) => (
                      <option key={setor.id} value={setor.id}>
                        {setor.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-row">
                  <span>Nome da subatividade</span>
                  <input
                    value={novaSubatividade.nome}
                    onChange={(e) => setNovaSubatividade((prev) => ({ ...prev, nome: e.target.value }))}
                    placeholder="Ex: Certificacao"
                    required
                  />
                </label>
                <label className="form-row">
                  <span>Ordem</span>
                  <input
                    type="number"
                    min={0}
                    value={novaSubatividade.ordem}
                    onChange={(e) => setNovaSubatividade((prev) => ({ ...prev, ordem: e.target.value }))}
                  />
                </label>
                <button type="submit" disabled={!opcoesSetor.length}>
                  Cadastrar Subatividade
                </button>
              </form>
            </div>
          </>
        ) : (
          <p className="muted-text">Apenas ADMIN e GESTOR podem manter esse catalogo.</p>
        )}

        {!setoresAtividade.length ? (
          <div className="muted-text">Nenhum setor cadastrado ainda.</div>
        ) : (
          <div className="grid gap-12">
            {opcoesSetor.map((setor) => (
              <div key={setor.id} className="card grid gap-12">
                <div className="between">
                  <div>
                    <strong>{setor.nome}</strong>
                    <div className="muted-text">Ordem {setor.ordem} | {setor.ativo ? 'Ativo' : 'Inativo'}</div>
                  </div>
                  {podeGerenciarCatalogo && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" className="btn-secondary" onClick={() => void alternarSetor(setor)}>
                        {setor.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                      <button type="button" className="btn-danger" onClick={() => void removerSetor(setor.id)}>
                        Remover
                      </button>
                    </div>
                  )}
                </div>

                {!setor.subatividades.length ? (
                  <div className="muted-text">Sem subatividades cadastradas nesse setor.</div>
                ) : (
                  <div className="grid gap-8">
                    {setor.subatividades.map((subatividade) => (
                      <div key={subatividade.id} className="between" style={{ gap: 12 }}>
                        <div>
                          <strong>{subatividade.nome}</strong>
                          <div className="muted-text">
                            Ordem {subatividade.ordem} | {subatividade.ativo ? 'Ativa' : 'Inativa'}
                          </div>
                        </div>
                        {podeGerenciarCatalogo && (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => void alternarSubatividade(subatividade.id, subatividade.ativo)}
                            >
                              {subatividade.ativo ? 'Desativar' : 'Ativar'}
                            </button>
                            <button
                              type="button"
                              className="btn-danger"
                              onClick={() => void removerSubatividade(subatividade.id)}
                            >
                              Remover
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {usuario?.role === 'ADMIN' && (
        <div className="card grid gap-12">
          <h3>Usuários do Sistema</h3>

          <form className="grid gap-12" onSubmit={cadastrarUsuario}>
            <h4 style={{ margin: 0 }}>Cadastrar novo usuário</h4>
            <div className="grid two-col gap-12">
              <label className="form-row">
                <span>Nome</span>
                <input
                  value={novoUsuario.nome}
                  onChange={(e) => setNovoUsuario((p) => ({ ...p, nome: e.target.value }))}
                  placeholder="Nome completo"
                  required
                />
              </label>
              <label className="form-row">
                <span>E-mail</span>
                <input
                  type="email"
                  value={novoUsuario.email}
                  onChange={(e) => setNovoUsuario((p) => ({ ...p, email: e.target.value }))}
                  placeholder="email@empresa.com"
                  required
                />
              </label>
              <label className="form-row">
                <span>Perfil</span>
                <select
                  value={novoUsuario.role}
                  onChange={(e) => setNovoUsuario((p) => ({ ...p, role: e.target.value }))}
                >
                  <option value="RESPONSAVEL">Responsável</option>
                  <option value="GESTOR">Gestor</option>
                  <option value="AUDITOR">Auditor</option>
                  <option value="SOLICITANTE">Solicitante</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </label>
              <label className="form-row">
                <span>Senha inicial</span>
                <input
                  type="password"
                  value={novoUsuario.senha}
                  onChange={(e) => setNovoUsuario((p) => ({ ...p, senha: e.target.value }))}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  required
                />
              </label>
            </div>
            <button type="submit" style={{ alignSelf: 'flex-start' }}>Cadastrar Usuário</button>
          </form>

          <div style={{ borderTop: '1px solid #e5ecf5', paddingTop: 12 }}>
            <h4 style={{ margin: '0 0 10px' }}>Usuários cadastrados</h4>
            {usuarios.length === 0 ? (
              <p className="muted-text">Nenhum usuário além do admin.</p>
            ) : (
              <div className="grid gap-8">
                {usuarios.map((u) => (
                  <div key={u.id} className="between" style={{ padding: '8px 12px', background: '#f8fbff', borderRadius: 6, border: '1px solid #d5e4f1' }}>
                    <div>
                      <strong>{u.nome}</strong>
                      <div className="muted-text" style={{ fontSize: 12 }}>{u.email} · {u.role}</div>
                    </div>
                    {u.id !== usuario?.id && (
                      <button
                        type="button"
                        className="btn-danger"
                        style={{ fontSize: 12, padding: '3px 10px' }}
                        onClick={() => void removerUsuario(u.id)}
                      >
                        Remover
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card grid gap-12">
        <h3>Senha de Login</h3>
        {usuario?.role === 'ADMIN' ? (
          <form className="grid gap-12" onSubmit={alterarSenhaLogin}>
            <label className="form-row">
              <span>Senha atual</span>
              <input
                type="password"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                placeholder="Digite a senha atual"
                required
              />
            </label>
            <label className="form-row">
              <span>Nova senha</span>
              <input
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Minimo 6 caracteres"
                minLength={6}
                required
              />
            </label>
            <label className="form-row">
              <span>Confirmar nova senha</span>
              <input
                type="password"
                value={confirmacaoNovaSenha}
                onChange={(e) => setConfirmacaoNovaSenha(e.target.value)}
                placeholder="Repita a nova senha"
                minLength={6}
                required
              />
            </label>
            <button type="submit">Alterar Senha</button>
          </form>
        ) : (
          <p className="muted-text">Apenas ADMIN pode alterar senha de login.</p>
        )}
      </div>
    </div>
  );
}

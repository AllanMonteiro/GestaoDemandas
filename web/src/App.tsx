import { useEffect, useState } from 'react';
import { BrowserRouter, NavLink } from 'react-router-dom';

import { api, ConfiguracaoSistema, Usuario } from './api';
import AppRoutes from './routes';

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [configuracao, setConfiguracao] = useState<ConfiguracaoSistema | null>(null);

  const carregarUsuario = async () => {
    const { data } = await api.get<Usuario>('/auth/me');
    setUsuario(data);
  };

  const carregarConfiguracao = async () => {
    const { data } = await api.get<ConfiguracaoSistema>('/configuracoes');
    setConfiguracao(data);
  };

  const bootstrap = async () => {
    if (!localStorage.getItem('token')) return;
    try {
      await Promise.all([carregarUsuario(), carregarConfiguracao()]);
    } catch {
      localStorage.removeItem('token');
      setToken(null);
      setUsuario(null);
      setConfiguracao(null);
    }
  };

  useEffect(() => {
    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onLogin = async (newToken: string) => {
    setToken(newToken);
    await bootstrap();
  };

  const onLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUsuario(null);
    setConfiguracao(null);
  };

  const rotas = (
    <AppRoutes token={token} onLogin={onLogin} refreshConfiguracaoNoHeader={carregarConfiguracao} />
  );

  return (
    <BrowserRouter>
      <div className="app-shell">
        {token ? (
          <div className="layout-auth">
            <aside className="sidebar">
              <div className="brand">
                <div className="brand-top">
                  {configuracao?.logo_preview_url && (
                    <img src={configuracao.logo_preview_url} alt="Logo da empresa" className="brand-logo" />
                  )}
                  <strong>{configuracao?.nome_empresa || 'Sistema de Demandas'}</strong>
                </div>
                <small>Planejamento, execucao e acompanhamento de demandas</small>
              </div>

              <nav className="sidebar-menu">
                <NavLink to="/" end className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
                  Dashboard
                </NavLink>
                <NavLink to="/demandas" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
                  Demandas
                </NavLink>
                <NavLink to="/configuracoes" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
                  Configuracoes
                </NavLink>
              </nav>
            </aside>

            <div className="main-shell">
              <header className="topbar">
                <div className="topbar-actions">
                  <div className="user-block">
                    <span>{usuario ? `${usuario.nome} (${usuario.role})` : 'Usuario'}</span>
                    <button type="button" className="btn-secondary btn-icon" onClick={onLogout}>
                      <span className="btn-icon-glyph" aria-hidden>
                        x
                      </span>
                      <span>Sair</span>
                    </button>
                  </div>
                </div>
              </header>

              <main className="page-container">{rotas}</main>
            </div>
          </div>
        ) : (
          <main className="page-container">{rotas}</main>
        )}
      </div>
    </BrowserRouter>
  );
}

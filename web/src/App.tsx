import React, { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, NavLink, useLocation } from 'react-router-dom';

import { api, ConfiguracaoSistema, Usuario } from './api';
import { ErrorBoundary } from './components/ErrorBoundary';
import AppRoutes from './routes';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `sidebar-link${isActive ? ' active' : ''}`;

function RouteErrorBoundary({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return <ErrorBoundary key={pathname}>{children}</ErrorBoundary>;
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [configuracao, setConfiguracao] = useState<ConfiguracaoSistema | null>(null);
  const [authResolved, setAuthResolved] = useState<boolean>(() => !localStorage.getItem('token'));

  const carregarUsuario = useCallback(async () => {
    const { data } = await api.get<Usuario>('/auth/me');
    setUsuario(data);
  }, []);

  const carregarConfiguracao = useCallback(async () => {
    const { data } = await api.get<ConfiguracaoSistema>('/configuracoes');
    setConfiguracao(data);
  }, []);

  const bootstrap = useCallback(
    async (tokenValue: string | null = localStorage.getItem('token')) => {
      if (!tokenValue) {
        setAuthResolved(true);
        return;
      }
      try {
        await Promise.all([carregarUsuario(), carregarConfiguracao()]);
      } catch {
        localStorage.removeItem('token');
        setToken(null);
        setUsuario(null);
        setConfiguracao(null);
      } finally {
        setAuthResolved(true);
      }
    },
    [carregarUsuario, carregarConfiguracao],
  );

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const onLogin = useCallback(
    async (newToken: string) => {
      setToken(newToken);
      setAuthResolved(false);
      await bootstrap(newToken);
    },
    [bootstrap],
  );

  const onLogout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUsuario(null);
    setConfiguracao(null);
    setAuthResolved(true);
  }, []);

  const rotas = (
    <AppRoutes token={token} onLogin={onLogin} refreshConfiguracaoNoHeader={carregarConfiguracao} />
  );

  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      {token && !authResolved ? (
        <main className="page-container">
          <div className="card loading-card">Validando sessão...</div>
        </main>
      ) : (
        <div className="app-shell">
          {token ? (
            <div className="layout-auth">
              <aside className="sidebar">
                <div className="brand">
                  <div className="brand-top">
                    {configuracao?.logo_preview_url && (
                      <img
                        src={configuracao.logo_preview_url}
                        alt="Logo da empresa"
                        className="brand-logo"
                      />
                    )}
                    <strong>{configuracao?.nome_empresa || 'Portal de Demandas'}</strong>
                  </div>
                  <small>Planejamento, execução e acompanhamento de demandas</small>
                </div>

                <nav className="sidebar-menu">
                  <NavLink to="/" end className={navLinkClass}>
                    Início
                  </NavLink>
                  <NavLink to="/demandas" className={navLinkClass}>
                    Lista de Demandas
                  </NavLink>
                  <NavLink to="/demandas-kanban" className={navLinkClass}>
                    Quadro Kanban
                  </NavLink>
                  <NavLink to="/demandas-calendario" className={navLinkClass}>
                    Calendário
                  </NavLink>
                  <NavLink to="/demandas-dashboard" className={navLinkClass}>
                    Dashboard / KPIs
                  </NavLink>
                  <NavLink to="/direcionadores" className={navLinkClass}>
                    Direcionadores
                  </NavLink>
                  <NavLink to="/configuracoes" className={navLinkClass}>
                    Configurações
                  </NavLink>
                </nav>
              </aside>

              <div className="main-shell">
                <header className="topbar">
                  <div className="topbar-actions">
                    <div className="user-block">
                      <span>{usuario ? `${usuario.nome} (${usuario.role})` : 'Usuário'}</span>
                      <button type="button" className="btn-secondary btn-icon" onClick={onLogout}>
                        <span className="btn-icon-glyph" aria-hidden="true">
                          ×
                        </span>
                        <span>Sair</span>
                      </button>
                    </div>
                  </div>
                </header>

                <main className="page-container">
                  <RouteErrorBoundary>{rotas}</RouteErrorBoundary>
                </main>
              </div>
            </div>
          ) : (
            <main className="page-container">
              <ErrorBoundary>{rotas}</ErrorBoundary>
            </main>
          )}
        </div>
      )}
    </BrowserRouter>
  );
}

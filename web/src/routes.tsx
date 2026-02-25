import { Navigate, Route, Routes } from 'react-router-dom';

import Configuracoes from './pages/Configuracoes';
import Direcionadores from './pages/Direcionadores';
import Login from './pages/Login';
import Projetos from './pages/Projetos';
import ProjetosDashboard from './pages/ProjetosDashboard';

type Props = {
  token: string | null;
  onLogin: (token: string) => Promise<void>;
  refreshConfiguracaoNoHeader: () => Promise<void>;
};

type ProtectedProps = {
  token: string | null;
  children: JSX.Element;
};

function ProtectedRoute({ token, children }: ProtectedProps) {
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function AppRoutes({ token, onLogin, refreshConfiguracaoNoHeader }: Props) {
  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/" replace /> : <Login onLogin={onLogin} />} />

      <Route
        path="/"
        element={
          <ProtectedRoute token={token}>
            <ProjetosDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/demandas"
        element={
          <ProtectedRoute token={token}>
            <Projetos />
          </ProtectedRoute>
        }
      />

      <Route
        path="/direcionadores"
        element={
          <ProtectedRoute token={token}>
            <Direcionadores />
          </ProtectedRoute>
        }
      />

      <Route path="/projetos" element={<Navigate to="/demandas" replace />} />

      <Route
        path="/configuracoes"
        element={
          <ProtectedRoute token={token}>
            <Configuracoes refreshConfiguracaoNoHeader={refreshConfiguracaoNoHeader} />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to={token ? '/' : '/login'} replace />} />
    </Routes>
  );
}

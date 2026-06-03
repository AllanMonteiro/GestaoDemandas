import { Navigate, Route, Routes } from 'react-router-dom';

import Configuracoes from './pages/Configuracoes';
import Home from './pages/Home';
import DemandasList from './pages/DemandasList';
import DemandaForm from './pages/DemandaForm';
import DemandaDetail from './pages/DemandaDetail';
import DemandasDashboard from './pages/DemandasDashboard';
import DemandasKanban from './pages/DemandasKanban';
import DemandasCalendario from './pages/DemandasCalendario';
import Direcionadores from './pages/Direcionadores';
import Login from './pages/Login';
import Organograma from './pages/Organograma';
import Projetos from './pages/Projetos';
import { NotFound, Forbidden } from './pages/ErrorPages';

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
            <Home />
          </ProtectedRoute>
        }
      />

      {/* Demandas Module */}
      <Route
        path="/demandas"
        element={
          <ProtectedRoute token={token}>
            <DemandasList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/demandas/nova"
        element={
          <ProtectedRoute token={token}>
            <DemandaForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/demandas/:id"
        element={
          <ProtectedRoute token={token}>
            <DemandaDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/demandas/:id/editar"
        element={
          <ProtectedRoute token={token}>
            <DemandaForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/demandas-dashboard"
        element={
          <ProtectedRoute token={token}>
            <DemandasDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/projetos"
        element={
          <ProtectedRoute token={token}>
            <Projetos />
          </ProtectedRoute>
        }
      />
      <Route
        path="/organograma"
        element={
          <ProtectedRoute token={token}>
            <Organograma />
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

      <Route
        path="/configuracoes"
        element={
          <ProtectedRoute token={token}>
            <Configuracoes refreshConfiguracaoNoHeader={refreshConfiguracaoNoHeader} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/demandas-kanban"
        element={
          <ProtectedRoute token={token}>
            <DemandasKanban />
          </ProtectedRoute>
        }
      />
      <Route
        path="/demandas-calendario"
        element={
          <ProtectedRoute token={token}>
            <DemandasCalendario />
          </ProtectedRoute>
        }
      />
      <Route path="/403" element={<Forbidden />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

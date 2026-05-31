import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-16 p-40">
      <h1 style={{ fontSize: 120, margin: 0, color: '#e5e7eb' }}>404</h1>
      <h2 style={{ fontSize: 24 }}>Página não encontrada</h2>
      <p style={{ color: '#6b7280' }}>O caminho que você tentou acessar não existe ou foi movido.</p>
      <Link to="/" className="btn-primary">Voltar para o Início</Link>
    </div>
  );
}

export function Forbidden() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-16 p-40">
      <h1 style={{ fontSize: 120, margin: 0, color: '#fee2e2' }}>403</h1>
      <h2 style={{ fontSize: 24 }}>Acesso Negado</h2>
      <p style={{ color: '#6b7280' }}>Você não tem permissão para visualizar esta página.</p>
      <Link to="/" className="btn-primary">Voltar para o Início</Link>
    </div>
  );
}

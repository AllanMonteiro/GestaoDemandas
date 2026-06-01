import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { api, LoginResponse } from '../api';

type Props = {
  onLogin: (token: string) => Promise<void>;
};

export default function Login({ onLogin }: Props) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      const { data } = await api.post<LoginResponse>('/auth/login', { email, senha });
      localStorage.setItem('token', data.access_token);
      await onLogin(data.access_token);
      navigate('/');
    } catch (err: any) {
      setErro(err?.response?.data?.detail || 'Falha no login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-center">
      <form className="card login-card" onSubmit={submit}>
        <h1>Gestão de Demandas</h1>
        <p>Controle de fluxo, prazos e execução de demandas operacionais e estratégicas.</p>

        <label className="form-row">
          <span>Email</span>
          <input id="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required />
        </label>

        <label className="form-row">
          <span>Senha</span>
          <input id="senha" name="senha" value={senha} onChange={(e) => setSenha(e.target.value)} type="password" autoComplete="current-password" required />
        </label>

        {erro && <div className="error">{erro}</div>}

        <button type="submit" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { api, getApiErrorMessage, PRIORIDADE_LABELS, ProfissionalDemanda, Usuario } from '../api';

type FormState = {
  titulo: string;
  descricao: string;
  solicitante_id: string;
  responsavel_id: string;
  setor: string;
  prioridade: string;
  prazo: string;
};

const FORM_INICIAL: FormState = {
  titulo: '',
  descricao: '',
  solicitante_id: '',
  responsavel_id: '',
  setor: '',
  prioridade: 'media',
  prazo: '',
};

export default function DemandaForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const editando = Boolean(id);
  const parentId = searchParams.get('parentId');
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [parentDemanda, setParentDemanda] = useState<ProfissionalDemanda | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingInicial, setLoadingInicial] = useState(editando);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState<FormState>(FORM_INICIAL);

  useEffect(() => {
    void api.get('/auth/me').then((res) => {
      setForm((current) => ({
        ...current,
        solicitante_id: current.solicitante_id || String(res.data.id),
      }));
    });

    void api
      .get('/usuarios')
      .then((res) => {
        setUsuarios(res.data);
      })
      .catch(() => {
        setUsuarios([]);
      });

    if (!editando && parentId) {
      void api
        .get<ProfissionalDemanda>(`/gestao-demandas/${parentId}`)
        .then((res) => {
          setParentDemanda(res.data);
        })
        .catch((err: unknown) => {
          setErro(getApiErrorMessage(err, 'Erro ao carregar demanda pai.'));
        });
    }

    if (!editando || !id) {
      setLoadingInicial(false);
      return;
    }

    void api
      .get<ProfissionalDemanda>(`/gestao-demandas/${id}`)
      .then((res) => {
        const demanda = res.data;
        setParentDemanda(null);
        setForm({
          titulo: demanda.titulo || '',
          descricao: demanda.descricao || '',
          solicitante_id: demanda.solicitante_id ? String(demanda.solicitante_id) : '',
          responsavel_id: demanda.responsavel_id ? String(demanda.responsavel_id) : '',
          setor: demanda.setor || '',
          prioridade: demanda.prioridade,
          prazo: demanda.prazo || '',
        });
        if (demanda.parent_demanda_id) {
          setParentDemanda({
            id: demanda.parent_demanda_id,
            codigo: '',
            titulo: demanda.parent_titulo || '',
            prioridade: demanda.prioridade,
            status: demanda.status,
            data_abertura: demanda.data_abertura,
            criado_em: demanda.criado_em,
            atualizado_em: demanda.atualizado_em,
            subdemandas: [],
          });
        }
      })
      .catch((err: unknown) => {
        setErro(getApiErrorMessage(err, 'Erro ao carregar demanda.'));
      })
      .finally(() => {
        setLoadingInicial(false);
      });
  }, [editando, id, parentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro('');

    try {
      const payload = {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || undefined,
        setor: form.setor.trim() || undefined,
        prioridade: form.prioridade,
        solicitante_id: form.solicitante_id ? parseInt(form.solicitante_id, 10) : undefined,
        responsavel_id: form.responsavel_id ? parseInt(form.responsavel_id, 10) : undefined,
        prazo: form.prazo || undefined,
        parent_demanda_id: parentDemanda?.id ?? (parentId ? parseInt(parentId, 10) : undefined),
      };

      const resp = editando && id
        ? await api.put(`/gestao-demandas/${id}`, payload)
        : await api.post('/gestao-demandas', payload);

      navigate(`/demandas/${resp.data.id}`);
    } catch (err: unknown) {
      setErro(getApiErrorMessage(err, editando ? 'Erro ao atualizar demanda.' : 'Erro ao criar demanda.'));
    } finally {
      setLoading(false);
    }
  };

  if (loadingInicial) {
    return <div className="card">Carregando demanda...</div>;
  }

  return (
    <div className="max-w-800 mx-auto">
      <div className="flex items-center gap-16 mb-20">
        <button className="btn-secondary" onClick={() => navigate('/demandas')}>
          Voltar
        </button>
        <h2>{editando ? 'Editar Demanda' : parentDemanda ? 'Nova Subdemanda' : 'Nova Demanda'}</h2>
      </div>

      <form className="card grid gap-20" onSubmit={handleSubmit}>
        {erro && <div className="error">{erro}</div>}

        {parentDemanda && (
          <label className="form-row">
            <span>Demanda pai</span>
            <input
              type="text"
              value={parentDemanda.codigo ? `${parentDemanda.codigo} - ${parentDemanda.titulo}` : parentDemanda.titulo}
              readOnly
            />
          </label>
        )}

        <label className="form-row">
          <span>Titulo *</span>
          <input
            type="text"
            required
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            placeholder="Resumo da demanda"
          />
        </label>

        <label className="form-row">
          <span>Descricao</span>
          <textarea
            rows={4}
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            placeholder="Detalhes da solicitacao..."
          />
        </label>

        <div className="grid grid-cols-2 gap-20">
          <label className="form-row">
            <span>Setor / Area</span>
            <input
              type="text"
              value={form.setor}
              onChange={(e) => setForm({ ...form, setor: e.target.value })}
              placeholder="Ex: TI, RH, Financeiro"
            />
          </label>

          <label className="form-row">
            <span>Prioridade</span>
            <select
              value={form.prioridade}
              onChange={(e) => setForm({ ...form, prioridade: e.target.value })}
            >
              {Object.entries(PRIORIDADE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-20">
          <label className="form-row">
            <span>Responsavel (Opcional)</span>
            <select
              value={form.responsavel_id}
              onChange={(e) => setForm({ ...form, responsavel_id: e.target.value })}
            >
              <option value="">Selecione um responsavel</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="form-row">
            <span>Prazo Final</span>
            <input
              type="date"
              value={form.prazo}
              onChange={(e) => setForm({ ...form, prazo: e.target.value })}
            />
          </label>
        </div>

        <div className="flex justify-end gap-12 mt-20">
          <button type="button" className="btn-secondary" onClick={() => navigate('/demandas')}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Salvando...' : editando ? 'Salvar Alteracoes' : 'Criar Demanda'}
          </button>
        </div>
      </form>
    </div>
  );
}

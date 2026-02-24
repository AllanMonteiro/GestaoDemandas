# Sistema de Gestao de Projetos

Aplicacao web para gerenciamento de projetos e tarefas com foco em planejamento, acompanhamento de execucao e controle de prazos.

## Stack

- Backend: FastAPI + SQLAlchemy 2 + Alembic + Pydantic v2 + JWT + RBAC
- Banco: PostgreSQL 16
- Frontend: React + Vite + TypeScript
- Storage de anexos: S3 compativel (ja configurado no backend)
- Orquestracao local: Docker Compose

## Estrutura

```text
Demandas/
  docker-compose.yml
  api/
  web/
```

## Subir ambiente

1. Suba os containers:

```bash
docker compose up --build
```

2. Rode migracoes manualmente (se necessario):

```bash
docker compose exec api alembic upgrade head
```

## Acessos locais

- API: `http://localhost:8001`
- Swagger: `http://localhost:8001/docs`
- Web: `http://localhost:5173`

## Credencial inicial

- Email: `admin@local`
- Senha: `admin123`

## Funcionalidades de Gestao de Projetos

- Cadastro e acompanhamento de projetos (`/api/projetos`)
- Pipeline de tarefas por projeto (`/api/projetos/{id}/tarefas`)
- Atualizacao de status de projeto e tarefa
- Filtros por status, prioridade e atraso
- Dashboard com indicadores operacionais (`/api/projetos-dashboard/resumo`)
- Controle de acesso por perfil (RBAC)

## Principais endpoints novos

- `GET /api/projetos`
- `POST /api/projetos`
- `PUT /api/projetos/{projeto_id}`
- `PATCH /api/projetos/{projeto_id}/status`
- `DELETE /api/projetos/{projeto_id}`
- `GET /api/projetos/{projeto_id}/tarefas`
- `POST /api/projetos/{projeto_id}/tarefas`
- `PATCH /api/tarefas/{tarefa_id}`
- `PATCH /api/tarefas/{tarefa_id}/status`
- `DELETE /api/tarefas/{tarefa_id}`
- `GET /api/projetos-dashboard/resumo`

## Nota

O projeto preserva os modulos legados de conformidade/auditoria no backend. A interface principal foi migrada para o fluxo de gestao de projetos.

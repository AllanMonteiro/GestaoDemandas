# Deploy Render + Supabase

## Visao geral

- Backend: Render Web Service (`api/`)
- Frontend: Render Static Site (`web/`)
- Banco: Supabase Postgres
- Arquivos: Supabase Storage via endpoint S3

## 1. Preparar o Supabase

### Banco

No painel do Supabase:

1. Abra `Connect`.
2. Copie a connection string do Postgres.
3. Para Render, prefira a `Session pooler` com `sslmode=require`.

Exemplo:

```env
DATABASE_URL=postgres://postgres.<project-ref>:sua_senha@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require
```

Observacao:

- O backend deste projeto aceita `postgres://`, `postgresql://` e `postgresql+psycopg://`.
- A normalizacao para `psycopg` acontece automaticamente em runtime.

### Storage

No painel do Supabase:

1. Abra `Storage > Configuration > S3`.
2. Ative o protocolo S3.
3. Gere `Access Key` e `Secret Key`.
4. Use o endpoint direto de storage.
5. Crie o bucket `demandas-anexos` ou deixe a API cria-lo no primeiro startup.

Exemplo:

```env
S3_ENDPOINT=https://<project-ref>.storage.supabase.co/storage/v1/s3
S3_ACCESS_KEY=seu_s3_access_key
S3_SECRET_KEY=seu_s3_secret_key
S3_BUCKET=demandas-anexos
S3_REGION=seu_project_region
```

## 2. Publicar no Render

O repositório ja possui [render.yaml](/abs/c:/Trabalho/01-Programação/GestaoDemandas/Demandas/render.yaml).

### Backend

Crie um Web Service usando o `render.yaml` ou conecte o repo e importe a configuracao.

Variaveis obrigatorias:

```env
DATABASE_URL=
JWT_SECRET=
ADMIN_INITIAL_PASSWORD=
CORS_ORIGINS=https://seu-frontend.onrender.com
S3_ENDPOINT=
S3_ACCESS_KEY=
S3_SECRET_KEY=
```

Variaveis ja previstas na configuracao:

```env
S3_BUCKET=demandas-anexos
S3_REGION=auto
S3_STRICT_STARTUP=false
MAX_UPLOAD_SIZE_MB=50
```

### Frontend

Crie um Static Site no Render apontando para `web/`.

Variavel obrigatoria:

```env
VITE_API_BASE_URL=https://seu-backend.onrender.com/api
```

## 3. Ordem recomendada

1. Suba o backend no Render.
2. Aguarde o startup aplicar `alembic upgrade head`.
3. Confirme `GET /api/health`.
4. Suba o frontend com `VITE_API_BASE_URL` apontando para o backend.
5. Atualize `CORS_ORIGINS` no backend com a URL publica do frontend.

## 4. Checklist rapido

- Backend responde em `/api/health`
- Frontend abre sem erro de CORS
- Login com `admin@local`
- Upload de anexo funciona
- Criacao de demanda e subdemanda funciona

## 5. Arquivos de apoio

- Exemplo backend: [api/.env.render.example](/abs/c:/Trabalho/01-Programação/GestaoDemandas/Demandas/api/.env.render.example)
- Exemplo frontend: [web/.env.production.example](/abs/c:/Trabalho/01-Programação/GestaoDemandas/Demandas/web/.env.production.example)
- Config Render: [render.yaml](/abs/c:/Trabalho/01-Programação/GestaoDemandas/Demandas/render.yaml)

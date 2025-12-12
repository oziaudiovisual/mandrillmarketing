# Deploy no Google Cloud Run

## Projeto

| Item | Valor |
|------|-------|
| **Projeto GCP** | `mandrill-marketing-90970` |
| **Região** | `southamerica-east1` (São Paulo) |

---

## Pré-requisitos

1. [Google Cloud SDK](https://cloud.google.com/sdk) instalado
2. Estar logado: `gcloud auth login`

---

## Variáveis de Ambiente

| Variável | Descrição | Obrigatório |
|----------|-----------|-------------|
| `API_KEY` | Chave da API Gemini | ✅ Sim |

> Firebase, Firestore e Storage funcionam automaticamente no mesmo projeto.

---

## Deploy

### 1. Configurar projeto

```bash
gcloud config set project mandrill-marketing-90970
```

### 2. Fazer deploy

```bash
gcloud run deploy mandrill-marketing \
  --source . \
  --region southamerica-east1 \
  --allow-unauthenticated \
  --set-env-vars "API_KEY=SUA_CHAVE_GEMINI"
```

O Cloud Build vai:
1. Ler o `Dockerfile`
2. Fazer o build da imagem
3. Fazer deploy no Cloud Run
4. Retornar a URL do serviço

---

## Teste Local (opcional)

```bash
# Instalar dependências
npm install

# Build
npm run build

# Rodar servidor
npm start

# Acesse http://localhost:8080
```

---

## Health Check

Endpoint: `GET /health`

```json
{ "status": "ok", "timestamp": "...", "uptime": 123.45 }
```

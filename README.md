# NearJobs — Backend (API REST)

Backend simples do TCC NearJobs, feito com **Node.js + Express**.
Ele funciona como um "intermediário" entre o site (front-end) e o
banco de dados (Supabase).

```
   Site (HTML/CSS/JS)  ->  Backend (Node.js)  ->  Supabase (banco)
```

Assim o TCC fica com **dois sistemas** que se comunicam:
1. O site (front-end) que já existe
2. Esta API (backend), o segundo sistema

---

## 📁 O que cada arquivo faz

| Arquivo | Para que serve |
|---|---|
| `server.js` | Arquivo principal. Cria o servidor e todas as rotas da API. |
| `supabase.js` | Faz a conexão com o banco de dados Supabase. |
| `.env.example` | Modelo de configuração (você copia e cria o `.env` com suas chaves). |
| `.gitignore` | Diz ao GitHub para não subir a pasta `node_modules` nem o `.env`. |
| `exemplo-frontend.js` | Mostra como o site chama a API (exemplos prontos). |
| `package.json` | Lista as ferramentas que o projeto usa. |

---

## 🔌 Rotas da API (endpoints)

| Método | Endereço | O que faz |
|---|---|---|
| GET | `/api/health` | Testa se a API e o banco estão online |
| GET | `/api/vagas` | Lista todas as vagas aprovadas |
| GET | `/api/vagas/:id` | Busca uma vaga específica |
| POST | `/api/vagas` | Cria uma nova vaga |
| DELETE | `/api/vagas/:id` | Exclui uma vaga |
| GET | `/api/candidaturas/:vagaId` | Lista candidaturas de uma vaga |
| POST | `/api/candidaturas` | Cria uma candidatura |

---

## ▶️ Como colocar para funcionar

### 1. Instale o Node.js
Se ainda não tem, baixe em: https://nodejs.org (versão LTS)

### 2. Abra a pasta no terminal
```bash
cd nearjobs-backend
```

### 3. Instale as ferramentas
```bash
npm install
```
Isso cria a pasta `node_modules` com o Express, o Supabase, etc.

### 4. Configure o `.env`
- Copie o arquivo `.env.example`
- Renomeie a cópia para `.env`
- Preencha com os dados do SEU Supabase:

```
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_KEY=sua_service_role_key
PORT=3000
```

**Onde achar essas chaves:**
No Supabase → **Project Settings** → **API**
- `SUPABASE_URL` = o campo "Project URL"
- `SUPABASE_SERVICE_KEY` = a chave **service_role** (a secreta)

> ⚠️ A chave service_role é SECRETA. Ela nunca vai para o site,
> só fica aqui no backend. Por isso o backend é mais seguro.

### 5. Rode o backend
```bash
npm run dev
```

Você verá no terminal:
```
==============================================
  NearJobs API rodando em http://localhost:3000
  Teste em: http://localhost:3000/api/health
==============================================
```

### 6. Teste no navegador
Abra: **http://localhost:3000/api/health**

Se aparecer algo assim, está funcionando:
```json
{ "sucesso": true, "api": "online", "banco": "online" }
```

---

## 🎓 O que explicar na banca

- **O que é:** uma API REST que fica entre o site e o banco.
- **Por que existe:** separa as regras de negócio do site. O site
  pede os dados para a API, e a API busca no banco. Isso deixa o
  sistema mais organizado e seguro.
- **Por que é mais seguro:** a chave secreta do banco fica só no
  backend, nunca no site (que qualquer um pode ver o código).
- **Dois sistemas:** o site (front-end) e a API (backend) são dois
  programas independentes que conversam pela internet (HTTP/REST).

---

## 💡 Observação importante

Seu site atual **já funciona** falando direto com o Supabase.
Este backend é um **segundo sistema** que mostra a comunicação por API.

Você NÃO precisa trocar todo o site de uma vez. Para a apresentação,
basta demonstrar o backend rodando e respondendo (ex: abrir
`/api/vagas` no navegador e mostrar as vagas em JSON), provando que
existem dois sistemas se comunicando.

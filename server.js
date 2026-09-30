/* =========================================================
   NearJobs - Backend (API REST)
   ---------------------------------------------------------
   Este é o arquivo principal do backend.
   Ele cria um servidor que fica "escutando" pedidos do site
   (front-end) e conversa com o banco de dados (Supabase).

   Fluxo:  Site  ->  este Backend  ->  Supabase (banco)
   ========================================================= */

// 1) Importa as ferramentas que vamos usar
const express = require('express');   // cria o servidor
const cors = require('cors');         // permite o site acessar a API
require('dotenv').config();           // lê o arquivo .env (senhas/chaves)

// 2) Importa a conexão com o banco (arquivo supabase.js)
const supabase = require('./supabase');

// 3) Cria a aplicação
const app = express();
app.use(cors());            // libera o acesso do site
app.use(express.json());    // permite receber dados em formato JSON

// 4) Define a porta onde a API vai rodar
const PORTA = process.env.PORT || 3000;


/* =========================================================
   ROTA DE TESTE  (GET /api/health)
   Serve para verificar se a API e o banco estão online.
   ========================================================= */
app.get('/api/health', async (req, res) => {
  try {
    // tenta contar as vagas no banco só para testar a conexão
    const { error } = await supabase.from('jobs').select('id').limit(1);
    res.json({
      sucesso: true,
      api: 'online',
      banco: error ? 'offline' : 'online',
    });
  } catch (e) {
    res.status(500).json({ sucesso: false, erro: e.message });
  }
});


/* =========================================================
   ROTAS DE VAGAS
   ========================================================= */

// LISTAR todas as vagas aprovadas  (GET /api/vagas)
app.get('/api/vagas', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('approved', true)
      .order('posted_at', { ascending: false });

    if (error) throw error;
    res.json({ sucesso: true, vagas: data });
  } catch (e) {
    res.status(500).json({ sucesso: false, erro: e.message });
  }
});

// BUSCAR uma vaga específica pelo id  (GET /api/vagas/:id)
app.get('/api/vagas/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json({ sucesso: true, vaga: data });
  } catch (e) {
    res.status(404).json({ sucesso: false, erro: 'Vaga não encontrada.' });
  }
});

// CRIAR uma nova vaga  (POST /api/vagas)
app.post('/api/vagas', async (req, res) => {
  try {
    const novaVaga = req.body; // os dados vêm do site

    // validação simples: campos obrigatórios
    if (!novaVaga.title || !novaVaga.company) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Título e empresa são obrigatórios.',
      });
    }

    const { data, error } = await supabase
      .from('jobs')
      .insert([novaVaga])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ sucesso: true, vaga: data });
  } catch (e) {
    res.status(500).json({ sucesso: false, erro: e.message });
  }
});

// EXCLUIR uma vaga  (DELETE /api/vagas/:id)
app.delete('/api/vagas/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ sucesso: true, mensagem: 'Vaga excluída.' });
  } catch (e) {
    res.status(500).json({ sucesso: false, erro: e.message });
  }
});


/* =========================================================
   ROTAS DE CANDIDATURAS
   ========================================================= */

// LISTAR candidaturas de uma vaga  (GET /api/candidaturas/:vagaId)
app.get('/api/candidaturas/:vagaId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('job_id', req.params.vagaId)
      .order('applied_at', { ascending: false });

    if (error) throw error;
    res.json({ sucesso: true, candidaturas: data });
  } catch (e) {
    res.status(500).json({ sucesso: false, erro: e.message });
  }
});

// CRIAR uma candidatura  (POST /api/candidaturas)
app.post('/api/candidaturas', async (req, res) => {
  try {
    const candidatura = req.body;

    if (!candidatura.job_id || !candidatura.candidate_id) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Vaga e candidato são obrigatórios.',
      });
    }

    const { data, error } = await supabase
      .from('applications')
      .insert([candidatura])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ sucesso: true, candidatura: data });
  } catch (e) {
    res.status(500).json({ sucesso: false, erro: e.message });
  }
});


/* =========================================================
   INICIA O SERVIDOR
   ========================================================= */
app.listen(PORTA, () => {
  console.log('==============================================');
  console.log(`  NearJobs API rodando em http://localhost:${PORTA}`);
  console.log(`  Teste em: http://localhost:${PORTA}/api/health`);
  console.log('==============================================');
});

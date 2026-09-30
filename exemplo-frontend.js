/* =========================================================
   EXEMPLO: como o site (front-end) chama o backend
   ---------------------------------------------------------
   Hoje o seu app.js fala DIRETO com o Supabase.
   Com o backend, ele passa a falar com a API.

   Estes são exemplos que você pode usar no seu app.js
   para demonstrar a comunicação com o backend.
   ========================================================= */

// Endereço do backend (quando rodando local)
const API = 'http://localhost:3000';


// ---- Exemplo 1: listar as vagas pelo backend ----
async function listarVagasPelaAPI() {
  const resposta = await fetch(`${API}/api/vagas`);
  const dados = await resposta.json();

  if (dados.sucesso) {
    console.log('Vagas recebidas do backend:', dados.vagas);
    return dados.vagas;
  } else {
    console.error('Erro:', dados.erro);
  }
}


// ---- Exemplo 2: criar uma vaga pelo backend ----
async function criarVagaPelaAPI() {
  const novaVaga = {
    title: 'Vendedor',
    company: 'Loja do João',
    location: 'Centro, Campinas',
    salary: 'R$ 1.800',
    category: 'Comércio',
    contract_type: 'CLT',
    shift: 'Integral',
    description: 'Vaga para vendedor com experiência em atendimento.',
    approved: true,
  };

  const resposta = await fetch(`${API}/api/vagas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(novaVaga),
  });

  const dados = await resposta.json();
  console.log(dados.sucesso ? 'Vaga criada!' : 'Erro: ' + dados.erro);
}


// ---- Exemplo 3: testar se a API está no ar ----
async function testarAPI() {
  const resposta = await fetch(`${API}/api/health`);
  const dados = await resposta.json();
  console.log('Status da API:', dados);
}

/* =========================================================
   Conexão com o Supabase (banco de dados)
   ---------------------------------------------------------
   Este arquivo cria a "ponte" entre o backend e o banco.
   As chaves ficam no arquivo .env (nunca no código!).
   ========================================================= */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Pega as informações do arquivo .env
const URL = process.env.SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_KEY;

// Se faltar alguma informação, avisa e para
if (!URL || !CHAVE) {
  console.error('❌ Faltam as chaves do Supabase no arquivo .env');
  process.exit(1);
}

// Cria e exporta a conexão para os outros arquivos usarem
const supabase = createClient(URL, CHAVE);

module.exports = supabase;

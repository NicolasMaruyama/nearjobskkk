// ============================================================
//  CONFIGURAÇÃO SUPABASE
// ============================================================
const SUPABASE_URL  = 'https://ykcpqllyhcmtexaifeki.supabase.co';
const SUPABASE_ANON = 'sb_publishable_Ci7sMR0Yq4cqqql0w7M9AQ_gCjFp7cC'; 

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ============================================================
//  ESTADO GLOBAL
// ============================================================
let jobs            = [];
let activeCategory  = "Todos";
let currentUser     = null;
let mapVisible      = true;
let leafletMap      = null; 
let mapMarkers      = [];   
const categories    = ["Todos","Comércio","Administrativo","Alimentação","Saúde","Logística","Tecnologia","Educação"];

// ============================================================
//  NAVEGAÇÃO E DASHBOARD
// ============================================================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

function enterDashboard(user) {
  currentUser = user;
  
  const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0];
  const firstName = fullName.split(' ')[0];
  const initial   = firstName.charAt(0).toUpperCase();

  document.getElementById('greeting-name').textContent    = firstName;
  document.getElementById('user-name-display').textContent = firstName;
  document.getElementById('user-avatar').textContent      = initial;

  renderCategories();
  fetchJobs(); 
  showScreen('dashboard');

  setTimeout(() => {
    initRealMap();
  }, 500);
}

// ============================================================
//  MAPA REAL (LEAFLET)
// ============================================================
function initRealMap() {
  if (leafletMap) return;
  leafletMap = L.map('map-container').setView([-22.9064, -47.0616], 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(leafletMap);
}

function updateMapMarkers(jobsList) {
  if (!leafletMap) return;

  // Limpa pinos antigos
  mapMarkers.forEach(m => leafletMap.removeLayer(m));
  mapMarkers = [];

  // Adiciona pinos baseados na LAT e LNG salvas no banco
  jobsList.forEach(job => {
    // Se a vaga não tiver lat/lng (vagas antigas), ignora ou coloca no centro
    if (!job.lat || !job.lng) return;

    const marker = L.marker([job.lat, job.lng])
      .addTo(leafletMap)
      .bindPopup(`
        <div style="font-family: 'Sora', sans-serif; min-width: 140px;">
          <b style="color: #2563eb; font-size: 14px;">${job.title}</b><br>
          <span style="color: #64748b; font-size: 12px;">${job.company}</span><br>
          <div style="margin-top: 5px; border-top: 1px solid #eee; padding-top: 5px; font-size: 11px;">
             📍 ${job.location}
          </div>
        </div>
      `);
    
    mapMarkers.push(marker);
  });
}

// ============================================================
//  AUTENTICAÇÃO
// ============================================================
async function loginWithEmail() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value.trim();
  if (!email || !pass) { showToast('Preencha todos os campos'); return; }

  const btn = document.querySelector('#login .btn-submit');
  btn.disabled = true; btn.textContent = 'Entrando...';

  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });

  btn.disabled = false; btn.textContent = 'Entrar';
  if (error) { showToast('E-mail ou senha incorretos'); return; }
  enterDashboard(data.user);
}

async function registerWithEmail() {
  const name  = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass  = document.getElementById('reg-pass').value.trim();

  if (!name || !email || !pass) { showToast('Preencha todos os campos'); return; }
  const btn = document.querySelector('#register .btn-submit');
  btn.disabled = true; btn.textContent = 'Criando conta...';

  const { data, error } = await sb.auth.signUp({
    email, password: pass,
    options: { data: { full_name: name } }
  });

  btn.disabled = false; btn.textContent = 'Criar conta grátis';
  if (error) { showToast(error.message); return; }
  
  if (data.session) {
    enterDashboard(data.user);
  } else {
    showToast('Conta criada! Faça login.');
    showScreen('login');
  }
}

async function loginWithGoogle() {
  await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname }
  });
}

async function doLogout() {
  await sb.auth.signOut();
  currentUser = null;
  if(leafletMap) { leafletMap.remove(); leafletMap = null; }
  showToast('Até logo! 👋');
  setTimeout(() => showScreen('splash'), 700);
}

sb.auth.onAuthStateChange((_event, session) => {
  if (session?.user && !currentUser) { enterDashboard(session.user); }
});

// ============================================================
//  BANCO DE DADOS (JOBS)
// ============================================================
async function fetchJobs() {
  const { data, error } = await sb
    .from('jobs')
    .select('*')
    .order('posted_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar vagas:', error);
    return;
  }

  jobs = data.map(j => ({
    ...j,
    postedAt: new Date(j.posted_at).toLocaleDateString('pt-BR')
  }));

  filterJobs();
}

async function submitJob() {
  const title    = document.getElementById('m-title').value.trim();
  const company  = document.getElementById('m-company').value.trim();
  const location = document.getElementById('m-location').value.trim();
  const salary   = document.getElementById('m-salary').value.trim();
  const category = document.getElementById('m-category').value;
  const type     = document.getElementById('m-type').value;
  const desc     = document.getElementById('m-desc').value.trim();

  if (!title || !company || !location) { showToast('Preencha os campos obrigatórios'); return; }

  // --- GERA COORDENADAS PARA O MAPA ---
  const lat = -22.9064 + (Math.random() - 0.5) * 0.08;
  const lng = -47.0616 + (Math.random() - 0.5) * 0.08;

  const colors = ['', 'green', 'orange', 'rose', 'purple'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];

  const { error } = await sb.from('jobs').insert([{
    title, company, location, 
    salary: salary || 'A combinar', 
    category, type,
    description: desc,
    color: randomColor,
    user_id: currentUser.id,
    lat: lat,
    lng: lng
  }]);

  if (error) { showToast('Erro ao publicar: ' + error.message); return; }

  showToast(`✓ Vaga publicada!`);
  closeModal();
  fetchJobs(); 
}

// ============================================================
//  FILTROS E RENDERIZAÇÃO
// ============================================================
function renderCategories() {
  document.getElementById('cat-scroll').innerHTML = categories.map(c => `
    <button class="cat-pill ${c === activeCategory ? 'active' : ''}"
            onclick="setCategory('${c}')">${c}</button>
  `).join('');
}

function setCategory(cat) {
  activeCategory = cat;
  renderCategories();
  filterJobs();
}

function filterJobs() {
  const q = (document.getElementById('search-input')?.value || '').toLowerCase();
  const filtered = jobs.filter(j => {
    const matchCat = activeCategory === 'Todos' || j.category === activeCategory;
    const matchQ   = !q || [j.title, j.company, j.location].some(v => v && v.toLowerCase().includes(q));
    return matchCat && matchQ;
  });
  renderJobs(filtered);
  updateMapMarkers(filtered); 
  document.getElementById('stat-total').textContent = filtered.length;
}

function renderJobs(list) {
  const el = document.getElementById('jobs-list');
  if (!list.length) {
    el.innerHTML = `<div class="no-results">Nenhuma vaga encontrada</div>`;
    return;
  }
  el.innerHTML = list.map((j, i) => `
    <div class="job-card ${j.color || ''}" style="animation-delay:${i * 0.07}s">
      <div class="job-card-header">
        <div>
          <div class="job-title">${j.title}</div>
          <div class="job-company">${j.company}</div>
        </div>
        <div class="job-salary">${j.salary}</div>
      </div>
      <div class="job-tags">
        <span class="job-tag location">📍 ${j.location}</span>
        <span class="job-tag type">⏰ ${j.type}</span>
      </div>
      <p class="job-desc">${j.description || ''}</p>
      <div class="job-footer">
        <span class="job-posted">Postado em: ${j.postedAt}</span>
        <button class="btn-apply" onclick="applyJob('${j.title}')">Candidatar →</button>
      </div>
    </div>
  `).join('');
}

// ============================================================
//  UI / MODAIS
// ============================================================
function applyJob(title) { showToast(`✓ Candidatura enviada: ${title}`); }

function toggleMap() {
  mapVisible = !mapVisible;
  const mapEl = document.getElementById('map-container');
  mapEl.style.display = mapVisible ? 'block' : 'none';
  document.getElementById('map-toggle-btn').textContent  = mapVisible ? 'Ocultar mapa' : 'Mostrar mapa';
  
  if(mapVisible && leafletMap) {
    setTimeout(() => leafletMap.invalidateSize(), 100);
  }
}

function openModal()  { document.getElementById('modal-overlay').classList.add('open'); }
function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }
function closeModalOutside(e) { if (e.target.id === 'modal-overlay') closeModal(); }

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}
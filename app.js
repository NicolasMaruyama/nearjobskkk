const SUPABASE_URL  = 'https://ykcpqllyhcmtexaifeki.supabase.co';
const SUPABASE_ANON = 'sb_publishable_Ci7sMR0Yq4cqqql0w7M9AQ_gCjFp7cC';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// E-mail(s) com acesso de administrador
const ADMIN_EMAILS = ['moreninhagames13@gmail.com'];
function isAdmin() {
  return currentUser && ADMIN_EMAILS.includes((currentUser.email || '').toLowerCase());
}

let jobs = [], activeCategory = 'Todos', currentUser = null, userProfile = null;
let leafletMap = null, mapMarkers = [], userLocation = null, nearMeActive = false;
let searchRadius = 10, radiusCircle = null, userMarker = null;
let myApplications = new Set(); // IDs das vagas que o usuário já se candidatou

const categories = ['Todos','Comércio','Tecnologia','Saúde','Logística','Educação','Alimentação'];

const AVATARS = [
  { id: '1',  url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=Felix&size=80' },
  { id: '2',  url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=Sara&size=80' },
  { id: '3',  url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=Marco&size=80' },
  { id: '4',  url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=Luna&size=80' },
  { id: '5',  url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=Carlos&size=80' },
  { id: '6',  url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=Ana&size=80' },
  { id: '7',  url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=Bruno&size=80' },
  { id: '8',  url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=Julia&size=80' },
  { id: '9',  url: 'https://api.dicebear.com/7.x/notionists/svg?seed=Pedro&size=80' },
  { id: '10', url: 'https://api.dicebear.com/7.x/notionists/svg?seed=Maria&size=80' },
  { id: '11', url: 'https://api.dicebear.com/7.x/notionists/svg?seed=Rafael&size=80' },
  { id: '12', url: 'https://api.dicebear.com/7.x/notionists/svg?seed=Camila&size=80' },
  { id: '13', url: 'https://api.dicebear.com/7.x/notionists/svg?seed=Diego&size=80' },
  { id: '14', url: 'https://api.dicebear.com/7.x/notionists/svg?seed=Isabela&size=80' },
  { id: '15', url: 'https://api.dicebear.com/7.x/notionists/svg?seed=Thiago&size=80' },
  { id: '16', url: 'https://api.dicebear.com/7.x/notionists/svg?seed=Larissa&size=80' },
];

/* =========================================================
   UTILS
   ========================================================= */
function hideLoading() {
  const s = document.getElementById('loading-screen');
  if (s) { s.style.opacity = '0'; s.style.transition = 'opacity 0.4s'; setTimeout(() => s.remove(), 400); }
}
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 'dashboard' && leafletMap) setTimeout(() => leafletMap.invalidateSize(), 200);
  window.scrollTo(0, 0);
}
function showToast(msg, type = 'default') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type === 'error' ? ' toast-error' : type === 'success' ? ' toast-success' : '');
  setTimeout(() => t.classList.remove('show'), 3500);
}

/* =========================================================
   VALIDAÇÕES
   ========================================================= */
function validateSalary(value) {
  if (!value || value.toString().trim() === '') return { ok: true, val: null }; // opcional
  const num = parseFloat(value.toString().replace(/[^\d.,]/g, '').replace(',', '.'));
  if (isNaN(num) || num <= 0) return { ok: false, msg: '⚠️ Salário inválido. Use apenas números (ex: 2500).' };
  if (num < 100) return { ok: false, msg: '⚠️ Salário muito baixo. Mínimo R$ 100.' };
  if (num > 100000) return { ok: false, msg: '⚠️ Salário muito alto. Máximo R$ 100.000.' };
  return { ok: true, val: num };
}

function validateJobForm() {
  const title   = document.getElementById('m-title').value.trim();
  const company = document.getElementById('m-company').value.trim();
  const loc     = document.getElementById('m-location').value.trim();
  const salary  = document.getElementById('m-salary').value;
  const desc    = document.getElementById('m-desc').value.trim();

  if (!title)          return { ok: false, msg: '⚠️ Informe o cargo da vaga.' };
  if (title.length < 3) return { ok: false, msg: '⚠️ Cargo muito curto (mínimo 3 letras).' };
  if (!company)        return { ok: false, msg: '⚠️ Informe o nome da empresa.' };
  if (!loc)            return { ok: false, msg: '⚠️ Informe o bairro ou endereço.' };
  if (loc.length < 3)  return { ok: false, msg: '⚠️ Endereço muito curto.' };
  if (!desc || desc.length < 20) return { ok: false, msg: '⚠️ Descrição muito curta. Mínimo 20 caracteres.' };

  const salCheck = validateSalary(salary);
  if (!salCheck.ok) return salCheck;

  return { ok: true };
}

/* =========================================================
   AUTH
   ========================================================= */
async function loginWithGoogle() {
  await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname } });
}

async function loginWithEmail() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  if (!email || !pass) return showToast('⚠️ Preencha e-mail e senha!', 'error');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showToast('⚠️ E-mail inválido.', 'error');
  const btn = document.querySelector('#login .btn-submit');
  btn.textContent = 'Entrando...'; btn.disabled = true;
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  btn.textContent = 'Entrar →'; btn.disabled = false;
  if (error) return showToast('❌ ' + (error.message.includes('Invalid') ? 'E-mail ou senha incorretos.' : error.message), 'error');
  enterDashboard(data.user);
}

async function registerWithEmail() {
  const name      = document.getElementById('reg-name').value.trim();
  const email     = document.getElementById('reg-email').value.trim();
  const pass      = document.getElementById('reg-pass').value;
  const isCompany = document.getElementById('reg-is-company').value === 'true';
  const cnpj      = document.getElementById('reg-cnpj').value.replace(/\D/g, '');

  if (!name || !email || !pass) return showToast('⚠️ Preencha todos os campos!', 'error');
  if (name.length < 2) return showToast('⚠️ Nome muito curto.', 'error');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showToast('⚠️ E-mail inválido.', 'error');
  if (pass.length < 8) return showToast('⚠️ Senha precisa ter 8+ caracteres.', 'error');

  const btn = document.querySelector('#register .btn-submit');

  // Validação de CNPJ para empresas
  let cnpjData = null;
  if (isCompany) {
    if (!cnpj || cnpj.length !== 14) return showToast('⚠️ Informe o CNPJ completo (14 dígitos).', 'error');
    if (!isValidCnpjFormat(cnpj)) return showToast('❌ CNPJ inválido (dígitos verificadores não conferem).', 'error');

    btn.textContent = '🔍 Verificando CNPJ...'; btn.disabled = true;
    cnpjData = await checkCnpjExists(cnpj);
    if (cnpjData === false) {
      btn.textContent = 'Criar Conta →'; btn.disabled = false;
      return showToast('❌ CNPJ não encontrado na Receita Federal.', 'error');
    }
    // cnpjData === null significa que a API falhou — aceita só com o formato válido
  }

  btn.textContent = 'Criando conta...'; btn.disabled = true;
  const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { full_name: name } } });
  btn.textContent = 'Criar Conta →'; btn.disabled = false;
  if (error) return showToast('❌ ' + error.message, 'error');

  const profile = { id: data.user.id, full_name: name, is_company: isCompany, avatar_id: '1' };
  if (isCompany) {
    profile.cnpj = cnpj;
    if (cnpjData && cnpjData.razao_social) profile.company_legal_name = cnpjData.razao_social;
  }

  const { error: pErr } = await sb.from('profiles').upsert(profile);
  if (pErr && (pErr.message?.includes('cnpj') || pErr.message?.includes('company_legal_name'))) {
    // Colunas de CNPJ ainda não existem — salva sem elas
    await sb.from('profiles').upsert({ id: data.user.id, full_name: name, is_company: isCompany, avatar_id: '1' });
  }

  showToast('✅ Conta criada com sucesso!', 'success');
  enterDashboard(data.user);
}

function selectType(btn, value) {
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('reg-is-company').value = value;
  // Mostra/esconde o campo CNPJ e ajusta o label do nome
  const cnpjField = document.getElementById('reg-cnpj-field');
  const nameLabel = document.getElementById('reg-name-label');
  const nameInput = document.getElementById('reg-name');
  if (value === 'true') {
    cnpjField.style.display = 'block';
    nameLabel.textContent = 'Nome da Empresa';
    nameInput.placeholder = 'Ex: Padaria do Bairro Ltda';
  } else {
    cnpjField.style.display = 'none';
    nameLabel.textContent = 'Nome Completo';
    nameInput.placeholder = 'João da Silva';
  }
}

/* =========================================================
   VALIDAÇÃO DE CNPJ
   ========================================================= */
// Formata o CNPJ enquanto digita: 00.000.000/0000-00
function formatCnpj(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 14);
  v = v.replace(/^(\d{2})(\d)/, '$1.$2');
  v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
  v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
  v = v.replace(/(\d{4})(\d)/, '$1-$2');
  input.value = v;

  // Feedback visual do formato
  const hint = document.getElementById('cnpj-hint');
  const digits = input.value.replace(/\D/g, '');
  if (digits.length === 14) {
    if (isValidCnpjFormat(digits)) { hint.textContent = '✓ Formato válido'; hint.className = 'cnpj-hint valid'; }
    else { hint.textContent = '✕ CNPJ inválido'; hint.className = 'cnpj-hint invalid'; }
  } else {
    hint.textContent = ''; hint.className = 'cnpj-hint';
  }
}

// Valida os dígitos verificadores do CNPJ (cálculo matemático oficial)
function isValidCnpjFormat(cnpj) {
  cnpj = cnpj.replace(/\D/g, '');
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false; // todos iguais

  const calc = (base) => {
    let len = base.length, pos = len - 7, sum = 0;
    for (let i = len; i >= 1; i--) {
      sum += parseInt(base.charAt(len - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };

  const d1 = calc(cnpj.slice(0, 12));
  if (d1 !== parseInt(cnpj.charAt(12))) return false;
  const d2 = calc(cnpj.slice(0, 13));
  if (d2 !== parseInt(cnpj.charAt(13))) return false;
  return true;
}

// Consulta a API pública (BrasilAPI) se o CNPJ existe de verdade
// Retorna: objeto com dados se existe | false se não existe | null se a API falhou
async function checkCnpjExists(cnpj) {
  try {
    const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (resp.status === 404) return false;
    if (!resp.ok) return null;
    const data = await resp.json();
    return data && data.cnpj ? data : false;
  } catch (e) {
    console.warn('API de CNPJ indisponível:', e);
    return null; // falha de rede — não bloqueia o cadastro
  }
}

async function doLogout() {
  if (!confirm('Tem certeza que deseja sair da sua conta?')) return;
  await sb.auth.signOut();
  currentUser = null; userProfile = null; jobs = []; myApplications = new Set();
  window.location.reload();
}

/* =========================================================
   DASHBOARD
   ========================================================= */
async function enterDashboard(user) {
  currentUser = user;
  // Mostra skeleton de carregamento
  const jobsEl = document.getElementById('jobs-list');
  if (jobsEl) jobsEl.innerHTML = `
    <div class="job-skeleton"></div>
    <div class="job-skeleton"></div>
    <div class="job-skeleton"></div>`;
  try {
    await fetchUserProfile();
    await Promise.all([fetchJobs(), fetchMyApplications()]);
    loadNotifications();
  } catch(e) { console.error(e); }
  renderCategories();
  showScreen('dashboard');
  setTimeout(() => initMap(), 400);
  hideLoading();
}

async function fetchUserProfile() {
  const { data } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
  userProfile = data;
  const name = data?.full_name || currentUser.email.split('@')[0];
  document.getElementById('user-name-display').textContent = name.split(' ')[0];
  document.getElementById('greeting-name').textContent = name.split(' ')[0];
  const avatarId  = data?.avatar_id || '1';
  const avatarUrl = data?.photo_url || AVATARS.find(a => a.id === avatarId)?.url || AVATARS[0].url;
  document.getElementById('user-avatar').innerHTML = `<img src="${avatarUrl}" alt="avatar">`;
  document.getElementById('fab-add-job').style.display = data?.is_company ? 'flex' : 'none';
  const btnCompany = document.getElementById('btn-go-company');
  if (btnCompany) btnCompany.style.display = data?.is_company ? 'block' : 'none';

  // Detecta admin pelo e-mail
  const btnAdmin = document.getElementById('btn-go-admin');
  if (btnAdmin) btnAdmin.style.display = isAdmin() ? 'block' : 'none';

  // Stat card de candidaturas: empresa vê "Minhas Vagas", candidato vê candidaturas
  const statApps = document.getElementById('stat-applications');
  const statCard = document.getElementById('stat-card-apps');
  if (data?.is_company) {
    if (statCard) { statCard.querySelector('.stat-label').textContent = 'Minhas Vagas'; }
  } else {
    if (statApps) statApps.textContent = myApplications.size;
  }
}

async function fetchJobs() {
  const { data, error } = await sb.from('jobs').select('*').eq('approved', true).order('posted_at', { ascending: false });
  if (error) { console.error(error); return; }
  jobs = data || [];
  // Se for empresa, atualiza o stat de "Minhas Vagas"
  if (userProfile?.is_company && currentUser) {
    const myJobs = jobs.filter(j => j.user_id === currentUser.id).length;
    const statEl = document.getElementById('stat-applications');
    if (statEl) statEl.textContent = myJobs;
  }
  await loadCompanyRatings();
  filterJobs();
}

// Cache de médias de avaliação por empresa (user_id da empresa)
let companyRatingsCache = {};
async function loadCompanyRatings() {
  const companyIds = [...new Set(jobs.map(j => j.user_id).filter(Boolean))];
  if (companyIds.length === 0) return;
  const { data } = await sb.from('ratings').select('to_user_id, stars').in('to_user_id', companyIds);
  if (!data) return;
  const agg = {};
  data.forEach(r => {
    if (!agg[r.to_user_id]) agg[r.to_user_id] = { sum: 0, count: 0 };
    agg[r.to_user_id].sum += r.stars;
    agg[r.to_user_id].count++;
  });
  companyRatingsCache = {};
  Object.entries(agg).forEach(([id, v]) => {
    companyRatingsCache[id] = { avg: (v.sum / v.count).toFixed(1), count: v.count };
  });
}

/* =========================================================
   CANDIDATURAS — buscar as do usuário atual
   ========================================================= */
async function fetchMyApplications() {
  if (!currentUser || userProfile?.is_company) return;
  const { data } = await sb.from('applications').select('job_id').eq('candidate_id', currentUser.id);
  myApplications = new Set((data || []).map(a => a.job_id));
}

/* =========================================================
   FILTROS
   ========================================================= */
function filterJobs() {
  const q        = document.getElementById('search-input').value.toLowerCase();
  const contract = document.getElementById('filter-contract').value;
  const shift    = document.getElementById('filter-shift').value;

  let filtered = jobs.filter(j => {
    const matchCat = activeCategory === 'Todos' || j.category === activeCategory;
    const matchQ   = !q || j.title.toLowerCase().includes(q) || (j.company||'').toLowerCase().includes(q);
    const matchC   = contract === 'Todos' || j.contract_type === contract;
    const matchS   = shift === 'Todos' || j.shift === shift;
    return matchCat && matchQ && matchC && matchS;
  });

  if (nearMeActive && userLocation) {
    filtered = filtered
      .map(j => ({ ...j, dist: calcDist(userLocation.lat, userLocation.lng, j.lat, j.lng) }))
      .filter(j => j.dist <= searchRadius)
      .sort((a, b) => a.dist - b.dist);
  }

  renderJobs(filtered);
  updateMapMarkers(filtered);
  document.getElementById('stat-total').textContent = filtered.length;
}

function setCategory(c) { activeCategory = c; renderCategories(); filterJobs(); }
function renderCategories() {
  document.getElementById('cat-scroll').innerHTML = categories.map(c =>
    `<button class="cat-pill ${c===activeCategory?'active':''}" onclick="setCategory('${c}')">${c}</button>`
  ).join('');
}

/* =========================================================
   MAPA
   ========================================================= */
function initMap() {
  if (leafletMap) return;
  leafletMap = L.map('map-container').setView([-22.9064, -47.0616], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(leafletMap);
  updateMapMarkers(jobs);
}
function updateMapMarkers(list) {
  if (!leafletMap) return;
  mapMarkers.forEach(m => leafletMap.removeLayer(m));
  mapMarkers = list.filter(j => j.lat && j.lng).map(j => {
    const m = L.marker([j.lat, j.lng]).addTo(leafletMap);
    m.bindPopup(`<b>${j.title}</b><br>${j.company}<br>${j.salary||''}`);
    return m;
  });
}
function toggleMap() {
  const m   = document.getElementById('map-container');
  const btn = document.querySelector('.map-toggle-btn');
  if (m.style.display === 'none') {
    m.style.display = 'block'; btn.textContent = 'Ocultar mapa';
    setTimeout(() => leafletMap && leafletMap.invalidateSize(), 200);
  } else { m.style.display = 'none'; btn.textContent = 'Mostrar mapa'; }
}
function toggleNearMe() {
  const btn = document.getElementById('btn-near-me');
  const sel = document.getElementById('distance-select');
  if (nearMeActive) {
    nearMeActive = false;
    btn.classList.remove('active');
    sel.style.display = 'none';
    removeRadiusCircle();
    filterJobs();
    return;
  }
  if (!navigator.geolocation) return showToast('❌ Geolocalização não disponível.', 'error');
  showToast('📍 Detectando sua localização...');
  navigator.geolocation.getCurrentPosition(pos => {
    userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    nearMeActive = true;
    btn.classList.add('active');
    sel.style.display = 'block';
    if (leafletMap) {
      leafletMap.setView([userLocation.lat, userLocation.lng], 12);
      drawRadiusCircle();
    }
    filterJobs();
  }, () => showToast('❌ Não foi possível obter localização.', 'error'));
}

function changeRadius() {
  searchRadius = parseInt(document.getElementById('distance-select').value);
  if (nearMeActive && userLocation && leafletMap) {
    drawRadiusCircle();
    // Ajusta o zoom do mapa conforme o raio
    const zoom = searchRadius <= 5 ? 13 : searchRadius <= 10 ? 12 : searchRadius <= 20 ? 11 : 10;
    leafletMap.setView([userLocation.lat, userLocation.lng], zoom);
  }
  filterJobs();
}

function drawRadiusCircle() {
  if (!leafletMap || !userLocation) return;
  removeRadiusCircle();

  // Marcador da posição do usuário
  const userIcon = L.divIcon({
    className: 'user-location-marker',
    html: '<div class="user-dot"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
  userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon, zIndexOffset: 1000 })
    .addTo(leafletMap).bindPopup('📍 Você está aqui');

  // Círculo do raio de busca (em metros)
  radiusCircle = L.circle([userLocation.lat, userLocation.lng], {
    radius: searchRadius * 1000,
    color: '#2563eb',
    fillColor: '#2563eb',
    fillOpacity: 0.08,
    weight: 2,
    dashArray: '6 6',
  }).addTo(leafletMap);
}

function removeRadiusCircle() {
  if (radiusCircle) { leafletMap.removeLayer(radiusCircle); radiusCircle = null; }
  if (userMarker)   { leafletMap.removeLayer(userMarker);   userMarker = null; }
}
function calcDist(lat1, lng1, lat2, lng2) {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/* =========================================================
   RENDER VAGAS
   ========================================================= */
function renderJobs(list) {
  const el = document.getElementById('jobs-list');
  if (!list.length) {
    // Mensagem contextual: depende se é busca, proximidade ou geral
    let icon = '🔍', title = 'Nenhuma vaga encontrada', msg = 'Tente ajustar os filtros ou a busca.';
    if (nearMeActive) {
      icon = '📍'; title = 'Nenhuma vaga nessa distância';
      msg = `Não há vagas em até ${searchRadius} km de você. Tente aumentar a distância no seletor.`;
    } else if (jobs.length === 0) {
      icon = '💼'; title = 'Ainda não há vagas publicadas';
      msg = 'Volte em breve — novas oportunidades aparecem aqui.';
    }
    el.innerHTML = `<div class="jobs-empty"><span>${icon}</span><h3>${title}</h3><p>${msg}</p></div>`;
    return;
  }
  el.innerHTML = list.map((j, i) => {
    const dist      = j.dist ? `📍 ${j.dist.toFixed(1)} km de você` : `📍 ${j.location||'Campinas'}`;
    const applied   = myApplications.has(j.id);
    const applyBtn  = applied
      ? `<button class="btn-apply btn-applied" disabled>✓ Inscrito</button>`
      : `<button class="btn-apply" onclick="applyToJob('${j.id}',this)">Candidatar-se</button>`;
    const isOwner   = userProfile?.is_company && j.user_id === currentUser?.id;
    const ownerBtn  = isOwner
      ? `<button class="btn-delete-job" onclick="deleteJob('${j.id}',this)" title="Excluir vaga">🗑️</button>`
      : '';
    // Nota da empresa (se tiver avaliações)
    const rating = companyRatingsCache[j.user_id];
    const ratingHtml = rating
      ? `<span class="job-rating" title="${rating.count} avaliação(ões)">⭐ ${rating.avg}</span>`
      : '';

    return `
    <div class="job-card" style="animation-delay:${Math.min(i*60,400)}ms" id="job-${j.id}">
      <div class="job-card-header">
        <span class="job-title">${j.title}</span>
        <span class="job-salary">${j.salary||'A combinar'}</span>
      </div>
      <p class="job-company"><span>${j.company||'Empresa'}</span> • ${j.location||'Campinas'} ${ratingHtml}</p>
      <div class="job-tags">
        ${j.category      ? `<span class="tag">${j.category}</span>` : ''}
        ${j.contract_type ? `<span class="tag tag-green">${j.contract_type}</span>` : ''}
        ${j.shift         ? `<span class="tag tag-gray">${j.shift}</span>` : ''}
      </div>
      ${j.description ? `<p class="job-desc">${j.description.substring(0,120)}${j.description.length>120?'…':''}</p>` : ''}
      <div class="job-footer">
        <span class="job-distance">${dist}</span>
        <div style="display:flex;gap:8px;align-items:center;">
          ${ownerBtn}
          ${isOwner ? '' : (!userProfile?.is_company ? applyBtn : '')}
          ${!isOwner ? `<button class="btn-report" onclick="openReportModal('${j.id}','${j.title.replace(/'/g,"\\'")}')" title="Denunciar vaga">🚩</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

/* =========================================================
   CANDIDATURA — abre modal com abas (preencher ou PDF)
   ========================================================= */
let applyJobId = null;
let applyJobTitle = '';
let selectedPdfFile = null;
let applyMode = 'form'; // 'form' ou 'pdf'

function applyToJob(jobId, btn) {
  if (!currentUser)            return showToast('⚠️ Faça login para se candidatar.', 'error');
  if (userProfile?.is_company) return showToast('⚠️ Empresas não podem se candidatar.', 'error');
  if (myApplications.has(jobId)) {
    btn.textContent = '✓ Inscrito'; btn.disabled = true; btn.classList.add('btn-applied');
    return;
  }
  applyJobId = jobId;
  applyJobTitle = btn.closest('.job-card')?.querySelector('.job-title')?.textContent || 'Vaga';
  document.getElementById('apply-job-title').textContent = applyJobTitle;

  // Reseta o formulário
  ['cv-summary','cv-experience','cv-education','cv-skills','cv-salary'].forEach(id => document.getElementById(id).value = '');
  selectedPdfFile = null;
  document.getElementById('cv-pdf-file').value = '';
  document.getElementById('pdf-upload-text').textContent = 'Clique para selecionar seu currículo em PDF';
  document.getElementById('pdf-drop').classList.remove('has-file');
  switchApplyTab('apply-form', document.querySelectorAll('.apply-tab')[0]);

  document.getElementById('apply-overlay').classList.add('open');
}

function closeApplyModal() {
  document.getElementById('apply-overlay').classList.remove('open');
  applyJobId = null; selectedPdfFile = null;
}

function switchApplyTab(tabId, btn) {
  applyMode = tabId === 'apply-pdf' ? 'pdf' : 'form';
  document.querySelectorAll('.apply-tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.apply-tab').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  btn.classList.add('active');
}

function onPdfSelected(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.type !== 'application/pdf') { showToast('⚠️ Selecione um arquivo PDF.', 'error'); input.value = ''; return; }
  if (file.size > 5 * 1024 * 1024)     { showToast('⚠️ Arquivo muito grande. Máximo 5 MB.', 'error'); input.value = ''; return; }
  selectedPdfFile = file;
  document.getElementById('pdf-upload-text').textContent = '✓ ' + file.name;
  document.getElementById('pdf-drop').classList.add('has-file');
}

async function submitApplication() {
  if (!applyJobId) return;
  const btn = document.getElementById('btn-submit-apply');

  let cvText = null;
  let cvPdfUrl = null;

  if (applyMode === 'form') {
    const summary    = document.getElementById('cv-summary').value.trim();
    const experience = document.getElementById('cv-experience').value.trim();
    const education  = document.getElementById('cv-education').value.trim();
    const skills     = document.getElementById('cv-skills').value.trim();
    const salary     = document.getElementById('cv-salary').value;

    if (!summary && !experience && !education) {
      return showToast('⚠️ Preencha pelo menos resumo, experiência ou formação.', 'error');
    }
    // Monta o currículo como texto estruturado (JSON)
    cvText = JSON.stringify({ summary, experience, education, skills, salary: salary || null });
  } else {
    if (!selectedPdfFile) return showToast('⚠️ Selecione um arquivo PDF.', 'error');
  }

  btn.disabled = true; btn.textContent = 'Enviando...';

  // Se for PDF, faz upload no Storage primeiro
  if (applyMode === 'pdf' && selectedPdfFile) {
    btn.textContent = '📤 Enviando PDF...';
    const ext = 'pdf';
    const path = `${currentUser.id}/${applyJobId}-${Date.now()}.${ext}`;
    const { error: upErr } = await sb.storage.from('curriculos').upload(path, selectedPdfFile, {
      contentType: 'application/pdf', upsert: true
    });
    if (upErr) {
      btn.disabled = false; btn.textContent = 'Enviar Candidatura →';
      return showToast('❌ Erro ao enviar PDF: ' + upErr.message, 'error');
    }
    const { data: urlData } = sb.storage.from('curriculos').getPublicUrl(path);
    cvPdfUrl = urlData.publicUrl;
  }

  // Salva a candidatura
  const { error } = await sb.from('applications').insert([{
    job_id:          applyJobId,
    candidate_id:    currentUser.id,
    candidate_name:  userProfile?.full_name || currentUser.email,
    candidate_email: currentUser.email,
    cv_text:         cvText,
    cv_pdf_url:      cvPdfUrl,
    status:          'enviada',
  }]);

  btn.disabled = false; btn.textContent = 'Enviar Candidatura →';

  if (error) {
    if (error.code === '23505') {
      myApplications.add(applyJobId);
      showToast('Você já se candidatou a esta vaga!');
      closeApplyModal();
      filterJobs();
    } else if (error.message?.includes('cv_text') || error.message?.includes('cv_pdf_url') || error.message?.includes('status')) {
      // Colunas novas ainda não existem no banco — salva sem elas
      const { error: err2 } = await sb.from('applications').insert([{
        job_id: applyJobId, candidate_id: currentUser.id,
        candidate_name: userProfile?.full_name || currentUser.email,
        candidate_email: currentUser.email,
      }]);
      if (err2 && err2.code !== '23505') return showToast('❌ ' + err2.message, 'error');
      myApplications.add(applyJobId);
      showToast('✅ Candidatura enviada! (rode o SQL p/ habilitar currículos)', 'success');
      closeApplyModal(); filterJobs();
    } else {
      showToast('❌ Erro ao se candidatar: ' + error.message, 'error');
    }
    return;
  }

  myApplications.add(applyJobId);
  showToast('✅ Candidatura enviada com sucesso!', 'success');
  const statEl = document.getElementById('stat-applications');
  if (statEl) statEl.textContent = myApplications.size;
  closeApplyModal();
  filterJobs();
}


/* =========================================================
   DENÚNCIAS
   ========================================================= */
let reportJobId    = null;
let reportJobTitle = '';

function openReportModal(jobId, jobTitle) {
  if (!currentUser) return showToast('⚠️ Faça login para denunciar.', 'error');
  reportJobId    = jobId;
  reportJobTitle = jobTitle;
  document.getElementById('report-job-title').textContent = jobTitle;
  document.getElementById('report-reason').value  = '';
  document.getElementById('report-detail').value  = '';
  document.getElementById('report-overlay').classList.add('open');
}

function closeReportModal() {
  document.getElementById('report-overlay').classList.remove('open');
  reportJobId = null;
}

async function submitReport() {
  const reason = document.getElementById('report-reason').value;
  const detail = document.getElementById('report-detail').value.trim();
  if (!reason) return showToast('⚠️ Escolha um motivo para a denúncia.', 'error');

  const btn = document.getElementById('btn-submit-report');
  btn.disabled = true; btn.textContent = 'Enviando...';

  const { error } = await sb.from('reports').insert([{
    job_id:      reportJobId,
    reporter_id: currentUser.id,
    reason,
    detail: detail || null,
  }]);

  if (error) {
    if (error.code === '23505') {
      showToast('⚠️ Você já denunciou esta vaga.', 'error');
    } else {
      showToast('❌ Erro ao enviar: ' + error.message, 'error');
    }
    btn.disabled = false; btn.textContent = 'Enviar Denúncia';
    return;
  }

  // Conta total de denúncias da vaga
  const { count } = await sb
    .from('reports')
    .select('*', { count: 'exact', head: true })
    .eq('job_id', reportJobId);

  if (count >= 3) {
    // 3 ou mais denúncias → oculta a vaga automaticamente
    await sb.from('jobs').update({ approved: false }).eq('id', reportJobId);
    document.getElementById('job-' + reportJobId)?.remove();
    jobs = jobs.filter(j => j.id !== reportJobId);
    document.getElementById('stat-total').textContent = jobs.length;
    showToast('🚩 Vaga removida por excesso de denúncias.', 'success');
  } else {
    showToast(`✅ Denúncia enviada! (${count}/3 para remover a vaga)`, 'success');
  }

  btn.disabled = false; btn.textContent = 'Enviar Denúncia';
  closeReportModal();
}

/* =========================================================
   DELETAR VAGA (empresa dona da vaga)
   ========================================================= */
async function deleteJob(jobId, btn) {
  if (!confirm('Tem certeza que quer excluir esta vaga?')) return;
  btn.textContent = '...'; btn.disabled = true;
  const { error } = await sb.from('jobs').delete().eq('id', jobId).eq('user_id', currentUser.id);
  if (error) { showToast('❌ Erro ao excluir: ' + error.message, 'error'); btn.textContent = '🗑️'; btn.disabled = false; return; }
  document.getElementById('job-' + jobId)?.remove();
  jobs = jobs.filter(j => j.id !== jobId);
  document.getElementById('stat-total').textContent = jobs.length;
  showToast('✅ Vaga excluída.', 'success');
}

/* =========================================================
   PUBLICAR VAGA — com validação completa
   ========================================================= */
function openModal()  { document.getElementById('modal-overlay').classList.add('open'); }
function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }

async function submitJob() {
  // 1. Validar formulário
  const validation = validateJobForm();
  if (!validation.ok) return showToast(validation.msg, 'error');

  const title    = document.getElementById('m-title').value.trim();
  const company  = document.getElementById('m-company').value.trim();
  const locText  = document.getElementById('m-location').value.trim();
  const salary   = document.getElementById('m-salary').value;
  const contract = document.getElementById('m-contract').value;
  const shift    = document.getElementById('m-shift').value;
  const category = document.getElementById('m-category').value;
  const desc     = document.getElementById('m-desc').value.trim();

  const salCheck = validateSalary(salary);

  // 2. Botão de loading
  const btn = document.querySelector('#modal-overlay .btn-submit');
  btn.textContent = '🔍 Buscando endereço...'; btn.disabled = true;

  // 3. Geocoding com validação de resultado
  let lat = -22.9064, lng = -47.0616;
  let addressFound = false;
  try {
    const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locText + ', Campinas, SP, Brasil')}&limit=1`);
    const geo  = await resp.json();
    if (geo.length > 0) {
      lat = parseFloat(geo[0].lat);
      lng = parseFloat(geo[0].lon);
      addressFound = true;
    }
  } catch(e) { console.warn('Geocoding falhou', e); }

  if (!addressFound) {
    showToast('⚠️ Endereço não encontrado. Verifique o bairro e tente novamente.', 'error');
    btn.textContent = 'Publicar Vaga →'; btn.disabled = false;
    return;
  }

  btn.textContent = '📤 Publicando...';

  // 4. Salvar no banco
  const { error } = await sb.from('jobs').insert([{
    title, company, location: locText,
    salary: salCheck.val ? 'R$ ' + salCheck.val.toLocaleString('pt-BR') : 'A combinar',
    contract_type: contract, shift, category, description: desc,
    user_id: currentUser.id, lat, lng, approved: true,
  }]);

  btn.textContent = 'Publicar Vaga →'; btn.disabled = false;

  if (error) { showToast('❌ Erro ao publicar: ' + error.message, 'error'); return; }

  showToast('✅ Vaga publicada com sucesso!', 'success');
  closeModal();
  ['m-title','m-company','m-location','m-salary','m-desc'].forEach(id => document.getElementById(id).value = '');
  await fetchJobs();
}

/* =========================================================
   PERFIL + AVATAR PICKER
   ========================================================= */
function openProfileScreen() {
  renderAvatarPicker();
  if (userProfile) {
    document.getElementById('p-name').value  = userProfile.full_name || '';
    document.getElementById('p-type').value  = userProfile.is_company ? 'true' : 'false';
    document.getElementById('p-type-display').textContent = userProfile.is_company ? '🏢 Empresa / Recrutador' : '🙋 Candidato';
    const avatarId = userProfile.avatar_id || '1';
    document.getElementById('p-avatar').value = avatarId;
    const photoUrl = userProfile.photo_url || '';
    document.getElementById('p-photo-url').value = photoUrl;
    if (photoUrl) {
      document.getElementById('avatar-current-preview').innerHTML = `<img src="${photoUrl}" alt="foto">`;
    } else {
      updateAvatarPreview(avatarId);
    }
  }
  renderProfileApplications();
  loadMyRating();
  showScreen('profile');
}

async function loadMyRating() {
  const field = document.getElementById('p-rating-field');
  const display = document.getElementById('p-rating-display');
  const r = await getUserRating(currentUser.id);
  if (!r) {
    field.style.display = 'block';
    display.innerHTML = `<span class="rating-none">Você ainda não recebeu avaliações.</span>`;
    return;
  }
  field.style.display = 'block';
  display.innerHTML = `${renderStars(parseFloat(r.avg))} <span class="rating-value">${r.avg}</span> <span class="rating-count">(${r.count} avaliação${r.count !== 1 ? 'ões' : ''})</span>`;
}

function renderAvatarPicker() {
  const grid      = document.getElementById('avatar-grid');
  const currentId = document.getElementById('p-avatar').value || '1';
  grid.innerHTML  = AVATARS.map(a => `
    <div class="avatar-option ${a.id===currentId?'selected':''}" onclick="selectAvatar('${a.id}')">
      <img src="${a.url}" alt="avatar ${a.id}" loading="lazy">
    </div>
  `).join('');
}

function selectAvatar(id) {
  document.getElementById('p-avatar').value = id;
  // Escolher um avatar limpa a foto enviada
  document.getElementById('p-photo-url').value = '';
  document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('.avatar-option').forEach(el => {
    if (el.getAttribute('onclick')?.includes(`'${id}'`)) el.classList.add('selected');
  });
  updateAvatarPreview(id);
}

function updateAvatarPreview(id) {
  const url = AVATARS.find(a => a.id === id)?.url || AVATARS[0].url;
  document.getElementById('avatar-current-preview').innerHTML = `<img src="${url}" alt="preview">`;
}

async function onPhotoSelected(input) {
  const file = input.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('⚠️ Selecione uma imagem.', 'error'); input.value=''; return; }
  if (file.size > 3 * 1024 * 1024)     { showToast('⚠️ Imagem muito grande. Máximo 3 MB.', 'error'); input.value=''; return; }

  showToast('📤 Enviando foto...');
  const ext  = file.name.split('.').pop().toLowerCase();
  const path = `${currentUser.id}/avatar-${Date.now()}.${ext}`;

  const { error } = await sb.storage.from('avatares').upload(path, file, { contentType: file.type, upsert: true });
  if (error) {
    // Se o bucket não existir, avisa
    if (error.message?.includes('not found') || error.message?.includes('Bucket')) {
      showToast('⚠️ Crie o bucket "avatares" no Supabase (Storage).', 'error');
    } else {
      showToast('❌ Erro ao enviar foto: ' + error.message, 'error');
    }
    return;
  }
  const { data: urlData } = sb.storage.from('avatares').getPublicUrl(path);
  const photoUrl = urlData.publicUrl;

  document.getElementById('p-photo-url').value = photoUrl;
  document.getElementById('avatar-current-preview').innerHTML = `<img src="${photoUrl}" alt="foto">`;
  // limpa seleção de avatar
  document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
  showToast('✅ Foto carregada! Clique em Salvar para confirmar.', 'success');
}


async function renderProfileApplications() {
  const section = document.getElementById('profile-apps-section');
  const el = document.getElementById('profile-applications');
  if (!el || !section) return;

  // Esconde seção para empresas
  if (userProfile?.is_company) { section.style.display = 'none'; return; }
  section.style.display = 'block';

  const { data, error } = await sb
    .from('applications')
    .select('id, applied_at, status, jobs(title, company, location, user_id)')
    .eq('candidate_id', currentUser.id)
    .order('applied_at', { ascending: false });

  if (error || !data || data.length === 0) {
    el.innerHTML = '<p class="no-apps">Você ainda não se candidatou a nenhuma vaga.</p>';
    return;
  }

  // Atualiza o contador no stat card
  const statEl = document.getElementById('stat-applications');
  if (statEl) statEl.textContent = data.length;

  const statusMap = {
    enviada:     { label: '📩 Enviada',     cls: 'st-sent' },
    visualizada: { label: '👀 Visualizada', cls: 'st-viewed' },
    aprovada:    { label: '✅ Aprovada',    cls: 'st-approved' },
    recusada:    { label: '❌ Recusada',    cls: 'st-rejected' },
  };

  // Descobre quais já foram avaliadas
  const { data: myRatings } = await sb.from('ratings')
    .select('application_id').eq('from_user_id', currentUser.id).eq('rating_type', 'empresa');
  const ratedSet = new Set((myRatings || []).map(r => r.application_id));

  el.innerHTML = data.map(a => {
    const date = new Date(a.applied_at).toLocaleDateString('pt-BR');
    const title   = a.jobs?.title    || 'Vaga removida';
    const company = a.jobs?.company  || '';
    const loc     = a.jobs?.location || '';
    const st = statusMap[a.status] || statusMap.enviada;

    // Botão de avaliar empresa: só se aprovada e ainda não avaliou
    let rateBtn = '';
    let chatBtn = '';
    if (a.status === 'aprovada' && a.jobs?.user_id) {
      rateBtn = ratedSet.has(a.id)
        ? `<span class="rated-badge">⭐ Avaliada</span>`
        : `<button class="btn-rate" onclick="openRatingModal('${a.id}','${a.jobs.user_id}','empresa','${(company||'Empresa').replace(/'/g,"\\'")}')">⭐ Avaliar empresa</button>`;
      chatBtn = `<button class="btn-chat" onclick="openChat('${a.id}','${(company||'Empresa').replace(/'/g,"\\'")}','${(title||'').replace(/'/g,"\\'")}')">💬 Conversar</button>`;
    }

    return `
    <div class="app-item">
      <div class="app-info">
        <span class="app-title">${title}</span>
        <span class="app-company">${company}${company && loc ? ' • ' : ''}${loc}</span>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px;">
          <span class="app-status ${st.cls}">${st.label}</span>
          ${chatBtn}
          ${rateBtn}
        </div>
      </div>
      <span class="app-date">${date}</span>
    </div>`;
  }).join('');
}

async function saveProfile() {
  const isCompany = document.getElementById('p-type').value === 'true';
  const name      = document.getElementById('p-name').value.trim();
  const avatarId  = document.getElementById('p-avatar').value || '1';
  const photoUrl  = document.getElementById('p-photo-url').value || null;

  if (!name || name.length < 2) return showToast('⚠️ Informe seu nome completo.', 'error');

  const btn = document.querySelector('#profile .btn-submit');
  btn.textContent = 'Salvando...'; btn.disabled = true;

  const { error } = await sb.from('profiles').upsert({
    id: currentUser.id, full_name: name, is_company: isCompany, avatar_id: avatarId, photo_url: photoUrl
  });

  btn.textContent = 'Salvar Alterações'; btn.disabled = false;

  if (error) {
    if (error.message?.includes('photo_url') || error.message?.includes('avatar_id') || error.code === '42703') {
      const { error: err2 } = await sb.from('profiles').upsert({ id: currentUser.id, full_name: name, is_company: isCompany });
      if (err2) return showToast('❌ ' + err2.message, 'error');
      showToast('✅ Perfil salvo! Rode o SQL no Supabase para habilitar foto/avatares.');
    } else {
      return showToast('❌ Erro: ' + error.message, 'error');
    }
  } else {
    showToast('✅ Perfil atualizado com sucesso!', 'success');
  }
  enterDashboard(currentUser);
}

/* =========================================================
   DASHBOARD DA EMPRESA
   ========================================================= */
function openCompanyDashboard() {
  // Sincroniza avatar e nome na topbar da empresa
  const avatarId  = userProfile?.avatar_id || '1';
  const avatarUrl = userProfile?.photo_url || AVATARS.find(a => a.id === avatarId)?.url || AVATARS[0].url;
  document.getElementById('company-avatar').innerHTML = `<img src="${avatarUrl}" alt="avatar">`;
  document.getElementById('company-name-display').textContent = (userProfile?.full_name || 'Empresa').split(' ')[0];

  showScreen('company-dashboard');
  loadCompanyJobs();
}

async function loadCompanyJobs() {
  const { data: myJobs, error } = await sb
    .from('jobs')
    .select('id, title, company, location, salary, contract_type, shift, category, posted_at')
    .eq('user_id', currentUser.id)
    .eq('approved', true)
    .order('posted_at', { ascending: false });

  if (error) { showToast('❌ Erro ao carregar vagas.', 'error'); return; }

  // Atualiza stat
  document.getElementById('co-stat-jobs').textContent = myJobs?.length || 0;

  // Monta o select de filtro de candidatos
  const sel = document.getElementById('co-filter-job');
  sel.innerHTML = '<option value="">— Selecione uma vaga —</option>' +
    (myJobs || []).map(j => `<option value="${j.id}">${j.title} (${j.location || 'Campinas'})</option>`).join('');

  const listEl = document.getElementById('company-jobs-list');
  if (!myJobs || myJobs.length === 0) {
    listEl.innerHTML = `
      <div class="jobs-empty">
        <span>📋</span>
        <p>Você ainda não publicou nenhuma vaga.</p>
      </div>`;
    return;
  }

  // Para cada vaga, busca a contagem de candidatos
  const jobIds = myJobs.map(j => j.id);
  const { data: appCounts } = await sb
    .from('applications')
    .select('job_id')
    .in('job_id', jobIds);

  // Monta mapa jobId -> count
  const countMap = {};
  (appCounts || []).forEach(a => {
    countMap[a.job_id] = (countMap[a.job_id] || 0) + 1;
  });

  // Atualiza stat total de candidatos
  const totalCandidates = Object.values(countMap).reduce((s, n) => s + n, 0);
  document.getElementById('co-stat-candidates').textContent = totalCandidates;

  listEl.innerHTML = myJobs.map(j => {
    const count = countMap[j.id] || 0;
    const date  = new Date(j.posted_at).toLocaleDateString('pt-BR');
    return `
    <div class="co-job-card" id="co-job-${j.id}">
      <div class="co-job-card-header">
        <div>
          <div class="co-job-title">${j.title}</div>
          <div class="co-job-meta">${j.company || ''} • ${j.location || 'Campinas'} • ${j.salary || 'A combinar'}</div>
          <div class="job-tags" style="margin-top:6px;">
            ${j.contract_type ? `<span class="tag tag-green">${j.contract_type}</span>` : ''}
            ${j.shift ? `<span class="tag tag-gray">${j.shift}</span>` : ''}
            ${j.category ? `<span class="tag">${j.category}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="co-job-footer">
        <span style="font-size:12px;color:var(--text-muted);">📅 Publicada em ${date}</span>
        <div class="co-job-actions">
          <button class="btn-co-candidates" onclick="viewCandidatesForJob('${j.id}', '${j.title.replace(/'/g,"\\'")}')">
            👥 ${count} candidato${count !== 1 ? 's' : ''}
          </button>
          <button class="btn-co-edit" onclick="openEditJob('${j.id}')">✏️ Editar</button>
          <button class="btn-co-delete" onclick="deleteCompanyJob('${j.id}')">🗑️ Excluir</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function viewCandidatesForJob(jobId, jobTitle) {
  // Muda para aba candidatos e filtra pela vaga
  switchTab('tab-candidates', document.querySelectorAll('.co-tab')[1]);
  document.getElementById('co-filter-job').value = jobId;
  loadCandidatesForJob();
}

async function loadCandidatesForJob() {
  const jobId = document.getElementById('co-filter-job').value;
  const el = document.getElementById('company-candidates-list');

  if (!jobId) {
    el.innerHTML = '<p class="no-apps" style="text-align:center;padding:32px">Selecione uma vaga para ver os candidatos.</p>';
    return;
  }

  el.innerHTML = '<p class="no-apps" style="text-align:center;padding:24px">Carregando...</p>';

  const { data, error } = await sb
    .from('applications')
    .select('id, candidate_id, candidate_name, candidate_email, applied_at, cv_text, cv_pdf_url, status')
    .eq('job_id', jobId)
    .order('applied_at', { ascending: false });

  if (error) {
    // Fallback se colunas novas não existirem
    const { data: basic } = await sb.from('applications')
      .select('id, candidate_name, candidate_email, applied_at')
      .eq('job_id', jobId).order('applied_at', { ascending: false });
    if (!basic || basic.length === 0) {
      el.innerHTML = '<p class="no-apps" style="text-align:center;padding:32px">Nenhum candidato ainda para esta vaga.</p>';
      return;
    }
    el.innerHTML = basic.map(c => renderCandidateCard(c)).join('');
    return;
  }

  if (!data || data.length === 0) {
    el.innerHTML = '<p class="no-apps" style="text-align:center;padding:32px">Nenhum candidato ainda para esta vaga.</p>';
    return;
  }

  // Descobre quais candidatos a empresa já avaliou
  const { data: coRatings } = await sb.from('ratings')
    .select('application_id').eq('from_user_id', currentUser.id).eq('rating_type', 'candidato');
  window._ratedCandidates = new Set((coRatings || []).map(r => r.application_id));

  // Marca como "visualizada" as que estavam só "enviada"
  const toView = data.filter(c => c.status === 'enviada').map(c => c.id);
  if (toView.length) {
    await sb.from('applications').update({ status: 'visualizada' }).in('id', toView);
    data.forEach(c => { if (c.status === 'enviada') c.status = 'visualizada'; });
  }

  el.innerHTML = data.map(c => renderCandidateCard(c)).join('');
}

const STATUS_INFO = {
  enviada:     { label: '📩 Enviada',     cls: 'st-sent' },
  visualizada: { label: '👀 Visualizada', cls: 'st-viewed' },
  aprovada:    { label: '✅ Aprovada',    cls: 'st-approved' },
  recusada:    { label: '❌ Recusada',    cls: 'st-rejected' },
};

function renderCandidateCard(c) {
  const initials = (c.candidate_name || 'U').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
  const date = new Date(c.applied_at).toLocaleDateString('pt-BR');
  const status = c.status || 'enviada';
  const st = STATUS_INFO[status] || STATUS_INFO.enviada;

  // Botão de currículo
  let cvBtn = '';
  if (c.cv_pdf_url) {
    cvBtn = `<a class="btn-cv-view" href="${c.cv_pdf_url}" target="_blank" rel="noopener">📄 Ver PDF</a>`;
  } else if (c.cv_text) {
    cvBtn = `<button class="btn-cv-view" onclick='viewCvText(${JSON.stringify(c.cv_text)}, "${(c.candidate_name||"Candidato").replace(/"/g,"")}")'>📝 Ver currículo</button>`;
  }

  // Botões de ação (só se ainda não decidiu)
  let actionBtns = '';
  if (status !== 'aprovada' && status !== 'recusada') {
    actionBtns = `
      <button class="btn-cand-accept" onclick="setApplicationStatus('${c.id}','aprovada',this)">✅ Aprovar</button>
      <button class="btn-cand-reject" onclick="setApplicationStatus('${c.id}','recusada',this)">❌ Recusar</button>`;
  }

  // Botão avaliar candidato: só quando aprovado e ainda não avaliou
  let rateBtn = '';
  let chatBtn = '';
  if (status === 'aprovada' && c.candidate_id) {
    const alreadyRated = window._ratedCandidates && window._ratedCandidates.has(c.id);
    rateBtn = alreadyRated
      ? `<span class="rated-badge">⭐ Avaliado</span>`
      : `<button class="btn-rate" onclick="openRatingModal('${c.id}','${c.candidate_id}','candidato','${(c.candidate_name||'Candidato').replace(/'/g,"\\'")}')">⭐ Avaliar</button>`;
    chatBtn = `<button class="btn-chat" onclick="openChat('${c.id}','${(c.candidate_name||'Candidato').replace(/'/g,"\\'")}','Candidatura')">💬 Conversar</button>`;
  }

  return `
  <div class="candidate-card-full" id="cand-${c.id}">
    <div class="candidate-top">
      <div class="candidate-avatar">${initials}</div>
      <div class="candidate-info">
        <div class="candidate-name">${c.candidate_name || 'Candidato'}</div>
        <div class="candidate-email">${c.candidate_email || ''}</div>
      </div>
      <div style="text-align:right;">
        <span class="candidate-status ${st.cls}">${st.label}</span>
        <div class="candidate-date">${date}</div>
      </div>
    </div>
    <div class="candidate-actions">
      ${cvBtn}
      ${actionBtns}
      ${chatBtn}
      ${rateBtn}
    </div>
  </div>`;
}

function viewCvText(cvJson, name) {
  let cv;
  try { cv = JSON.parse(cvJson); } catch { cv = {}; }
  const body = `
    <h3 style="margin-bottom:4px;">📝 Currículo</h3>
    <p class="modal-subtitle" style="color:var(--primary);font-weight:700;">${name}</p>
    ${cv.summary    ? `<div class="cv-block"><strong>Resumo</strong><p>${cv.summary}</p></div>` : ''}
    ${cv.experience ? `<div class="cv-block"><strong>Experiência</strong><p>${cv.experience}</p></div>` : ''}
    ${cv.education  ? `<div class="cv-block"><strong>Formação</strong><p>${cv.education}</p></div>` : ''}
    ${cv.skills     ? `<div class="cv-block"><strong>Habilidades</strong><p>${cv.skills}</p></div>` : ''}
    ${cv.salary     ? `<div class="cv-block"><strong>Pretensão salarial</strong><p>R$ ${Number(cv.salary).toLocaleString('pt-BR')}</p></div>` : ''}
    <button class="btn-close-modal" onclick="document.getElementById('cv-view-overlay').classList.remove('open')" style="margin-top:16px;">Fechar</button>
  `;
  document.getElementById('cv-view-body').innerHTML = body;
  document.getElementById('cv-view-overlay').classList.add('open');
}

async function setApplicationStatus(appId, status, btn) {
  btn.disabled = true;
  const { error } = await sb.from('applications').update({ status }).eq('id', appId);
  if (error) { btn.disabled = false; return showToast('❌ Erro: ' + error.message, 'error'); }

  // Atualiza visualmente o card
  const card = document.getElementById('cand-' + appId);
  const st = STATUS_INFO[status];
  const badge = card.querySelector('.candidate-status');
  badge.className = 'candidate-status ' + st.cls;
  badge.textContent = st.label;
  // Remove os botões de ação
  card.querySelectorAll('.btn-cand-accept, .btn-cand-reject').forEach(b => b.remove());
  showToast(status === 'aprovada' ? '✅ Candidato aprovado!' : '❌ Candidato recusado.', 'success');
  // Se aprovou, recarrega para mostrar o botão de avaliar
  if (status === 'aprovada') setTimeout(() => loadCandidatesForJob(), 600);
}

async function deleteCompanyJob(jobId) {
  if (!confirm('Tem certeza que quer excluir esta vaga? Os candidatos serão removidos.')) return;
  const { error } = await sb.from('jobs').delete().eq('id', jobId).eq('user_id', currentUser.id);
  if (error) { showToast('❌ Erro ao excluir: ' + error.message, 'error'); return; }
  document.getElementById('co-job-' + jobId)?.remove();
  showToast('✅ Vaga excluída.', 'success');
  // Atualiza contadores
  const remaining = document.querySelectorAll('.co-job-card').length;
  document.getElementById('co-stat-jobs').textContent = remaining;
}

/* ===== EDITAR VAGA ===== */
async function openEditJob(jobId) {
  const { data: j, error } = await sb.from('jobs').select('*').eq('id', jobId).single();
  if (error || !j) { showToast('❌ Erro ao carregar a vaga.', 'error'); return; }
  document.getElementById('e-id').value       = j.id;
  document.getElementById('e-title').value    = j.title || '';
  document.getElementById('e-company').value  = j.company || '';
  document.getElementById('e-location').value = j.location || '';
  document.getElementById('e-salary').value   = (j.salary || '').replace(/[^\d]/g, '') || '';
  document.getElementById('e-contract').value = j.contract_type || 'CLT';
  document.getElementById('e-shift').value    = j.shift || 'Integral';
  document.getElementById('e-category').value = j.category || 'Comércio';
  document.getElementById('e-desc').value     = j.description || '';
  document.getElementById('edit-overlay').classList.add('open');
}

function closeEditModal() {
  document.getElementById('edit-overlay').classList.remove('open');
}

async function saveJobEdit() {
  const id       = document.getElementById('e-id').value;
  const title    = document.getElementById('e-title').value.trim();
  const company  = document.getElementById('e-company').value.trim();
  const locText  = document.getElementById('e-location').value.trim();
  const salary   = document.getElementById('e-salary').value;
  const contract = document.getElementById('e-contract').value;
  const shift    = document.getElementById('e-shift').value;
  const category = document.getElementById('e-category').value;
  const desc     = document.getElementById('e-desc').value.trim();

  if (!title || title.length < 3) return showToast('⚠️ Informe o cargo (mínimo 3 letras).', 'error');
  if (!company) return showToast('⚠️ Informe o nome da empresa.', 'error');
  if (!locText || locText.length < 3) return showToast('⚠️ Informe o bairro.', 'error');
  if (!desc || desc.length < 20) return showToast('⚠️ Descrição muito curta (mínimo 20 caracteres).', 'error');

  const btn = document.querySelector('#edit-overlay .btn-submit');
  btn.disabled = true; btn.textContent = '🔍 Atualizando endereço...';

  // Re-geocoda o endereço (caso o bairro tenha mudado)
  let lat = null, lng = null;
  try {
    const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locText + ', Campinas, SP, Brasil')}&limit=1`);
    const geo  = await resp.json();
    if (geo.length > 0) { lat = parseFloat(geo[0].lat); lng = parseFloat(geo[0].lon); }
  } catch(e) { console.warn('Geocoding falhou', e); }

  btn.textContent = '💾 Salvando...';

  const update = {
    title, company, location: locText,
    salary: salary ? 'R$ ' + Number(salary).toLocaleString('pt-BR') : 'A combinar',
    contract_type: contract, shift, category, description: desc,
  };
  if (lat && lng) { update.lat = lat; update.lng = lng; }

  const { error } = await sb.from('jobs').update(update).eq('id', id).eq('user_id', currentUser.id);
  btn.disabled = false; btn.textContent = 'Salvar Alterações →';

  if (error) { showToast('❌ Erro ao salvar: ' + error.message, 'error'); return; }
  showToast('✅ Vaga atualizada com sucesso!', 'success');
  closeEditModal();
  await loadCompanyJobs();
  await fetchJobs();
}

async function submitJobFromDashboard() {
  const title    = document.getElementById('co-title').value.trim();
  const company  = document.getElementById('co-company').value.trim();
  const locText  = document.getElementById('co-location').value.trim();
  const salary   = document.getElementById('co-salary').value;
  const contract = document.getElementById('co-contract').value;
  const shift    = document.getElementById('co-shift').value;
  const category = document.getElementById('co-category').value;
  const desc     = document.getElementById('co-desc').value.trim();

  if (!title || title.length < 3) return showToast('⚠️ Informe o cargo (mínimo 3 letras).', 'error');
  if (!company) return showToast('⚠️ Informe o nome da empresa.', 'error');
  if (!locText || locText.length < 3) return showToast('⚠️ Informe o bairro.', 'error');
  if (!desc || desc.length < 20) return showToast('⚠️ Descrição muito curta. Mínimo 20 caracteres.', 'error');

  const salCheck = validateSalary(salary);
  if (!salCheck.ok) return showToast(salCheck.msg, 'error');

  const btn = document.querySelector('#tab-new .btn-submit');
  btn.textContent = '🔍 Buscando endereço...'; btn.disabled = true;

  let lat = -22.9064, lng = -47.0616;
  try {
    const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locText + ', Campinas, SP, Brasil')}&limit=1`);
    const geo  = await resp.json();
    if (geo.length > 0) { lat = parseFloat(geo[0].lat); lng = parseFloat(geo[0].lon); }
    else { showToast('⚠️ Endereço não encontrado. Verifique o bairro.', 'error'); btn.textContent = 'Publicar Vaga →'; btn.disabled = false; return; }
  } catch(e) { console.warn('Geocoding falhou', e); }

  btn.textContent = '📤 Publicando...';

  const { error } = await sb.from('jobs').insert([{
    title, company, location: locText,
    salary: salCheck.val ? 'R$ ' + salCheck.val.toLocaleString('pt-BR') : 'A combinar',
    contract_type: contract, shift, category, description: desc,
    user_id: currentUser.id, lat, lng, approved: true,
  }]);

  btn.textContent = 'Publicar Vaga →'; btn.disabled = false;

  if (error) { showToast('❌ Erro: ' + error.message, 'error'); return; }

  showToast('✅ Vaga publicada com sucesso!', 'success');
  ['co-title','co-company','co-location','co-salary','co-desc'].forEach(id => document.getElementById(id).value = '');

  // Volta para aba de vagas e recarrega
  switchTab('tab-jobs', document.querySelectorAll('.co-tab')[0]);
  await loadCompanyJobs();
}

function switchTab(tabId, btn) {
  document.querySelectorAll('.co-tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.co-tab').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  btn.classList.add('active');
}

/* =========================================================
   SISTEMA DE AVALIAÇÕES
   ========================================================= */
let ratingAppId    = null;   // id da candidatura
let ratingToUserId = null;   // quem está sendo avaliado
let ratingType     = null;   // 'empresa' ou 'candidato'

function openRatingModal(appId, toUserId, type, targetName) {
  ratingAppId    = appId;
  ratingToUserId = toUserId;
  ratingType     = type;
  document.getElementById('rating-target-name').textContent = targetName;
  document.getElementById('rating-question').textContent =
    type === 'empresa' ? 'Como foi sua experiência com a empresa?' : 'Como foi sua experiência com o candidato?';
  document.getElementById('rating-comment').value = '';
  // limpa estrelas selecionadas
  document.querySelectorAll('#star-rating input').forEach(i => i.checked = false);
  document.getElementById('rating-overlay').classList.add('open');
}

function closeRatingModal() {
  document.getElementById('rating-overlay').classList.remove('open');
  ratingAppId = null; ratingToUserId = null; ratingType = null;
}

async function submitRating() {
  const checked = document.querySelector('#star-rating input:checked');
  if (!checked) return showToast('⚠️ Escolha de 1 a 5 estrelas.', 'error');
  const stars = parseInt(checked.value);
  const comment = document.getElementById('rating-comment').value.trim();

  const btn = document.getElementById('btn-submit-rating');
  btn.disabled = true; btn.textContent = 'Enviando...';

  const { error } = await sb.from('ratings').insert([{
    application_id: ratingAppId,
    from_user_id:   currentUser.id,
    to_user_id:     ratingToUserId,
    rating_type:    ratingType,
    stars,
    comment: comment || null,
  }]);

  btn.disabled = false; btn.textContent = 'Enviar Avaliação →';

  if (error) {
    if (error.code === '23505') {
      showToast('⚠️ Você já avaliou.', 'error');
    } else {
      showToast('❌ Erro ao avaliar: ' + error.message, 'error');
    }
    return;
  }

  showToast('✅ Avaliação enviada! Obrigado.', 'success');
  closeRatingModal();

  // Recarrega a tela atual
  if (ratingType === 'empresa') renderProfileApplications();
  else loadCandidatesForJob();
}

// Busca a média de estrelas de um usuário
async function getUserRating(userId) {
  const { data } = await sb.from('ratings').select('stars').eq('to_user_id', userId);
  if (!data || data.length === 0) return null;
  const avg = data.reduce((s, r) => s + r.stars, 0) / data.length;
  return { avg: avg.toFixed(1), count: data.length };
}

// Verifica se já avaliou uma candidatura
async function hasRated(appId, type) {
  const { data } = await sb.from('ratings')
    .select('id').eq('application_id', appId)
    .eq('from_user_id', currentUser.id).eq('rating_type', type);
  return data && data.length > 0;
}

// Gera HTML de estrelinhas para exibição (média)
function renderStars(avg) {
  const full = Math.round(avg);
  let html = '<span class="stars-display">';
  for (let i = 1; i <= 5; i++) {
    html += `<span class="star-icon ${i <= full ? 'filled' : ''}">★</span>`;
  }
  html += `</span>`;
  return html;
}

/* =========================================================
   CHAT EM TEMPO REAL
   ========================================================= */
let chatAppId = null;
let chatChannel = null;
let chatOtherName = '';

async function openChat(appId, otherName, jobTitle) {
  chatAppId = appId;
  chatOtherName = otherName;
  document.getElementById('chat-title').textContent = otherName;
  document.getElementById('chat-subtitle').textContent = jobTitle || 'Conversa';
  document.getElementById('chat-avatar').textContent =
    (otherName || 'U').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
  document.getElementById('chat-messages').innerHTML = '<p class="chat-empty">Carregando mensagens...</p>';
  document.getElementById('chat-input').value = '';
  document.getElementById('chat-overlay').classList.add('open');

  await loadChatMessages();
  subscribeToChat();
}

function closeChat() {
  document.getElementById('chat-overlay').classList.remove('open');
  if (chatChannel) { sb.removeChannel(chatChannel); chatChannel = null; }
  chatAppId = null;
}

async function loadChatMessages() {
  const { data, error } = await sb
    .from('messages')
    .select('*')
    .eq('application_id', chatAppId)
    .order('created_at', { ascending: true });

  const el = document.getElementById('chat-messages');
  if (error) { el.innerHTML = '<p class="chat-empty">Erro ao carregar mensagens.</p>'; return; }

  if (!data || data.length === 0) {
    el.innerHTML = '<p class="chat-empty">💬 Nenhuma mensagem ainda.<br>Diga olá!</p>';
    return;
  }
  el.innerHTML = data.map(m => renderMessage(m)).join('');
  scrollChatToBottom();
}

function renderMessage(m) {
  const mine = m.sender_id === currentUser.id;
  const time = new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `
  <div class="chat-msg ${mine ? 'mine' : 'theirs'}">
    <div class="chat-bubble">${escapeHtml(m.content)}</div>
    <span class="chat-time">${time}</span>
  </div>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function scrollChatToBottom() {
  const el = document.getElementById('chat-messages');
  el.scrollTop = el.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const content = input.value.trim();
  if (!content || !chatAppId) return;
  input.value = '';

  const { error } = await sb.from('messages').insert([{
    application_id: chatAppId,
    sender_id: currentUser.id,
    content,
  }]);

  if (error) { showToast('❌ Erro ao enviar mensagem.', 'error'); input.value = content; return; }
  // a mensagem aparece via realtime; mas adicionamos local caso o realtime demore
}

function subscribeToChat() {
  if (chatChannel) sb.removeChannel(chatChannel);
  chatChannel = sb
    .channel('chat-' + chatAppId)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `application_id=eq.${chatAppId}`,
    }, payload => {
      const el = document.getElementById('chat-messages');
      // remove o "nenhuma mensagem" se existir
      const empty = el.querySelector('.chat-empty');
      if (empty) el.innerHTML = '';
      el.insertAdjacentHTML('beforeend', renderMessage(payload.new));
      scrollChatToBottom();
    })
    .subscribe();
}

/* =========================================================
   VOLTAR AO INÍCIO (clicar no logo)
   ========================================================= */
function goHome() {
  if (!currentUser) { showScreen('splash'); return; }
  // Candidato vai para o feed de vagas; empresa vai para o painel
  showScreen('dashboard');
  window.scrollTo(0, 0);
}

/* =========================================================
   PAINEL DE ADMINISTRAÇÃO
   ========================================================= */
async function openAdminDashboard() {
  if (!isAdmin()) return showToast('⛔ Acesso restrito.', 'error');
  showScreen('admin-dashboard');
  loadAdminStats();
  loadAdminReports();
}

function switchAdminTab(tabId, btn) {
  document.querySelectorAll('#admin-dashboard .co-tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#admin-dashboard .co-tab').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  btn.classList.add('active');
  // Carrega o conteúdo da aba
  if (tabId === 'adm-tab-jobs')  loadAdminJobs();
  if (tabId === 'adm-tab-users') loadAdminUsers();
}

async function loadAdminStats() {
  const [users, jobsAll, apps, reps] = await Promise.all([
    sb.from('profiles').select('*', { count: 'exact', head: true }),
    sb.from('jobs').select('*', { count: 'exact', head: true }),
    sb.from('applications').select('*', { count: 'exact', head: true }),
    sb.from('reports').select('*', { count: 'exact', head: true }),
  ]);
  document.getElementById('adm-users').textContent   = users.count  ?? 0;
  document.getElementById('adm-jobs').textContent    = jobsAll.count ?? 0;
  document.getElementById('adm-apps').textContent    = apps.count   ?? 0;
  document.getElementById('adm-reports').textContent = reps.count   ?? 0;
}

async function loadAdminReports() {
  const el = document.getElementById('admin-reports-list');
  // Agrupa denúncias por vaga
  const { data, error } = await sb
    .from('reports')
    .select('id, reason, detail, created_at, job_id, jobs(title, company, approved)')
    .order('created_at', { ascending: false });

  if (error) { el.innerHTML = '<p class="no-apps" style="text-align:center;padding:24px">Erro ao carregar denúncias.</p>'; return; }
  if (!data || data.length === 0) {
    el.innerHTML = '<p class="no-apps" style="text-align:center;padding:32px">✅ Nenhuma denúncia no sistema.</p>';
    return;
  }

  // Conta denúncias por vaga
  const byJob = {};
  data.forEach(r => {
    if (!byJob[r.job_id]) byJob[r.job_id] = { job: r.jobs, count: 0, reasons: [] };
    byJob[r.job_id].count++;
    byJob[r.job_id].reasons.push({ reason: r.reason, detail: r.detail });
  });

  const reasonLabels = {
    fake: '🚫 Vaga falsa', salary: '💸 Salário irreal', company: '🏢 Empresa inexistente',
    offensive: '😤 Ofensivo', duplicate: '🔁 Duplicada', other: '❓ Outro',
  };

  el.innerHTML = Object.entries(byJob).map(([jobId, info]) => {
    const removed = info.job && info.job.approved === false;
    const reasonsHtml = info.reasons.map(r =>
      `<li>${reasonLabels[r.reason] || r.reason}${r.detail ? ` — <em>${escapeHtml(r.detail)}</em>` : ''}</li>`
    ).join('');
    return `
    <div class="admin-report-card">
      <div class="admin-report-head">
        <div>
          <div class="admin-report-title">${info.job?.title || 'Vaga removida'}</div>
          <div class="admin-report-company">${info.job?.company || ''}</div>
        </div>
        <span class="admin-report-count">${info.count} 🚩</span>
      </div>
      <ul class="admin-report-reasons">${reasonsHtml}</ul>
      <div class="admin-report-actions">
        ${removed
          ? `<span class="admin-removed-badge">Removida do site</span>
             <button class="btn-cand-accept" onclick="adminRestoreJob('${jobId}')">↩️ Reativar vaga</button>`
          : `<button class="btn-cand-reject" onclick="adminRemoveJob('${jobId}')">🗑️ Remover vaga</button>`
        }
      </div>
    </div>`;
  }).join('');
}

async function adminRemoveJob(jobId) {
  if (!confirm('Remover esta vaga do site?')) return;
  const { error } = await sb.from('jobs').update({ approved: false }).eq('id', jobId);
  if (error) return showToast('❌ ' + error.message, 'error');
  showToast('🗑️ Vaga removida do site.', 'success');
  loadAdminReports();
}

async function adminRestoreJob(jobId) {
  const { error } = await sb.from('jobs').update({ approved: true }).eq('id', jobId);
  if (error) return showToast('❌ ' + error.message, 'error');
  showToast('↩️ Vaga reativada.', 'success');
  loadAdminReports();
}

async function loadAdminJobs() {
  const el = document.getElementById('admin-jobs-list');
  const { data, error } = await sb
    .from('jobs')
    .select('id, title, company, location, salary, approved, posted_at')
    .order('posted_at', { ascending: false });

  if (error) { el.innerHTML = '<p class="no-apps" style="text-align:center;padding:24px">Erro ao carregar vagas.</p>'; return; }
  if (!data || data.length === 0) {
    el.innerHTML = '<p class="no-apps" style="text-align:center;padding:32px">Nenhuma vaga cadastrada.</p>';
    return;
  }

  el.innerHTML = data.map(j => {
    const date = new Date(j.posted_at).toLocaleDateString('pt-BR');
    return `
    <div class="admin-job-row ${j.approved ? '' : 'inactive'}">
      <div class="admin-job-info">
        <div class="admin-job-title">${j.title} ${j.approved ? '' : '<span class="admin-removed-badge">oculta</span>'}</div>
        <div class="admin-job-meta">${j.company || ''} • ${j.location || ''} • ${j.salary || ''} • ${date}</div>
      </div>
      <div class="admin-job-actions">
        ${j.approved
          ? `<button class="btn-cand-reject" onclick="adminRemoveJob('${j.id}'); setTimeout(loadAdminJobs,500)">🗑️ Ocultar</button>`
          : `<button class="btn-cand-accept" onclick="adminRestoreJob('${j.id}'); setTimeout(loadAdminJobs,500)">↩️ Reativar</button>`
        }
        <button class="btn-cand-reject" onclick="adminDeleteJobPermanent('${j.id}')">❌ Excluir</button>
      </div>
    </div>`;
  }).join('');
}

async function adminDeleteJobPermanent(jobId) {
  if (!confirm('EXCLUIR permanentemente esta vaga e todas as candidaturas dela? Isso não pode ser desfeito.')) return;
  const { error } = await sb.from('jobs').delete().eq('id', jobId);
  if (error) return showToast('❌ ' + error.message, 'error');
  showToast('❌ Vaga excluída permanentemente.', 'success');
  loadAdminJobs();
  loadAdminStats();
}

async function loadAdminUsers() {
  const el = document.getElementById('admin-users-list');
  const { data, error } = await sb
    .from('profiles')
    .select('id, full_name, is_company, cnpj, company_legal_name, created_at')
    .order('created_at', { ascending: false });

  if (error) { el.innerHTML = '<p class="no-apps" style="text-align:center;padding:24px">Erro ao carregar usuários.</p>'; return; }
  if (!data || data.length === 0) {
    el.innerHTML = '<p class="no-apps" style="text-align:center;padding:32px">Nenhum usuário cadastrado.</p>';
    return;
  }

  el.innerHTML = data.map(u => {
    const initials = (u.full_name || 'U').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
    const typeLabel = u.is_company ? '🏢 Empresa' : '🙋 Candidato';
    const cnpjLine = u.is_company && u.cnpj
      ? `<div class="admin-user-cnpj">CNPJ: ${formatCnpjDisplay(u.cnpj)}${u.company_legal_name ? ' • ' + u.company_legal_name : ''}</div>`
      : '';
    return `
    <div class="admin-user-row">
      <div class="candidate-avatar">${initials}</div>
      <div class="admin-user-info">
        <div class="admin-user-name">${u.full_name || 'Sem nome'}</div>
        <div class="admin-user-type">${typeLabel}</div>
        ${cnpjLine}
      </div>
    </div>`;
  }).join('');
}

function formatCnpjDisplay(cnpj) {
  const d = (cnpj || '').replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}

/* =========================================================
   NOTIFICAÇÕES
   ========================================================= */
let notifications = [];

async function loadNotifications() {
  notifications = [];
  if (!currentUser) return;

  if (userProfile?.is_company) {
    // Empresa: novos candidatos nas suas vagas (últimas 24h)
    const { data: myJobs } = await sb.from('jobs').select('id, title').eq('user_id', currentUser.id);
    if (myJobs && myJobs.length) {
      const jobIds = myJobs.map(j => j.id);
      const since = new Date(Date.now() - 7*24*60*60*1000).toISOString();
      const { data: apps } = await sb.from('applications')
        .select('candidate_name, applied_at, job_id')
        .in('job_id', jobIds).gte('applied_at', since)
        .order('applied_at', { ascending: false });
      (apps || []).forEach(a => {
        const jobTitle = myJobs.find(j => j.id === a.job_id)?.title || 'sua vaga';
        notifications.push({
          icon: '👤',
          text: `<strong>${a.candidate_name || 'Alguém'}</strong> se candidatou para <strong>${jobTitle}</strong>`,
          date: a.applied_at,
        });
      });
    }
  } else {
    // Candidato: status das suas candidaturas (aprovada/recusada)
    const { data: apps } = await sb.from('applications')
      .select('status, applied_at, jobs(title, company)')
      .eq('candidate_id', currentUser.id)
      .in('status', ['aprovada', 'recusada'])
      .order('applied_at', { ascending: false });
    (apps || []).forEach(a => {
      const isApproved = a.status === 'aprovada';
      notifications.push({
        icon: isApproved ? '✅' : '❌',
        text: isApproved
          ? `Você foi <strong>aprovado</strong> em <strong>${a.jobs?.title || 'uma vaga'}</strong>! Já pode conversar com a empresa.`
          : `Sua candidatura para <strong>${a.jobs?.title || 'uma vaga'}</strong> foi recusada.`,
        date: a.applied_at,
      });
    });
  }

  // Mensagens novas no chat (para os dois tipos de usuário)
  const since7 = new Date(Date.now() - 7*24*60*60*1000).toISOString();
  const { data: msgs } = await sb.from('messages')
    .select('content, created_at, sender_id, application_id')
    .neq('sender_id', currentUser.id)
    .gte('created_at', since7)
    .order('created_at', { ascending: false })
    .limit(20);
  if (msgs && msgs.length) {
    // Agrupa por conversa, pega só a mais recente de cada
    const seen = new Set();
    for (const m of msgs) {
      if (seen.has(m.application_id)) continue;
      seen.add(m.application_id);
      notifications.push({
        icon: '💬',
        text: `Nova mensagem: "<em>${escapeHtml(m.content.substring(0, 40))}${m.content.length > 40 ? '…' : ''}</em>"`,
        date: m.created_at,
      });
    }
  }

  // Ordena por data
  notifications.sort((a, b) => new Date(b.date) - new Date(a.date));
  updateNotifBadge();
}

function updateNotifBadge() {
  const dot = document.getElementById('notif-dot');
  if (!dot) return;
  // Mostra a bolinha se houver notificações não vistas
  const lastSeen = localStorage.getItem('nj-notif-seen');
  const hasNew = notifications.length > 0 && (!lastSeen || new Date(notifications[0].date) > new Date(lastSeen));
  dot.style.display = hasNew ? 'block' : 'none';
}

function toggleNotifications() {
  const panel = document.getElementById('notif-panel');
  const isOpen = panel.classList.toggle('open');
  if (isOpen) {
    renderNotifications();
    // Marca como visto
    if (notifications.length) localStorage.setItem('nj-notif-seen', notifications[0].date);
    document.getElementById('notif-dot').style.display = 'none';
  }
}

function renderNotifications() {
  const el = document.getElementById('notif-list');
  if (!notifications.length) {
    el.innerHTML = '<p class="notif-empty">Nenhuma novidade por aqui.</p>';
    return;
  }
  el.innerHTML = notifications.slice(0, 15).map(n => {
    const d = new Date(n.date).toLocaleDateString('pt-BR');
    return `
    <div class="notif-item">
      <span class="notif-icon">${n.icon}</span>
      <div class="notif-content">
        <p>${n.text}</p>
        <span class="notif-date">${d}</span>
      </div>
    </div>`;
  }).join('');
}

// Fecha o painel ao clicar fora
document.addEventListener('click', (e) => {
  const panel = document.getElementById('notif-panel');
  const btn = document.getElementById('btn-notif');
  if (panel && panel.classList.contains('open') && !panel.contains(e.target) && btn && !btn.contains(e.target)) {
    panel.classList.remove('open');
  }
});

/* =========================================================
   CONTADOR DE CARACTERES
   ========================================================= */
function attachCharCounters() {
  const configs = [
    { id: 'm-desc',  min: 20,  max: 1000 },
    { id: 'e-desc',  min: 20,  max: 1000 },
    { id: 'cv-summary',    max: 500 },
    { id: 'cv-experience', max: 800 },
    { id: 'report-detail', max: 300 },
    { id: 'chat-input',    max: 500 },
  ];
  configs.forEach(cfg => {
    const field = document.getElementById(cfg.id);
    if (!field || field.dataset.counterAttached) return;
    field.dataset.counterAttached = '1';
    if (cfg.max) field.setAttribute('maxlength', cfg.max);

    const counter = document.createElement('div');
    counter.className = 'char-counter';
    field.insertAdjacentElement('afterend', counter);

    const update = () => {
      const len = field.value.length;
      let txt = cfg.max ? `${len}/${cfg.max}` : `${len}`;
      counter.textContent = txt;
      counter.classList.remove('warn', 'ok');
      if (cfg.min && len > 0 && len < cfg.min) { counter.textContent = `${len}/${cfg.max || ''} — mínimo ${cfg.min}`; counter.classList.add('warn'); }
      else if (cfg.max && len >= cfg.max * 0.9) { counter.classList.add('warn'); }
      else if (cfg.min && len >= cfg.min) { counter.classList.add('ok'); }
    };
    field.addEventListener('input', update);
    update();
  });
}

/* =========================================================
   TEMA ESCURO / CLARO
   ========================================================= */
function toggleTheme(checkbox) {
  const isDark = checkbox.checked;
  document.body.classList.toggle('dark', isDark);
  localStorage.setItem('nj-theme', isDark ? 'dark' : 'light');
}
function applyTheme() {
  const saved = localStorage.getItem('nj-theme');
  if (saved === 'dark') {
    document.body.classList.add('dark');
    const cb = document.getElementById('theme-checkbox');
    if (cb) cb.checked = true;
  }
}
applyTheme();
attachCharCounters();

/* =========================================================
   INIT
   ========================================================= */
setTimeout(() => {
  const loader = document.getElementById('loading-screen');
  if (loader) { loader.style.opacity = '0'; setTimeout(() => loader.remove(), 400); }
}, 6000);

sb.auth.onAuthStateChange((ev, sess) => {
  if (sess && !currentUser) enterDashboard(sess.user);
  else if (!sess) { showScreen('splash'); hideLoading(); }
});
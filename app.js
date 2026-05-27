const SUPABASE_URL  = 'https://ykcpqllyhcmtexaifeki.supabase.co';
const SUPABASE_ANON = 'sb_publishable_Ci7sMR0Yq4cqqql0w7M9AQ_gCjFp7cC';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

let jobs = [], activeCategory = 'Todos', currentUser = null, userProfile = null;
let leafletMap = null, mapMarkers = [], userLocation = null, nearMeActive = false;

const categories = ['Todos','Comércio','Tecnologia','Saúde','Logística','Educação','Alimentação'];

// Avatares profissionais — rostos humanos (DiceBear Lorelei + Notionists)
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

/* ===== UTILS ===== */
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
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

/* ===== AUTH ===== */
async function loginWithGoogle() {
  await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname } });
}
async function loginWithEmail() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  if (!email || !pass) return showToast('⚠️ Preencha e-mail e senha!');
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) return showToast('❌ ' + (error.message.includes('Invalid') ? 'E-mail ou senha incorretos.' : error.message));
  enterDashboard(data.user);
}
async function registerWithEmail() {
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass = document.getElementById('reg-pass').value;
  const isCompany = document.getElementById('reg-is-company').value === 'true';
  if (!name || !email || !pass) return showToast('⚠️ Preencha todos os campos!');
  if (pass.length < 8) return showToast('⚠️ Senha precisa ter 8+ caracteres.');
  const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { full_name: name } } });
  if (error) return showToast('❌ ' + error.message);
  await sb.from('profiles').upsert({ id: data.user.id, full_name: name, is_company: isCompany, avatar_id: '1' });
  showToast('✅ Conta criada com sucesso!');
  enterDashboard(data.user);
}
function selectType(btn, value) {
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('reg-is-company').value = value;
}
async function doLogout() {
  await sb.auth.signOut();
  currentUser = null; userProfile = null; jobs = [];
  window.location.reload();
}

/* ===== DASHBOARD ===== */
async function enterDashboard(user) {
  currentUser = user;
  try { await fetchUserProfile(); await fetchJobs(); } catch(e) { console.error(e); }
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
  const avatarId = data?.avatar_id || '1';
  const avatarUrl = AVATARS.find(a => a.id === avatarId)?.url || AVATARS[0].url;
  document.getElementById('user-avatar').innerHTML = `<img src="${avatarUrl}" alt="avatar">`;
  document.getElementById('fab-add-job').style.display = data?.is_company ? 'flex' : 'none';
}
async function fetchJobs() {
  const { data, error } = await sb.from('jobs').select('*').eq('approved', true).order('posted_at', { ascending: false });
  if (error) { console.error(error); return; }
  jobs = data || []; filterJobs();
}

/* ===== FILTROS ===== */
function filterJobs() {
  const q = document.getElementById('search-input').value.toLowerCase();
  const contract = document.getElementById('filter-contract').value;
  const shift = document.getElementById('filter-shift').value;
  let filtered = jobs.filter(j => {
    const matchCat = activeCategory === 'Todos' || j.category === activeCategory;
    const matchQ = !q || j.title.toLowerCase().includes(q) || (j.company||'').toLowerCase().includes(q);
    const matchC = contract === 'Todos' || j.contract_type === contract;
    const matchS = shift === 'Todos' || j.shift === shift;
    return matchCat && matchQ && matchC && matchS;
  });
  if (nearMeActive && userLocation) {
    filtered = filtered
      .map(j => ({ ...j, dist: calcDist(userLocation.lat, userLocation.lng, j.lat, j.lng) }))
      .filter(j => j.dist <= 10).sort((a,b) => a.dist - b.dist);
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

/* ===== MAPA ===== */
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
  const m = document.getElementById('map-container');
  const btn = document.querySelector('.map-toggle-btn');
  if (m.style.display === 'none') {
    m.style.display = 'block'; btn.textContent = 'Ocultar mapa';
    setTimeout(() => leafletMap && leafletMap.invalidateSize(), 200);
  } else { m.style.display = 'none'; btn.textContent = 'Mostrar mapa'; }
}
function toggleNearMe() {
  const btn = document.getElementById('btn-near-me');
  if (nearMeActive) { nearMeActive = false; btn.classList.remove('active'); filterJobs(); return; }
  if (!navigator.geolocation) return showToast('❌ Geolocalização não disponível.');
  showToast('📍 Detectando sua localização...');
  navigator.geolocation.getCurrentPosition(pos => {
    userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    nearMeActive = true; btn.classList.add('active');
    if (leafletMap) leafletMap.setView([userLocation.lat, userLocation.lng], 13);
    filterJobs();
  }, () => showToast('❌ Não foi possível obter localização.'));
}
function calcDist(lat1,lng1,lat2,lng2) {
  const R=6371, dLat=(lat2-lat1)*Math.PI/180, dLng=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

/* ===== RENDER VAGAS ===== */
function renderJobs(list) {
  const el = document.getElementById('jobs-list');
  if (!list.length) {
    el.innerHTML = `<div class="jobs-empty"><span>🔍</span><p>Nenhuma vaga encontrada.</p></div>`;
    return;
  }
  el.innerHTML = list.map((j,i) => {
    const dist = j.dist ? `📍 ${j.dist.toFixed(1)} km de você` : `📍 ${j.location||'Campinas'}`;
    return `
    <div class="job-card" style="animation-delay:${Math.min(i*60,400)}ms">
      <div class="job-card-header">
        <span class="job-title">${j.title}</span>
        <span class="job-salary">${j.salary||'A combinar'}</span>
      </div>
      <p class="job-company"><span>${j.company||'Empresa'}</span> • ${j.location||'Campinas'}</p>
      <div class="job-tags">
        ${j.category?`<span class="tag">${j.category}</span>`:''}
        ${j.contract_type?`<span class="tag tag-green">${j.contract_type}</span>`:''}
        ${j.shift?`<span class="tag tag-gray">${j.shift}</span>`:''}
      </div>
      <div class="job-footer">
        <span class="job-distance">${dist}</span>
        <button class="btn-apply" onclick="applyToJob('${j.id}',this)">Candidatar-se</button>
      </div>
    </div>`;
  }).join('');
}

/* ===== CANDIDATURA ===== */
async function applyToJob(jobId, btn) {
  if (!currentUser) return showToast('⚠️ Faça login para se candidatar.');
  if (userProfile?.is_company) return showToast('⚠️ Empresas não podem se candidatar.');
  btn.disabled = true; btn.textContent = 'Enviando...';
  const { error } = await sb.from('applications').insert([{
    job_id: jobId, candidate_id: currentUser.id,
    candidate_name: userProfile?.full_name || currentUser.email,
    candidate_email: currentUser.email
  }]);
  if (error) {
    if (error.code === '23505') { btn.textContent = '✓ Inscrito'; showToast('Você já se candidatou a esta vaga!'); }
    else { btn.disabled = false; btn.textContent = 'Candidatar-se'; showToast('❌ Erro ao se candidatar.'); }
  } else { btn.textContent = '✓ Inscrito'; showToast('✅ Candidatura enviada!'); }
}

/* ===== PUBLICAR VAGA ===== */
function openModal() { document.getElementById('modal-overlay').classList.add('open'); }
function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }
async function submitJob() {
  const title = document.getElementById('m-title').value.trim();
  const company = document.getElementById('m-company').value.trim();
  const locText = document.getElementById('m-location').value.trim();
  const salary = document.getElementById('m-salary').value;
  const contract = document.getElementById('m-contract').value;
  const shift = document.getElementById('m-shift').value;
  const category = document.getElementById('m-category').value;
  const desc = document.getElementById('m-desc').value.trim();
  if (!title || !company || !locText) return showToast('⚠️ Preencha cargo, empresa e bairro!');
  showToast('🔍 Buscando localização...');
  let lat = -22.9064, lng = -47.0616;
  try {
    const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locText+', Campinas, SP, Brasil')}`);
    const geo = await resp.json();
    if (geo.length > 0) { lat = parseFloat(geo[0].lat); lng = parseFloat(geo[0].lon); }
  } catch(e) { console.warn('Geocoding falhou', e); }
  const { error } = await sb.from('jobs').insert([{
    title, company, location: locText,
    salary: salary ? 'R$ '+Number(salary).toLocaleString('pt-BR') : 'A combinar',
    contract_type: contract, shift, category, description: desc,
    user_id: currentUser.id, lat, lng, approved: true
  }]);
  if (error) { showToast('❌ Erro: '+error.message); }
  else {
    showToast('✅ Vaga publicada!'); closeModal();
    ['m-title','m-company','m-location','m-salary','m-desc'].forEach(id => document.getElementById(id).value='');
    await fetchJobs();
  }
}

/* ===== PERFIL + AVATAR PICKER ===== */
function openProfileScreen() {
  renderAvatarPicker();
  if (userProfile) {
    document.getElementById('p-name').value = userProfile.full_name || '';
    document.getElementById('p-type').value = userProfile.is_company ? 'true' : 'false';
    const avatarId = userProfile.avatar_id || '1';
    document.getElementById('p-avatar').value = avatarId;
    updateAvatarPreview(avatarId);
  }
  showScreen('profile');
}

function renderAvatarPicker() {
  const grid = document.getElementById('avatar-grid');
  const currentId = document.getElementById('p-avatar').value || '1';
  grid.innerHTML = AVATARS.map(a => `
    <div class="avatar-option ${a.id===currentId?'selected':''}" onclick="selectAvatar('${a.id}')">
      <img src="${a.url}" alt="avatar ${a.id}" loading="lazy">
    </div>
  `).join('');
}

function selectAvatar(id) {
  document.getElementById('p-avatar').value = id;
  document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('.avatar-option').forEach(el => {
    if (el.onclick.toString().includes(`'${id}'`)) el.classList.add('selected');
  });
  updateAvatarPreview(id);
}

function updateAvatarPreview(id) {
  const url = AVATARS.find(a => a.id === id)?.url || AVATARS[0].url;
  document.getElementById('avatar-current-preview').innerHTML = `<img src="${url}" alt="preview">`;
}

async function saveProfile() {
  const isCompany = document.getElementById('p-type').value === 'true';
  const name = document.getElementById('p-name').value.trim();
  const avatarId = document.getElementById('p-avatar').value || '1';
  if (!name) return showToast('⚠️ Informe seu nome.');

  // Primeira tentativa: com avatar_id
  const { error } = await sb.from('profiles').upsert({
    id: currentUser.id,
    full_name: name,
    is_company: isCompany,
    avatar_id: avatarId
  });

  if (error) {
    // Se o erro for sobre avatar_id (coluna não existe ainda), salva sem ela
    if (error.message && (error.message.includes('avatar_id') || error.code === 'PGRST204' || error.code === '42703')) {
      const { error: err2 } = await sb.from('profiles').upsert({
        id: currentUser.id,
        full_name: name,
        is_company: isCompany
      });
      if (err2) return showToast('❌ Erro ao salvar: ' + err2.message);
      showToast('✅ Perfil salvo! (rode o SQL do Supabase para habilitar avatares)');
    } else {
      return showToast('❌ Erro ao salvar: ' + error.message);
    }
  } else {
    showToast('✅ Perfil atualizado com sucesso!');
  }
  enterDashboard(currentUser);
}

/* ===== TEMA ESCURO/CLARO ===== */
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

/* ===== INIT ===== */
setTimeout(() => {
  const loader = document.getElementById('loading-screen');
  if (loader) { loader.style.opacity='0'; setTimeout(()=>loader.remove(),400); }
}, 6000);

sb.auth.onAuthStateChange((ev, sess) => {
  if (sess && !currentUser) enterDashboard(sess.user);
  else if (!sess) { showScreen('splash'); hideLoading(); }
});
const SUPABASE_URL  = 'https://ykcpqllyhcmtexaifeki.supabase.co';
const SUPABASE_ANON = 'sb_publishable_Ci7sMR0Yq4cqqql0w7M9AQ_gCjFp7cC';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

let jobs = [], activeCategory = 'Todos', currentUser = null, userProfile = null;
let leafletMap = null, mapMarkers = [], userLocation = null, nearMeActive = false;
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

  if (!name || !email || !pass) return showToast('⚠️ Preencha todos os campos!', 'error');
  if (name.length < 2) return showToast('⚠️ Nome muito curto.', 'error');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showToast('⚠️ E-mail inválido.', 'error');
  if (pass.length < 8) return showToast('⚠️ Senha precisa ter 8+ caracteres.', 'error');

  const btn = document.querySelector('#register .btn-submit');
  btn.textContent = 'Criando conta...'; btn.disabled = true;
  const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { full_name: name } } });
  btn.textContent = 'Criar Conta →'; btn.disabled = false;
  if (error) return showToast('❌ ' + error.message, 'error');

  await sb.from('profiles').upsert({ id: data.user.id, full_name: name, is_company: isCompany, avatar_id: '1' });
  showToast('✅ Conta criada com sucesso!', 'success');
  enterDashboard(data.user);
}

function selectType(btn, value) {
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('reg-is-company').value = value;
}

async function doLogout() {
  await sb.auth.signOut();
  currentUser = null; userProfile = null; jobs = []; myApplications = new Set();
  window.location.reload();
}

/* =========================================================
   DASHBOARD
   ========================================================= */
async function enterDashboard(user) {
  currentUser = user;
  try {
    await fetchUserProfile();
    await Promise.all([fetchJobs(), fetchMyApplications()]);
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
  const avatarUrl = AVATARS.find(a => a.id === avatarId)?.url || AVATARS[0].url;
  document.getElementById('user-avatar').innerHTML = `<img src="${avatarUrl}" alt="avatar">`;
  document.getElementById('fab-add-job').style.display = data?.is_company ? 'flex' : 'none';
  const btnCompany = document.getElementById('btn-go-company');
  if (btnCompany) btnCompany.style.display = data?.is_company ? 'block' : 'none';

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
  filterJobs();
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
      .filter(j => j.dist <= 10)
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
  if (nearMeActive) { nearMeActive = false; btn.classList.remove('active'); filterJobs(); return; }
  if (!navigator.geolocation) return showToast('❌ Geolocalização não disponível.', 'error');
  showToast('📍 Detectando sua localização...');
  navigator.geolocation.getCurrentPosition(pos => {
    userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    nearMeActive = true; btn.classList.add('active');
    if (leafletMap) leafletMap.setView([userLocation.lat, userLocation.lng], 13);
    filterJobs();
  }, () => showToast('❌ Não foi possível obter localização.', 'error'));
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
    el.innerHTML = `<div class="jobs-empty"><span>🔍</span><p>Nenhuma vaga encontrada para esse filtro.</p></div>`;
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

    return `
    <div class="job-card" style="animation-delay:${Math.min(i*60,400)}ms" id="job-${j.id}">
      <div class="job-card-header">
        <span class="job-title">${j.title}</span>
        <span class="job-salary">${j.salary||'A combinar'}</span>
      </div>
      <p class="job-company"><span>${j.company||'Empresa'}</span> • ${j.location||'Campinas'}</p>
      <div class="job-tags">
        ${j.category    ? `<span class="tag">${j.category}</span>` : ''}
        ${j.contract_type ? `<span class="tag tag-green">${j.contract_type}</span>` : ''}
        ${j.shift       ? `<span class="tag tag-gray">${j.shift}</span>` : ''}
      </div>
      ${j.description ? `<p class="job-desc">${j.description.substring(0,120)}${j.description.length>120?'…':''}</p>` : ''}
      <div class="job-footer">
        <span class="job-distance">${dist}</span>
        <div style="display:flex;gap:8px;align-items:center;">
          ${ownerBtn}
          ${userProfile?.is_company && !isOwner ? '' : (!userProfile?.is_company ? applyBtn : '')}
        </div>
      </div>
    </div>`;
  }).join('');
}

/* =========================================================
   CANDIDATURA — salvar no banco
   ========================================================= */
async function applyToJob(jobId, btn) {
  if (!currentUser)            return showToast('⚠️ Faça login para se candidatar.', 'error');
  if (userProfile?.is_company) return showToast('⚠️ Empresas não podem se candidatar.', 'error');
  if (myApplications.has(jobId)) {
    btn.textContent = '✓ Inscrito'; btn.disabled = true; btn.classList.add('btn-applied');
    return;
  }

  btn.disabled = true; btn.textContent = 'Enviando...';

  const { error } = await sb.from('applications').insert([{
    job_id:          jobId,
    candidate_id:    currentUser.id,
    candidate_name:  userProfile?.full_name || currentUser.email,
    candidate_email: currentUser.email,
  }]);

  if (error) {
    if (error.code === '23505') {
      // já existe — atualiza o set local e o botão
      myApplications.add(jobId);
      btn.textContent = '✓ Inscrito'; btn.classList.add('btn-applied');
      showToast('Você já se candidatou a esta vaga!');
    } else {
      btn.disabled = false; btn.textContent = 'Candidatar-se';
      showToast('❌ Erro ao se candidatar: ' + error.message, 'error');
    }
  } else {
    myApplications.add(jobId);
    btn.textContent = '✓ Inscrito'; btn.classList.add('btn-applied');
    showToast('✅ Candidatura enviada com sucesso!', 'success');

    // Atualiza contador no stat card se existir
    const statEl = document.getElementById('stat-applications');
    if (statEl) statEl.textContent = myApplications.size;
  }
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
    const avatarId = userProfile.avatar_id || '1';
    document.getElementById('p-avatar').value = avatarId;
    updateAvatarPreview(avatarId);
  }
  // Mostra contagem de candidaturas no perfil
  renderProfileApplications();
  showScreen('profile');
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

async function renderProfileApplications() {
  const section = document.getElementById('profile-apps-section');
  const el = document.getElementById('profile-applications');
  if (!el || !section) return;

  // Esconde seção para empresas
  if (userProfile?.is_company) { section.style.display = 'none'; return; }
  section.style.display = 'block';

  const { data, error } = await sb
    .from('applications')
    .select('applied_at, job_id, jobs(title, company, location)')
    .eq('candidate_id', currentUser.id)
    .order('applied_at', { ascending: false });

  if (error || !data || data.length === 0) {
    el.innerHTML = '<p class="no-apps">Você ainda não se candidatou a nenhuma vaga.</p>';
    return;
  }

  // Atualiza o contador no stat card
  const statEl = document.getElementById('stat-applications');
  if (statEl) statEl.textContent = data.length;

  el.innerHTML = data.map(a => {
    const date = new Date(a.applied_at).toLocaleDateString('pt-BR');
    const title   = a.jobs?.title    || 'Vaga removida';
    const company = a.jobs?.company  || '';
    const loc     = a.jobs?.location || '';
    return `
    <div class="app-item">
      <div class="app-info">
        <span class="app-title">${title}</span>
        <span class="app-company">${company}${company && loc ? ' • ' : ''}${loc}</span>
        <span class="app-status">✉ Enviada</span>
      </div>
      <span class="app-date">${date}</span>
    </div>`;
  }).join('');
}

async function saveProfile() {
  const isCompany = document.getElementById('p-type').value === 'true';
  const name      = document.getElementById('p-name').value.trim();
  const avatarId  = document.getElementById('p-avatar').value || '1';

  if (!name || name.length < 2) return showToast('⚠️ Informe seu nome completo.', 'error');

  const btn = document.querySelector('#profile .btn-submit');
  btn.textContent = 'Salvando...'; btn.disabled = true;

  const { error } = await sb.from('profiles').upsert({
    id: currentUser.id, full_name: name, is_company: isCompany, avatar_id: avatarId
  });

  btn.textContent = 'Salvar Alterações'; btn.disabled = false;

  if (error) {
    if (error.message?.includes('avatar_id') || error.code === '42703') {
      const { error: err2 } = await sb.from('profiles').upsert({ id: currentUser.id, full_name: name, is_company: isCompany });
      if (err2) return showToast('❌ ' + err2.message, 'error');
      showToast('✅ Perfil salvo! Rode o SQL no Supabase para habilitar avatares.');
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
  const avatarUrl = AVATARS.find(a => a.id === avatarId)?.url || AVATARS[0].url;
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
    .select('candidate_name, candidate_email, applied_at')
    .eq('job_id', jobId)
    .order('applied_at', { ascending: false });

  if (error) { el.innerHTML = '<p class="no-apps" style="text-align:center;padding:24px">Erro ao carregar.</p>'; return; }

  if (!data || data.length === 0) {
    el.innerHTML = '<p class="no-apps" style="text-align:center;padding:32px">Nenhum candidato ainda para esta vaga.</p>';
    return;
  }

  el.innerHTML = data.map(c => {
    const initials = (c.candidate_name || 'U').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
    const date = new Date(c.applied_at).toLocaleDateString('pt-BR');
    return `
    <div class="candidate-card">
      <div class="candidate-avatar">${initials}</div>
      <div class="candidate-info">
        <div class="candidate-name">${c.candidate_name || 'Candidato'}</div>
        <div class="candidate-email">${c.candidate_email || ''}</div>
      </div>
      <div class="candidate-date">${date}</div>
    </div>`;
  }).join('');
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
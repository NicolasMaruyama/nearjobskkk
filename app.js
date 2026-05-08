// ============================================================
//  CONFIGURAÇÃO SUPABASE
// ============================================================
const SUPABASE_URL  = 'https://ykcpqllyhcmtexaifeki.supabase.co';
const SUPABASE_ANON = 'sb_publishable_Ci7sMR0Yq4cqqql0w7M9AQ_gCjFp7cC'; 
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ============================================================
//  ESTADO GLOBAL
// ============================================================
let jobs = [];
let activeCategory = "Todos";
let currentUser = null;
let userProfile = null;
let leafletMap = null;
let mapMarkers = [];
let userLocation = null;
const categories = ["Todos","Comércio","Tecnologia","Saúde","Logística","Educação"];

// ============================================================
//  INICIALIZAÇÃO
// ============================================================
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'dashboard' && leafletMap) setTimeout(() => leafletMap.invalidateSize(), 200);
}

async function enterDashboard(user) {
    currentUser = user;
    await fetchUserProfile();
    fetchJobs(); 
    renderCategories();
    showScreen('dashboard');
    setTimeout(() => initMap(), 500);
}

// ============================================================
//  LOGICA DE PERFIL (CANDIDATO VS EMPRESA)
// ============================================================
async function fetchUserProfile() {
    const { data } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
    userProfile = data;
    const name = data?.full_name || currentUser.email.split('@')[0];
    document.getElementById('greeting-name').textContent = name.split(' ')[0];
    document.getElementById('user-name-display').textContent = name.split(' ')[0];
    document.getElementById('user-avatar').innerHTML = `<img src="https://robohash.org/${currentUser.id}?set=set4">`;
    
    // SÓ EMPRESA VÊ O BOTÃO DE POSTAR
    document.getElementById('fab-add-job').style.display = data?.is_company ? 'flex' : 'none';
}

function openProfileScreen() {
    if (userProfile) {
        document.getElementById('p-name').value = userProfile.full_name || '';
        document.getElementById('p-bio').value = userProfile.bio || '';
        document.getElementById('p-type').value = userProfile.is_company.toString();
        document.getElementById('p-website').value = userProfile.website || '';
    }
    showScreen('profile');
}

function toggleCompanyFields() {
    const isCompany = document.getElementById('p-type').value === 'true';
    document.getElementById('company-only-fields').style.display = isCompany ? 'block' : 'none';
}

async function saveProfile() {
    const name = document.getElementById('p-name').value.trim();
    const isCompany = document.getElementById('p-type').value === 'true';
    if (!name) { showToast("⚠️ Nome é obrigatório"); return; }

    const { error } = await sb.from('profiles').upsert({
        id: currentUser.id,
        full_name: name,
        bio: document.getElementById('p-bio').value,
        is_company: isCompany,
        website: document.getElementById('p-website').value
    });

    if (error) showToast("Erro ao salvar");
    else { showToast("✓ Perfil atualizado!"); enterDashboard(currentUser); }
}

// ============================================================
//  GEOLOCALIZAÇÃO E PROXIMIDADE
// ============================================================
function getUserLocation() {
    if (!navigator.geolocation) { showToast("GPS não suportado"); return; }
    showToast("📍 Localizando você...");
    navigator.geolocation.getCurrentPosition((pos) => {
        userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (leafletMap) leafletMap.setView([userLocation.lat, userLocation.lng], 13);
        showToast("✅ Localização obtida!");
    });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function filterNearMe() {
    if (!userLocation) { getUserLocation(); return; }
    const btn = document.getElementById('btn-near-me');
    btn.classList.toggle('active');

    if (btn.classList.contains('active')) {
        const nearJobs = jobs.filter(j => calculateDistance(userLocation.lat, userLocation.lng, j.lat, j.lng) <= 15);
        renderJobs(nearJobs);
        updateMap(nearJobs);
        showToast("Vagas a até 15km de você");
    } else {
        filterJobs();
    }
}

// ============================================================
//  GERENCIAMENTO DE VAGAS
// ============================================================
async function fetchJobs() {
    const { data } = await sb.from('jobs').select('*').eq('approved', true).order('posted_at', { ascending: false });
    jobs = data || [];
    filterJobs();
}

async function submitJob() {
    const title = document.getElementById('m-title').value.trim();
    const company = document.getElementById('m-company').value.trim();
    const locationText = document.getElementById('m-location').value.trim();
    const salaryRaw = document.getElementById('m-salary').value.trim();

    // VALIDAÇÃO DE SALÁRIO
    const salaryNum = parseFloat(salaryRaw.replace(/[^\d]/g, ''));
    if (isNaN(salaryNum) || salaryNum <= 0) { showToast("⚠️ Insira um salário válido"); return; }
    if (!title || !company || !locationText) { showToast("⚠️ Preencha tudo"); return; }

    showToast("🔍 Validando endereço...");
    const query = encodeURIComponent(locationText + ", Campinas, SP");
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`);
    const geoData = await response.json();

    const lat = geoData.length > 0 ? parseFloat(geoData[0].lat) : -22.9064;
    const lng = geoData.length > 0 ? parseFloat(geoData[0].lon) : -47.0616;

    const { error } = await sb.from('jobs').insert([{
        title, company, location: locationText, 
        salary: "R$ " + salaryNum.toLocaleString('pt-BR'),
        category: document.getElementById('m-category').value,
        description: document.getElementById('m-desc').value,
        user_id: currentUser.id, lat, lng, approved: true
    }]);

    if (error) showToast("Erro ao publicar");
    else { showToast("✅ Vaga publicada!"); closeModal(); fetchJobs(); }
}

// ============================================================
//  UI E AUXILIARES
// ============================================================
function renderCategories() {
    const sc = document.getElementById('cat-scroll');
    sc.innerHTML = `<button class="cat-pill" onclick="filterNearMe()" id="btn-near-me">📍 Perto de mim</button>`;
    sc.innerHTML += categories.map(c => `<button class="cat-pill ${c === activeCategory ? 'active' : ''}" onclick="setCategory('${c}')">${c}</button>`).join('');
}

function setCategory(c) { activeCategory = c; renderCategories(); filterJobs(); }

function filterJobs() {
    const q = document.getElementById('search-input').value.toLowerCase();
    const filtered = jobs.filter(j => (activeCategory === 'Todos' || j.category === activeCategory) && (!q || j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q)));
    renderJobs(filtered);
    updateMap(filtered);
    document.getElementById('stat-total').textContent = filtered.length;
}

function renderJobs(list) {
    const el = document.getElementById('jobs-list');
    el.innerHTML = list.length ? list.map(j => `
        <div class="job-card">
            <div class="job-title">${j.title}</div>
            <div class="job-company">${j.company} • ${j.salary}</div>
            <p>${j.description}</p>
            <button class="btn-apply" onclick="showToast('✓ Candidatura enviada!')">Candidatar →</button>
        </div>
    `).join('') : "<p>Nenhuma vaga encontrada.</p>";
}

function initMap() {
    if (leafletMap) return;
    leafletMap = L.map('map-container').setView([-22.9064, -47.0616], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(leafletMap);
}

function updateMap(list) {
    if (!leafletMap) return;
    mapMarkers.forEach(m => leafletMap.removeLayer(m));
    mapMarkers = list.map(j => L.marker([j.lat, j.lng]).addTo(leafletMap).bindPopup(j.title));
}

async function loginWithEmail() {
    const { data, error } = await sb.auth.signInWithPassword({ email: document.getElementById('login-email').value, password: document.getElementById('login-pass').value });
    if (error) showToast("Erro no login"); else enterDashboard(data.user);
}

async function registerWithEmail() {
    const { data, error } = await sb.auth.signUp({ email: document.getElementById('reg-email').value, password: document.getElementById('reg-pass').value, options: { data: { full_name: document.getElementById('reg-name').value } } });
    if (error) showToast(error.message); else enterDashboard(data.user);
}

async function loginWithGoogle() { await sb.auth.signInWithOAuth({ provider: 'google' }); }
async function doLogout() { await sb.auth.signOut(); location.reload(); }
function openModal() { document.getElementById('modal-overlay').classList.add('open'); }
function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }
function closeModalOutside(e) { if (e.target.id === 'modal-overlay') closeModal(); }
function toggleMap() { const m = document.getElementById('map-container'); m.style.display = m.style.display === 'none' ? 'block' : 'none'; }
function showToast(m) { const t = document.getElementById('toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }
sb.auth.onAuthStateChange((event, session) => { if (session && !currentUser) enterDashboard(session.user); });
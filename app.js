// CONFIGURAÇÃO
const SUPABASE_URL  = 'https://ykcpqllyhcmtexaifeki.supabase.co';
const SUPABASE_ANON = 'sb_publishable_Ci7sMR0Yq4cqqql0w7M9AQ_gCjFp7cC'; 
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

let jobs = [], activeCategory = "Todos", currentUser = null, userProfile = null;
let leafletMap = null, mapMarkers = [], userLocation = null;
const categories = ["Todos","Comércio","Tecnologia","Saúde","Logística","Educação"];

function hideLoading() {
    const screen = document.getElementById('loading-screen');
    if (screen) { screen.style.opacity = '0'; setTimeout(() => screen.style.display = 'none', 500); }
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'dashboard' && leafletMap) setTimeout(() => leafletMap.invalidateSize(), 200);
}

async function enterDashboard(user) {
    currentUser = user;
    await fetchUserProfile();
    await fetchJobs(); 
    renderCategories();
    showScreen('dashboard');
    setTimeout(() => initMap(), 500);
    setTimeout(hideLoading, 1000);
}

// PERFIL
async function fetchUserProfile() {
    const { data } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
    userProfile = data;
    const name = data?.full_name || currentUser.email.split('@')[0];
    document.getElementById('greeting-name').textContent = name.split(' ')[0];
    document.getElementById('user-name-display').textContent = name.split(' ')[0];
    document.getElementById('user-avatar').innerHTML = `<img src="https://robohash.org/${currentUser.id}?set=set4">`;
    document.getElementById('fab-add-job').style.display = data?.is_company ? 'flex' : 'none';
}

async function saveProfile() {
    const name = document.getElementById('p-name').value.trim();
    if (!name) { showToast("⚠️ Nome é obrigatório"); return; }
    const { error } = await sb.from('profiles').upsert({
        id: currentUser.id,
        full_name: name,
        bio: document.getElementById('p-bio').value,
        is_company: document.getElementById('p-type').value === 'true',
        website: document.getElementById('p-website').value
    });
    if (!error) { showToast("✓ Perfil salvo!"); enterDashboard(currentUser); }
}

// VAGAS E FILTROS
async function fetchJobs() {
    const { data } = await sb.from('jobs').select('*').eq('approved', true).order('posted_at', { ascending: false });
    jobs = data || [];
    filterJobs();
}

async function submitJob() {
    const title = document.getElementById('m-title').value.trim();
    const company = document.getElementById('m-company').value.trim();
    const locText = document.getElementById('m-location').value.trim();
    const salary = document.getElementById('m-salary').value;
    const desc = document.getElementById('m-desc').value.trim();

    if (!title || !company || !locText || !salary || desc.length < 15) {
        showToast("⚠️ Preencha todos os campos!"); return;
    }

    showToast("🔍 Validando endereço...");
    const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locText + ", Campinas, SP")}`);
    const geo = await resp.json();
    const lat = geo.length > 0 ? parseFloat(geo[0].lat) : -22.9064;
    const lng = geo.length > 0 ? parseFloat(geo[0].lon) : -47.0616;

    const { error } = await sb.from('jobs').insert([{
        title, company, location: locText, salary: "R$ " + parseFloat(salary).toLocaleString('pt-BR'),
        category: document.getElementById('m-category').value, 
        contract_type: document.getElementById('m-contract').value, // NOVO
        shift: document.getElementById('m-shift').value,           // NOVO
        description: desc, user_id: currentUser.id, lat, lng, approved: true
    }]);

    if (!error) { showToast("✅ Vaga publicada!"); closeModal(); fetchJobs(); }
}

function filterJobs() {
    const q = document.getElementById('search-input').value.toLowerCase();
    const contractFilter = document.getElementById('filter-contract').value;
    const shiftFilter = document.getElementById('filter-shift').value;

    let filtered = jobs.filter(j => {
        const matchCat = activeCategory === 'Todos' || j.category === activeCategory;
        const matchContract = contractFilter === 'Todos' || j.contract_type === contractFilter;
        const matchShift = shiftFilter === 'Todos' || j.shift === shiftFilter;
        const matchQ = !q || j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q);
        return matchCat && matchContract && matchShift && matchQ;
    });

    if (document.getElementById('btn-near-me')?.classList.contains('active') && userLocation) {
        filtered = filtered.filter(j => calculateDistance(userLocation.lat, userLocation.lng, j.lat, j.lng) <= 15);
    }
    
    renderJobs(filtered);
    updateMap(filtered);
    document.getElementById('stat-total').textContent = filtered.length;
}

function renderJobs(list) {
    const el = document.getElementById('jobs-list');
    el.innerHTML = list.map((j, i) => `
        <div class="job-card" style="animation-delay: ${i*0.1}s">
            <h3 class="job-title">${j.title}</h3>
            <p class="job-company">🏢 ${j.company} • 💰 ${j.salary}</p>
            <div class="job-tags">
                <span class="tag">${j.contract_type}</span>
                <span class="tag">${j.shift}</span>
                <span class="tag">${j.category}</span>
            </div>
            <p class="job-desc">${j.description}</p>
            <button class="btn-apply" onclick="showToast('✓ Candidatura enviada!')">Candidatar →</button>
        </div>
    `).join('');
}

// GPS
function getUserLocation() {
    navigator.geolocation.getCurrentPosition((pos) => {
        userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (leafletMap) leafletMap.setView([userLocation.lat, userLocation.lng], 13);
        showToast("✅ GPS Ativo!");
        filterJobs();
    });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

function filterNearMe() {
    if (!userLocation) { getUserLocation(); return; }
    document.getElementById('btn-near-me').classList.toggle('active');
    filterJobs();
}

// MAPA
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

// AUXILIARES
function renderCategories() {
    const sc = document.getElementById('cat-scroll');
    sc.innerHTML = `<button class="cat-pill" onclick="filterNearMe()" id="btn-near-me">📍 Perto de mim</button>`;
    sc.innerHTML += categories.map(c => `<button class="cat-pill ${c === activeCategory ? 'active' : ''}" onclick="setCategory('${c}')">${c}</button>`).join('');
}
function setCategory(c) { activeCategory = c; renderCategories(); filterJobs(); }
function openModal() { document.getElementById('modal-overlay').classList.add('open'); }
function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }
function openProfileScreen() { showScreen('profile'); if (userProfile) { document.getElementById('p-name').value = userProfile.full_name || ''; document.getElementById('p-bio').value = userProfile.bio || ''; document.getElementById('p-type').value = userProfile.is_company.toString(); document.getElementById('p-website').value = userProfile.website || ''; } }
function toggleCompanyFields() { document.getElementById('company-only-fields').style.display = document.getElementById('p-type').value === 'true' ? 'block' : 'none'; }
function toggleMap() { const m = document.getElementById('map-container'); m.style.display = m.style.display === 'none' ? 'block' : 'none'; }
function showToast(m) { const t = document.getElementById('toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }
async function loginWithEmail() { const { data, error } = await sb.auth.signInWithPassword({ email: document.getElementById('login-email').value, password: document.getElementById('login-pass').value }); if (error) showToast("Erro no login"); else enterDashboard(data.user); }
async function registerWithEmail() { const { data, error } = await sb.auth.signUp({ email: document.getElementById('reg-email').value, password: document.getElementById('reg-pass').value, options: { data: { full_name: document.getElementById('reg-name').value } } }); if (error) showToast(error.message); else enterDashboard(data.user); }
async function doLogout() { await sb.auth.signOut(); window.location.reload(); }
async function loginWithGoogle() { await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname } }); }
sb.auth.onAuthStateChange((ev, sess) => { if (sess && !currentUser) enterDashboard(sess.user); });
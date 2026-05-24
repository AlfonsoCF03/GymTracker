// ============================================================
// EASYGYM — script.js
// Reemplaza TU_SUPABASE_URL y TU_SUPABASE_ANON_KEY
// con los valores de tu proyecto en Supabase
// ============================================================

const SUPABASE_URL = 'TU_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'TU_SUPABASE_ANON_KEY';
const INVITE_CODE = 'EASYGYM2025'; // Cambia esto por tu código secreto

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- STATE ----
let currentUser = null;
let currentProfile = null;
let currentPostId = null;
let preFeeling = 0, preRec = '', preFotoB64 = '';
let ibFotosB64 = [];
let exCount = 0;
let localPRs = {};
let localTemplates = [];

// ---- UTILS ----
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}
function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s);
  const mn = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${d.getDate()} ${mn[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtTime(s) {
  if (!s) return '';
  const d = new Date(s);
  const h = d.getHours().toString().padStart(2,'0');
  const m = d.getMinutes().toString().padStart(2,'0');
  return `${h}:${m}`;
}
function timeAgo(s) {
  const diff = Math.floor((Date.now() - new Date(s)) / 1000);
  if (diff < 60) return 'ahora';
  if (diff < 3600) return Math.floor(diff/60) + 'm';
  if (diff < 86400) return Math.floor(diff/3600) + 'h';
  return Math.floor(diff/86400) + 'd';
}
function today() { return new Date().toISOString().split('T')[0]; }
function v(id) { return document.getElementById(id)?.value || ''; }
function fv(id) { return parseFloat(v(id)) || 0; }
function iv(id) { return parseInt(v(id)) || 0; }
function set(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
function clr(...ids) { ids.forEach(id => set(id, '')); }
function openLightbox(src) { document.getElementById('lightbox-img').src = src; document.getElementById('lightbox').classList.add('open'); }
function closeLightbox() { document.getElementById('lightbox').classList.remove('open'); }
function avatarLetter(name) { return (name || '?')[0].toUpperCase(); }
function randomColor(name) {
  const colors = ['#7c6fff','#34d07c','#ff7eb3','#38d9d9','#ffb347','#ff6b6b'];
  return colors[(name||'').charCodeAt(0) % colors.length];
}

// ---- NAVIGATION ----
function showSection(name, btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('sec-' + name).classList.add('active');
  if (btn) btn.classList.add('active');
  if (name === 'feed') loadFeed();
  if (name === 'perfil') loadPerfil();
}
function switchAuthTab(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('auth-login').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('auth-register').style.display = tab === 'register' ? 'block' : 'none';
}

// ============================================================
// AUTH
// ============================================================
async function doLogin() {
  const email = v('login-email');
  const pass = v('login-pass');
  const err = document.getElementById('login-error');
  err.textContent = '';
  if (!email || !pass) { err.textContent = 'Completa todos los campos'; return; }
  const { error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) { err.textContent = 'Correo o contraseña incorrectos'; return; }
}

async function doRegister() {
  const code = v('reg-code').trim().toUpperCase();
  const name = v('reg-name').trim();
  const email = v('reg-email').trim();
  const pass = v('reg-pass');
  const err = document.getElementById('reg-error');
  err.textContent = '';
  if (code.toLowerCase() !== INVITE_CODE.toLowerCase()) { err.textContent = '⚠ Código de invitación incorrecto'; return; }
  if (!name || !email || !pass) { err.textContent = 'Completa todos los campos'; return; }
  if (pass.length < 6) { err.textContent = 'La contraseña debe tener mínimo 6 caracteres'; return; }
  const { error } = await sb.auth.signUp({ email, password: pass, options: { data: { name } } });
  if (error) { err.textContent = error.message; return; }
  toast('✓ Cuenta creada — ya puedes entrar');
  switchAuthTab('login', document.querySelector('.tab-btn'));
}

async function doLogout() {
  await sb.auth.signOut();
  currentUser = null; currentProfile = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
}

// ============================================================
// SESSION
// ============================================================
sb.auth.onAuthStateChange(async (event, session) => {
  if (session?.user) {
    currentUser = session.user;
    await loadProfile();
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    initApp();
  } else {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
  }
});

async function loadProfile() {
  const { data } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
  if (data) {
    currentProfile = data;
  } else {
    // Auto-create profile if not exists
    const name = currentUser.user_metadata?.name || currentUser.email.split('@')[0];
    const { data: newP } = await sb.from('profiles').insert({ id: currentUser.id, name, email: currentUser.email }).select().single();
    currentProfile = newP;
  }
}

function initApp() {
  document.getElementById('today-date').textContent = new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  set('ib-fecha', today());
  set('log-fecha', today());
  set('pre-fecha', today());
  // Avatar
  const av = document.getElementById('user-avatar');
  if (av && currentProfile) av.textContent = avatarLetter(currentProfile.name);
  // Load local data
  loadLocalData();
  loadFeed();
  renderTemplates();
}

// ============================================================
// LOCAL STORAGE (PRs y Templates — no van a Supabase)
// ============================================================
function loadLocalData() {
  try {
    const d = localStorage.getItem('eg_local_' + currentUser?.id);
    if (d) {
      const parsed = JSON.parse(d);
      localPRs = parsed.prs || {};
      localTemplates = parsed.templates || [];
    }
  } catch(e) {}
}
function saveLocalData() {
  try {
    localStorage.setItem('eg_local_' + currentUser?.id, JSON.stringify({ prs: localPRs, templates: localTemplates }));
  } catch(e) {}
}

// ============================================================
// FEED
// ============================================================
async function loadFeed() {
  const el = document.getElementById('feed-list');
  el.innerHTML = '<div class="spinner"></div>';
  const { data, error } = await sb
    .from('posts')
    .select('*, profiles(name)')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error || !data) { el.innerHTML = '<div class="empty">Error cargando el feed. Revisa tu conexión.</div>'; return; }
  if (!data.length) { el.innerHTML = '<div class="empty"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>Nadie ha publicado aún. ¡Sé el primero!</div>'; return; }
  el.innerHTML = '';
  for (const post of data) {
    el.appendChild(await buildFeedCard(post));
  }
}

async function buildFeedCard(post) {
  const div = document.createElement('div');
  div.className = 'feed-card';
  div.id = 'post-' + post.id;
  const name = post.profiles?.name || 'Usuario';
  const letter = avatarLetter(name);
  const color = randomColor(name);
  const isMe = post.user_id === currentUser?.id;

  // Get reactions
  const { data: reactions } = await sb.from('reactions').select('*').eq('post_id', post.id);
  const reactionGroups = {};
  (reactions || []).forEach(r => {
    if (!reactionGroups[r.emoji]) reactionGroups[r.emoji] = [];
    reactionGroups[r.emoji].push(r.user_id);
  });
  const myReaction = (reactions || []).find(r => r.user_id === currentUser?.id);

  // Get comment count
  const { count } = await sb.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', post.id);

  const typeLabel = { inbody: '📊 InBody', entreno: '🏋️ Entreno', pre: '⚡ Pre-entreno' }[post.type] || '📝';
  const typeBadge = { inbody: 'badge-accent', entreno: 'badge-green', pre: 'badge-amber' }[post.type] || 'badge-accent';

  let bodyHTML = '';
  const d = post.data || {};

  if (post.type === 'inbody') {
    bodyHTML = `
      <div class="feed-card-metrics">
        ${d.peso ? `<div class="feed-metric-pill">Peso: <strong>${d.peso} kg</strong></div>` : ''}
        ${d.grasa ? `<div class="feed-metric-pill">Grasa: <strong>${d.grasa}%</strong></div>` : ''}
        ${d.musculo ? `<div class="feed-metric-pill">Músculo: <strong>${d.musculo} kg</strong></div>` : ''}
        ${d.visceral ? `<div class="feed-metric-pill">Visceral: <strong>${d.visceral}</strong></div>` : ''}
        ${d.tmb ? `<div class="feed-metric-pill">TMB: <strong>${d.tmb} kcal</strong></div>` : ''}
      </div>
      ${d.notas ? `<div class="feed-card-text">📝 ${d.notas}</div>` : ''}
      ${(d.fotos||[]).length ? `<div class="photo-grid" style="margin-bottom:10px">${d.fotos.map(src => `<img src="${src}" class="photo-thumb" onclick="openLightbox('${src}')">`).join('')}</div>` : ''}`;
  } else if (post.type === 'entreno') {
    bodyHTML = `
      ${d.grupo ? `<div class="feed-card-metrics"><div class="feed-metric-pill">💪 ${d.grupo}</div></div>` : ''}
      <div style="font-size:13px;color:var(--text2);margin-bottom:8px;line-height:1.6">${(d.exs||[]).map(e => `<span style="display:inline-block;margin-right:10px">${e.nombre}${e.peso ? ' <strong style="color:var(--text)">' + e.peso + 'kg</strong>' : ''}${e.reps ? '×' + e.reps : ''}</span>`).join('')}</div>
      ${d.notas ? `<div class="feed-card-text">📝 ${d.notas}</div>` : ''}`;
  } else if (post.type === 'pre') {
    const feelEmojis = ['','😴','😐','💪','🔥'];
    bodyHTML = `
      <div class="feed-card-metrics">
        ${d.nombre ? `<div class="feed-metric-pill">⚡ <strong>${d.nombre}</strong></div>` : ''}
        ${d.sabor ? `<div class="feed-metric-pill">Sabor: ${d.sabor}</div>` : ''}
        ${d.dosis ? `<div class="feed-metric-pill">${d.dosis} scoop</div>` : ''}
        ${d.feeling ? `<div class="feed-metric-pill">${feelEmojis[d.feeling]}</div>` : ''}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">
        ${d.bombeo ? `<div style="font-size:12px;color:var(--text3)">Bombeo: <span style="color:var(--accent);font-weight:700">${d.bombeo}/10</span></div>` : ''}
        ${d.energia ? `<div style="font-size:12px;color:var(--text3)">Energía: <span style="color:var(--amber);font-weight:700">${d.energia}/10</span></div>` : ''}
        ${d.foco ? `<div style="font-size:12px;color:var(--text3)">Foco: <span style="color:var(--teal);font-weight:700">${d.foco}/10</span></div>` : ''}
        ${d.tingle ? `<div style="font-size:12px;color:var(--text3)">Hormigueo: <span style="color:var(--red);font-weight:700">${d.tingle}/10</span></div>` : ''}
      </div>
      ${d.foto ? `<img src="${d.foto}" class="feed-card-img" onclick="openLightbox('${d.foto}')">` : ''}
      ${d.notas ? `<div class="feed-card-text">📝 ${d.notas}</div>` : ''}
      ${d.rec ? `<div style="font-size:13px">${{si:'👍 Lo recomienda',no:'👎 No lo recomienda',tal:'🤷 A veces lo recomienda'}[d.rec]||''}</div>` : ''}`;
  }

  const reactionsHTML = Object.entries(reactionGroups).map(([emoji, users]) =>
    `<div class="reaction-chip ${users.includes(currentUser?.id) ? 'mine' : ''}" onclick="toggleReaction('${post.id}','${emoji}',this)">${emoji} ${users.length}</div>`
  ).join('');

  div.innerHTML = `
    <div class="feed-card-header">
      <div class="feed-avatar" style="background:${color}20;color:${color}">${letter}</div>
      <div>
        <div class="feed-user-name">${name}${isMe ? ' <span style="font-size:11px;color:var(--text3)">(tú)</span>' : ''}</div>
        <div class="feed-user-time">${timeAgo(post.created_at)}</div>
      </div>
      <span class="badge ${typeBadge} feed-type-badge">${typeLabel}</span>
    </div>
    <div class="feed-card-body">${bodyHTML}</div>
    ${reactionsHTML ? `<div class="reactions-bar">${reactionsHTML}</div>` : ''}
    <div class="feed-actions">
      <button class="feed-action-btn" onclick="showEmojiPicker('${post.id}')">😊 Reaccionar</button>
      <button class="feed-action-btn" onclick="openComments('${post.id}')" id="comments-btn-${post.id}">💬 ${count || 0} Comentarios</button>
      ${isMe ? `<button class="feed-action-btn" style="color:var(--red)" onclick="deletePost('${post.id}')">🗑</button>` : ''}
    </div>`;
  return div;
}

// ---- EMOJI PICKER ----
const EMOJIS = ['🔥','💪','👏','🏆','😮','❤️','🤣','👍'];
function showEmojiPicker(postId) {
  // Remove existing picker
  document.querySelectorAll('.emoji-picker').forEach(p => p.remove());
  const picker = document.createElement('div');
  picker.className = 'emoji-picker';
  picker.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:var(--bg2);border:0.5px solid var(--border2);border-radius:var(--radius);padding:10px 14px;display:flex;gap:8px;z-index:150;box-shadow:var(--shadow)';
  picker.innerHTML = EMOJIS.map(e => `<button onclick="toggleReaction('${postId}','${e}',null);this.closest('.emoji-picker').remove()" style="font-size:22px;background:none;border:none;cursor:pointer;padding:4px;border-radius:6px" ontouchstart="this.style.background='var(--bg3)'" ontouchend="this.style.background='none'">${e}</button>`).join('');
  document.body.appendChild(picker);
  setTimeout(() => { document.addEventListener('click', () => picker.remove(), { once: true }); }, 100);
}

async function toggleReaction(postId, emoji, chip) {
  const { data: existing } = await sb.from('reactions').select('id').eq('post_id', postId).eq('user_id', currentUser.id).eq('emoji', emoji).single();
  if (existing) {
    await sb.from('reactions').delete().eq('id', existing.id);
  } else {
    await sb.from('reactions').insert({ post_id: postId, user_id: currentUser.id, emoji });
  }
  // Refresh just the reactions bar of this post
  const { data: reactions } = await sb.from('reactions').select('*').eq('post_id', postId);
  const groups = {};
  (reactions || []).forEach(r => { if (!groups[r.emoji]) groups[r.emoji] = []; groups[r.emoji].push(r.user_id); });
  const bar = document.querySelector(`#post-${postId} .reactions-bar`);
  if (bar) {
    bar.innerHTML = Object.entries(groups).map(([e, users]) =>
      `<div class="reaction-chip ${users.includes(currentUser?.id) ? 'mine' : ''}" onclick="toggleReaction('${postId}','${e}',this)">${e} ${users.length}</div>`
    ).join('');
  } else {
    // Create bar
    const actions = document.querySelector(`#post-${postId} .feed-actions`);
    if (actions && Object.keys(groups).length) {
      const newBar = document.createElement('div');
      newBar.className = 'reactions-bar';
      newBar.innerHTML = Object.entries(groups).map(([e, users]) =>
        `<div class="reaction-chip ${users.includes(currentUser?.id) ? 'mine' : ''}" onclick="toggleReaction('${postId}','${e}',this)">${e} ${users.length}</div>`
      ).join('');
      actions.parentNode.insertBefore(newBar, actions);
    }
  }
}

// ---- COMMENTS ----
async function openComments(postId) {
  currentPostId = postId;
  const modal = document.getElementById('comment-modal');
  modal.style.display = 'flex';
  document.getElementById('comments-list').innerHTML = '<div class="spinner"></div>';
  const { data } = await sb.from('comments').select('*, profiles(name)').eq('post_id', postId).order('created_at', { ascending: true });
  const list = document.getElementById('comments-list');
  if (!data || !data.length) { list.innerHTML = '<div style="text-align:center;color:var(--text3);font-size:13px;padding:16px">Sin comentarios aún. ¡Sé el primero!</div>'; return; }
  list.innerHTML = data.map(c => {
    const name = c.profiles?.name || 'Usuario';
    return `<div class="comment-item">
      <div class="comment-avatar" style="background:${randomColor(name)}20;color:${randomColor(name)}">${avatarLetter(name)}</div>
      <div class="comment-bubble">
        <div class="comment-name">${name}</div>
        <div class="comment-text">${c.text}</div>
        <div class="comment-time">${timeAgo(c.created_at)}</div>
      </div>
    </div>`;
  }).join('');
  list.scrollTop = list.scrollHeight;
}

function closeComments() {
  document.getElementById('comment-modal').style.display = 'none';
  currentPostId = null;
  set('comment-input', '');
}

async function postComment() {
  const text = v('comment-input').trim();
  if (!text || !currentPostId) return;
  const { error } = await sb.from('comments').insert({ post_id: currentPostId, user_id: currentUser.id, text });
  if (error) { toast('⚠ Error al comentar'); return; }
  set('comment-input', '');
  // Update count badge
  const { count } = await sb.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', currentPostId);
  const btn = document.getElementById('comments-btn-' + currentPostId);
  if (btn) btn.textContent = `💬 ${count} Comentarios`;
  await openComments(currentPostId);
}

async function deletePost(postId) {
  if (!confirm('¿Borrar esta publicación?')) return;
  await sb.from('posts').delete().eq('id', postId).eq('user_id', currentUser.id);
  document.getElementById('post-' + postId)?.remove();
  toast('✓ Publicación eliminada');
}

// ============================================================
// PUBLISH HELPER
// ============================================================
async function publishPost(type, data) {
  const { error } = await sb.from('posts').insert({ user_id: currentUser.id, type, data });
  if (error) { toast('⚠ Error al publicar'); return false; }
  return true;
}

// ============================================================
// INBODY
// ============================================================
function addIbFotos(input) {
  Array.from(input.files).forEach(f => {
    const reader = new FileReader();
    reader.onload = e => { ibFotosB64.push(e.target.result); renderIbFotoPreview(); };
    reader.readAsDataURL(f);
  });
}
function renderIbFotoPreview() {
  document.getElementById('ib-foto-preview').innerHTML = ibFotosB64.map((src, i) =>
    `<div class="photo-thumb-wrap"><img src="${src}" class="photo-thumb" onclick="openLightbox('${src}')"><button class="photo-del" onclick="ibFotosB64.splice(${i},1);renderIbFotoPreview()">✕</button></div>`
  ).join('');
}

async function saveInbody() {
  const d = {
    fecha: v('ib-fecha'), peso: fv('ib-peso'), grasa: fv('ib-grasa'),
    musculo: fv('ib-musculo'), visceral: fv('ib-visceral'), agua: fv('ib-agua'),
    hueso: fv('ib-hueso'), tmb: iv('ib-tmb'), notas: v('ib-notas'),
    fotos: [...ibFotosB64]
  };
  if (!d.fecha || !d.peso) { toast('⚠ Ingresa fecha y peso'); return; }

  // Save to Supabase
  const { error } = await sb.from('inbody').insert({ user_id: currentUser.id, ...d });
  if (error) { toast('⚠ Error guardando'); return; }

  // Publish to feed
  await publishPost('inbody', d);

  toast('✓ Medición guardada y publicada');
  clr('ib-fecha','ib-peso','ib-grasa','ib-musculo','ib-visceral','ib-agua','ib-hueso','ib-tmb','ib-notas');
  ibFotosB64 = [];
  document.getElementById('ib-foto-preview').innerHTML = '';
  loadMyInbody();
}

async function loadMyInbody() {
  const { data } = await sb.from('inbody').select('*').eq('user_id', currentUser.id).order('fecha', { ascending: false });
  const hist = document.getElementById('inbody-history');
  const lcard = document.getElementById('inbody-latest-card');
  if (!data || !data.length) {
    hist.innerHTML = '<div class="empty"><svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/></svg>Sin registros aún.</div>';
    lcard.style.display = 'none'; return;
  }
  const l = data[0];
  lcard.style.display = 'block';
  document.getElementById('ib-latest-date').textContent = fmtDate(l.fecha);
  document.getElementById('ib-metrics').innerHTML = [
    {lbl:'Peso',val:l.peso,unit:'kg',cls:'metric-accent'},{lbl:'% Grasa',val:l.grasa,unit:'%',cls:''},
    {lbl:'Músculo',val:l.musculo,unit:'kg',cls:'metric-green'},{lbl:'Visceral',val:l.visceral,unit:'',cls:l.visceral>10?'metric-red':'metric-amber'},
    {lbl:'Agua',val:l.agua,unit:'%',cls:''},{lbl:'TMB',val:l.tmb,unit:'kcal',cls:''}
  ].map(m => `<div class="metric-card"><div class="metric-label">${m.lbl}</div><div class="metric-value ${m.cls}">${m.val}<span class="metric-unit"> ${m.unit}</span></div></div>`).join('');
  const nd = document.getElementById('ib-notes-display');
  if (l.notas) { nd.style.display='block'; nd.textContent='📝 '+l.notas; } else nd.style.display='none';
  document.getElementById('ib-latest-photos').innerHTML = (l.fotos||[]).map(src => `<img src="${src}" class="photo-thumb" onclick="openLightbox('${src}')">`).join('');
  hist.innerHTML = data.map((r, i) => {
    const prev = data[i+1];
    const diff = prev ? (r.peso - prev.peso).toFixed(1) : null;
    const arrow = diff === null ? '' : diff < 0 ? '↓' : diff > 0 ? '↑' : '→';
    const cls = diff === null ? '' : diff < 0 ? 'trend-up' : diff > 0 ? 'trend-down' : '';
    return `<div class="history-row">
      <div>
        <div class="history-name">${fmtDate(r.fecha)}</div>
        <div class="history-sub">${r.grasa?r.grasa+'% grasa · ':''}${r.musculo?r.musculo+'kg músculo':''}</div>
        ${(r.fotos||[]).length ? `<div class="photo-grid" style="margin-top:8px">${r.fotos.slice(0,3).map(src=>`<img src="${src}" class="photo-thumb" onclick="openLightbox('${src}')">`).join('')}</div>` : ''}
      </div>
      <div class="history-right">
        <div style="text-align:right">
          <div style="font-size:16px;font-weight:700">${r.peso} kg</div>
          ${diff !== null ? `<div class="${cls}" style="font-size:12px;font-weight:600">${diff>0?'+':''}${diff} ${arrow}</div>` : ''}
        </div>
        <button class="btn-icon" onclick="delInbody('${r.id}')"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
      </div>
    </div>`;
  }).join('');
}

async function delInbody(id) {
  if (!confirm('¿Borrar esta medición?')) return;
  await sb.from('inbody').delete().eq('id', id);
  loadMyInbody();
}

// ============================================================
// ENTRENO
// ============================================================
function addExRow() {
  exCount++;
  const n = exCount;
  const row = document.createElement('div');
  row.className = 'ex-row'; row.id = 'ex-' + n;
  row.innerHTML = `<input type="text" id="en-${n}" placeholder="Ejercicio" oninput="calcRM()"><input type="number" id="ep-${n}" placeholder="0" step="0.5" oninput="calcRM()"><input type="number" id="er-${n}" placeholder="0" oninput="calcRM()"><input type="number" id="es-${n}" placeholder="0"><button class="btn-icon" onclick="rmExRow(${n})"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;
  document.getElementById('ex-rows').appendChild(row);
  document.getElementById('rm-box').style.display = 'block';
}
function rmExRow(n) { document.getElementById('ex-' + n)?.remove(); }
function calcRM() {
  const p = parseFloat(document.getElementById('ep-1')?.value || 0);
  const r = parseInt(document.getElementById('er-1')?.value || 0);
  if (p && r && r < 37) document.getElementById('rm-val').textContent = Math.round(p * (36 / (37 - r)));
}

async function saveLog() {
  const exs = [];
  for (let i = 1; i <= exCount; i++) {
    const nEl = document.getElementById('en-' + i); if (!nEl) continue;
    const nombre = nEl.value.trim(); if (!nombre) continue;
    const peso = parseFloat(document.getElementById('ep-'+i)?.value) || 0;
    const reps = parseInt(document.getElementById('er-'+i)?.value) || 0;
    const series = parseInt(document.getElementById('es-'+i)?.value) || 0;
    exs.push({ nombre, peso, reps, series });
    if (peso && (!localPRs[nombre.toLowerCase()] || peso > localPRs[nombre.toLowerCase()].peso)) {
      localPRs[nombre.toLowerCase()] = { nombre, peso, reps, fecha: v('log-fecha') };
    }
  }
  const logData = { fecha: v('log-fecha'), grupo: v('log-grupo'), exs, notas: v('log-notas') };
  if (!logData.fecha) { toast('⚠ Ingresa la fecha'); return; }

  const { error } = await sb.from('logs').insert({ user_id: currentUser.id, ...logData });
  if (error) { toast('⚠ Error guardando'); return; }

  await publishPost('entreno', logData);
  saveLocalData();
  toast('✓ Entreno guardado y publicado');
  document.getElementById('ex-rows').innerHTML = '';
  document.getElementById('rm-box').style.display = 'none';
  clr('log-fecha', 'log-grupo', 'log-notas');
  set('log-fecha', today());
  exCount = 0;
  loadMyLogs();
}

async function loadMyLogs() {
  const { data } = await sb.from('logs').select('*').eq('user_id', currentUser.id).order('fecha', { ascending: false }).limit(10);
  const hist = document.getElementById('log-history');
  if (!data || !data.length) { hist.innerHTML = '<div class="empty"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>Sin entrenamientos aún.</div>'; return; }
  hist.innerHTML = data.map(l => `<div class="history-row">
    <div>
      <div class="history-name">${fmtDate(l.fecha)}${l.grupo?' — '+l.grupo:''}</div>
      <div class="history-sub">${(l.exs||[]).map(e=>e.nombre+(e.peso?' '+e.peso+'kg':'')+(e.reps?'×'+e.reps:'')).join(' · ')}</div>
      ${l.notas?`<div class="history-sub" style="margin-top:2px;font-style:italic">${l.notas}</div>`:''}
    </div>
    <div class="history-right">
      <span class="badge badge-accent">${(l.exs||[]).length} ej.</span>
      <button class="btn-icon" onclick="delLog('${l.id}')"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
    </div>
  </div>`).join('');
}

async function delLog(id) {
  if (!confirm('¿Borrar este entreno?')) return;
  await sb.from('logs').delete().eq('id', id);
  loadMyLogs();
}

// ---- TEMPLATES ----
function saveTemplate() {
  const exs = [];
  for (let i = 1; i <= exCount; i++) {
    const nEl = document.getElementById('en-' + i); if (!nEl) continue;
    const nombre = nEl.value.trim(); if (!nombre) continue;
    exs.push({ nombre, peso: parseFloat(document.getElementById('ep-'+i)?.value)||0, reps: parseInt(document.getElementById('er-'+i)?.value)||0, series: parseInt(document.getElementById('es-'+i)?.value)||0 });
  }
  if (!exs.length) { toast('⚠ Agrega ejercicios primero'); return; }
  const nombre = prompt('Nombre de la plantilla:');
  if (!nombre) return;
  localTemplates.unshift({ id: Date.now(), nombre, grupo: v('log-grupo'), exs });
  saveLocalData(); renderTemplates();
  toast('✓ Plantilla guardada');
}
function loadTemplate(id) {
  const tpl = localTemplates.find(t => t.id === id);
  if (!tpl) return;
  document.getElementById('ex-rows').innerHTML = '';
  exCount = 0;
  set('log-grupo', tpl.grupo || '');
  tpl.exs.forEach(e => {
    exCount++;
    const n = exCount;
    const row = document.createElement('div');
    row.className = 'ex-row'; row.id = 'ex-' + n;
    row.innerHTML = `<input type="text" id="en-${n}" value="${e.nombre}" oninput="calcRM()"><input type="number" id="ep-${n}" value="${e.peso||''}" step="0.5" oninput="calcRM()"><input type="number" id="er-${n}" value="${e.reps||''}" oninput="calcRM()"><input type="number" id="es-${n}" value="${e.series||''}"><button class="btn-icon" onclick="rmExRow(${n})"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;
    document.getElementById('ex-rows').appendChild(row);
  });
  document.getElementById('rm-box').style.display = 'block';
  calcRM();
  toast('✓ Plantilla cargada — ajusta pesos y guarda');
}
function delTemplate(id) {
  if (!confirm('¿Borrar plantilla?')) return;
  localTemplates = localTemplates.filter(t => t.id !== id);
  saveLocalData(); renderTemplates();
}
function renderTemplates() {
  const el = document.getElementById('templates-list');
  if (!localTemplates.length) { el.innerHTML = '<div style="font-size:13px;color:var(--text3);padding:8px 0">Sin plantillas aún.</div>'; return; }
  el.innerHTML = localTemplates.map(t => `<div class="history-row">
    <div>
      <div class="history-name">${t.nombre}</div>
      <div class="history-sub">${t.grupo||'Sin grupo'} · ${t.exs.map(e=>e.nombre).join(', ')}</div>
    </div>
    <div class="history-right">
      <button class="btn btn-sm btn-primary" style="width:auto" onclick="loadTemplate(${t.id})">Cargar</button>
      <button class="btn-icon" onclick="delTemplate(${t.id})"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
    </div>
  </div>`).join('');
}

// ============================================================
// PRE-ENTRENO
// ============================================================
function setFeeling(val) {
  preFeeling = val;
  document.querySelectorAll('.feel-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.val) === val));
}
function setRec(val) {
  preRec = val;
  document.querySelectorAll('.rec-btn').forEach(b => b.classList.toggle('active', b.dataset.val === val));
}
function previewFoto(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    preFotoB64 = e.target.result;
    const img = document.getElementById('pre-foto-preview');
    img.src = preFotoB64; img.style.display = 'block';
    document.getElementById('pre-foto-clear').style.display = 'inline-flex';
    document.getElementById('pre-foto-zone').style.display = 'none';
  };
  reader.readAsDataURL(file);
}
function clearFoto() {
  preFotoB64 = '';
  document.getElementById('pre-foto-preview').style.display = 'none';
  document.getElementById('pre-foto-clear').style.display = 'none';
  document.getElementById('pre-foto-zone').style.display = 'block';
  document.getElementById('pre-foto-input').value = '';
}

async function savePre() {
  const d = {
    fecha: v('pre-fecha'), nombre: v('pre-nombre'), dosis: fv('pre-dosis'),
    sabor: v('pre-sabor'), hora: v('pre-hora'), feeling: preFeeling, rec: preRec,
    bombeo: iv('pre-bombeo'), energia: iv('pre-energia'), foco: iv('pre-foco'),
    tingle: iv('pre-tingle'), notas: v('pre-notas'), foto: preFotoB64
  };
  if (!d.nombre) { toast('⚠ Ingresa el nombre del pre'); return; }

  const { error } = await sb.from('pres').insert({ user_id: currentUser.id, ...d });
  if (error) { toast('⚠ Error guardando'); return; }

  await publishPost('pre', d);
  toast('✓ Pre-entreno guardado y publicado');
  clr('pre-fecha','pre-nombre','pre-dosis','pre-sabor','pre-hora','pre-notas');
  set('pre-bombeo',5); set('pre-energia',5); set('pre-foco',5); set('pre-tingle',5);
  ['pre-bombeo-val','pre-energia-val','pre-foco-val','pre-tingle-val'].forEach(id => document.getElementById(id).textContent = '5');
  preFeeling = 0; preRec = ''; clearFoto();
  document.querySelectorAll('.feel-btn,.rec-btn').forEach(b => b.classList.remove('active'));
  set('pre-fecha', today());
  loadMyPres();
}

async function loadMyPres() {
  const { data } = await sb.from('pres').select('*').eq('user_id', currentUser.id).order('fecha', { ascending: false }).limit(10);
  const hist = document.getElementById('pre-history');
  if (!data || !data.length) { hist.innerHTML = '<div class="empty"><svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>Sin registros aún.</div>'; return; }
  const feelEmojis = ['','😴','😐','💪','🔥'];
  const sBar = (val, color) => `<div style="display:flex;align-items:center;gap:6px"><div style="flex:1;background:var(--bg4);border-radius:99px;height:5px;overflow:hidden"><div style="width:${val*10}%;height:100%;background:${color};border-radius:99px"></div></div><span style="font-size:11px;color:var(--text3)">${val}</span></div>`;
  hist.innerHTML = data.map(p => `<div class="history-row" style="flex-direction:column;align-items:stretch;gap:10px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><div class="history-name">${p.nombre}${p.sabor?' — '+p.sabor:''}</div><div class="history-sub">${fmtDate(p.fecha)}${p.hora?' · '+p.hora:''}${p.dosis?' · '+p.dosis+' scoop':''}</div></div>
      <div style="display:flex;gap:6px;align-items:center">
        ${p.feeling ? `<span style="font-size:18px">${feelEmojis[p.feeling]}</span>` : ''}
        <button class="btn-icon" onclick="delPre('${p.id}')"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
      <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Bombeo</div>${sBar(p.bombeo,'var(--accent)')}</div>
      <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Energía</div>${sBar(p.energia,'var(--amber)')}</div>
      <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Foco</div>${sBar(p.foco,'var(--teal)')}</div>
      <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">Hormigueo</div>${sBar(p.tingle,'var(--red)')}</div>
    </div>
    ${p.foto ? `<img src="${p.foto}" style="width:100%;max-height:220px;object-fit:cover;border-radius:var(--radius-sm);cursor:pointer" onclick="openLightbox('${p.foto}')">` : ''}
    ${p.notas ? `<div style="font-size:12px;color:var(--text3);font-style:italic">${p.notas}</div>` : ''}
  </div>`).join('');
}

async function delPre(id) {
  if (!confirm('¿Borrar?')) return;
  await sb.from('pres').delete().eq('id', id);
  loadMyPres();
}

// ============================================================
// PERFIL
// ============================================================
async function loadPerfil() {
  if (!currentProfile) return;
  const name = currentProfile.name;
  document.getElementById('perfil-email').textContent = currentProfile.email || '';
  document.getElementById('perfil-name').textContent = name;
  document.getElementById('perfil-avatar-big').textContent = avatarLetter(name);
  document.getElementById('perfil-avatar-big').style.background = randomColor(name) + '20';
  document.getElementById('perfil-avatar-big').style.color = randomColor(name);

  // Stats
  const [{ count: entrenos }, { count: pres }, { count: inbodys }] = await Promise.all([
    sb.from('logs').select('*',{count:'exact',head:true}).eq('user_id',currentUser.id),
    sb.from('pres').select('*',{count:'exact',head:true}).eq('user_id',currentUser.id),
    sb.from('inbody').select('*',{count:'exact',head:true}).eq('user_id',currentUser.id),
  ]);
  document.getElementById('perfil-stats').textContent = `${entrenos||0} entrenos · ${inbodys||0} InBody · ${pres||0} pre-entrenos`;

  // PRs
  const prsEl = document.getElementById('my-prs');
  const prsList = Object.values(localPRs).sort((a,b) => b.peso - a.peso);
  if (!prsList.length) prsEl.innerHTML = '<div class="empty"><svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>Sin PRs aún.</div>';
  else prsEl.innerHTML = prsList.map(p => `<div class="history-row"><div><div class="history-name">${p.nombre}</div><div class="history-sub">${fmtDate(p.fecha)} · ${p.reps} reps</div></div><span class="badge badge-amber" style="font-size:15px;font-weight:700">${p.peso} kg</span></div>`).join('');

  // Members
  const { data: members } = await sb.from('profiles').select('*').order('name');
  const membersEl = document.getElementById('members-list');
  if (!members || !members.length) { membersEl.innerHTML = '<div class="empty">Sin miembros.</div>'; return; }
  membersEl.innerHTML = members.map(m => `<div class="history-row">
    <div style="display:flex;align-items:center;gap:10px">
      <div style="width:34px;height:34px;border-radius:50%;background:${randomColor(m.name)}20;color:${randomColor(m.name)};display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;flex-shrink:0">${avatarLetter(m.name)}</div>
      <div><div class="history-name">${m.name}${m.id===currentUser.id?' (tú)':''}</div><div class="history-sub">${m.email||''}</div></div>
    </div>
  </div>`).join('');

  // Pre-fill macros
  const { data: lastIb } = await sb.from('inbody').select('peso,grasa').eq('user_id',currentUser.id).order('fecha',{ascending:false}).limit(1).single();
  if (lastIb) { if (lastIb.peso) set('mc-peso', lastIb.peso); if (lastIb.grasa) set('mc-grasa', lastIb.grasa); }
}

// ============================================================
// CALCULADORA DE MACROS
// ============================================================
function calcMacros() {
  const peso = fv('mc-peso'), altura = fv('mc-altura'), edad = iv('mc-edad');
  const sexo = v('mc-sexo'), actividad = parseFloat(v('mc-actividad') || 1.55);
  const objetivo = v('mc-objetivo') || 'mant';
  if (!peso || !altura || !edad) { document.getElementById('macros-result').style.display = 'none'; return; }
  let tmb;
  if (sexo === 'm') tmb = 88.362 + (13.397*peso) + (4.799*altura) - (5.677*edad);
  else tmb = 447.593 + (9.247*peso) + (3.098*altura) - (4.330*edad);
  const tdee = Math.round(tmb * actividad);
  let kcal = tdee, pctProt = 0.30, pctCarbs = 0.40, pctGrasa = 0.30, advice = '';
  if (objetivo === 'deficit') {
    kcal = Math.round(tdee * 0.80); pctProt = 0.35; pctCarbs = 0.35; pctGrasa = 0.30;
    advice = 'Déficit del 20%. Mantén alta la proteína para preservar músculo. Meta: perder 0.5-1 kg/semana.';
  } else if (objetivo === 'volumen') {
    kcal = Math.round(tdee * 1.10); pctProt = 0.30; pctCarbs = 0.45; pctGrasa = 0.25;
    advice = 'Superávit del 10%. Carbos altos para rendir mejor y recuperarte. Meta: ganar 0.25-0.5 kg/semana.';
  } else if (objetivo === 'recomp') {
    kcal = tdee; pctProt = 0.40; pctCarbs = 0.35; pctGrasa = 0.25;
    advice = 'Recomposición: perder grasa y ganar músculo simultáneamente. Requiere paciencia y proteína muy alta.';
  } else {
    advice = 'Mantenimiento. Ideal para consolidar resultados antes de otra fase.';
  }
  const protG = Math.round((kcal * pctProt) / 4);
  const carbsG = Math.round((kcal * pctCarbs) / 4);
  const grasaG = Math.round((kcal * pctGrasa) / 9);
  document.getElementById('macros-result').style.display = 'block';
  document.getElementById('macros-metrics').innerHTML = [
    {lbl:'Calorías',val:kcal,unit:'kcal',cls:'metric-accent'},{lbl:'Proteína',val:protG,unit:'g',cls:'metric-green'},
    {lbl:'Carbos',val:carbsG,unit:'g',cls:'metric-amber'},{lbl:'Grasas',val:grasaG,unit:'g',cls:''},
    {lbl:'TDEE base',val:tdee,unit:'kcal',cls:''},{lbl:'Objetivo',val:{deficit:'Déficit',mant:'Mant.',volumen:'Volumen',recomp:'Recomp.'}[objetivo],unit:'',cls:''}
  ].map(m => `<div class="metric-card"><div class="metric-label">${m.lbl}</div><div class="metric-value ${m.cls}" style="font-size:${String(m.val).length>5?'14px':'20px'}">${m.val}<span class="metric-unit"> ${m.unit}</span></div></div>`).join('');
  document.getElementById('macros-advice').textContent = '💡 ' + advice;
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('today-date').textContent = new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  set('ib-fecha', today());
  set('log-fecha', today());
  set('pre-fecha', today());
  // Close comment modal on backdrop click
  document.getElementById('comment-modal').addEventListener('click', function(e) {
    if (e.target === this) closeComments();
  });
});

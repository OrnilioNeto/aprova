/* ============================================================
   API PRÓPRIA (ValueHost): AUTH + SINCRONIZAÇÃO DE DADOS
   Depende de: api-config.js (window.API_BASE_URL)
   e das funções do app (load, save, renderAll, state, LS_KEY).
   ============================================================ */

const __RECOVERY_LINK = /[#?].*reset=/i.test(location.hash) || /[#?].*reset=/i.test(location.search);

const TOKEN_KEY = 'aprova:token-v1';

let currentUser = null;
let syncTimer = null;
let syncDirty = false;
let authMode = 'login';
let recoveryPending = false;
let resetToken = null;

function isLoggedIn(){ return !!currentUser; }

/* ===== Camada de acesso à API ===== */

function apiBase(){ return String(window.API_BASE_URL || '').replace(/\/+$/, ''); }
function apiReady(){ return !!apiBase(); }
function apiUrl(action){ return apiBase() + '/index.php?action=' + encodeURIComponent(action); }

function getToken(){
  try{ return localStorage.getItem(TOKEN_KEY); }catch(e){ return null; }
}
function setToken(t){
  try{ if(t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); }catch(e){}
}

async function apiCall(action, opts){
  opts = opts || {};
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if(token && opts.auth !== false) headers['Authorization'] = 'Bearer ' + token;
  let res;
  try{
    res = await fetch(apiUrl(action), {
      method: opts.method || 'POST',
      headers: headers,
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
      keepalive: !!opts.keepalive
    });
  }catch(e){
    console.error('API fetch falhou:', action, apiUrl(action), e);
    const err = new Error('Sem conexão com o servidor.');
    err.offline = true;
    throw err;
  }
  let payload = null;
  try{ payload = await res.json(); }catch(e){}
  if(!res.ok){
    const msg = (payload && payload.error) ? payload.error : 'Erro no servidor (' + res.status + ').';
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return payload || {};
}

function handleExpiredSession(){
  setToken(null);
  currentUser = null;
  const screen = document.getElementById('auth-screen');
  if(screen) screen.classList.remove('dn');
  showLogin();
  setAuthMsg('Sua sessão expirou. Entre novamente.');
  renderAuthHeader();
}

/* ===== UI de autenticação ===== */

function setAuthMsg(m){
  const el = document.getElementById('auth-msg');
  if(el) el.innerHTML = m;
}

function setAuthLoading(on){
  const ids = ['auth-login','auth-register','auth-forgot','auth-reset'];
  const show = on ? [] : [authMode];
  ids.forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.classList.toggle('dn', show.indexOf(id)===-1);
  });
  const loadEl = document.getElementById('auth-loading');
  if(loadEl) loadEl.classList.toggle('dn', !on);
}

function showLogin(){
  authMode = 'login';
  setAuthMsg('');
  document.getElementById('auth-login').classList.remove('dn');
  document.getElementById('auth-register').classList.add('dn');
  document.getElementById('auth-forgot').classList.add('dn');
  document.getElementById('auth-reset').classList.add('dn');
}

function showRegister(){
  authMode = 'register';
  setAuthMsg('');
  document.getElementById('auth-login').classList.add('dn');
  document.getElementById('auth-register').classList.remove('dn');
  document.getElementById('auth-forgot').classList.add('dn');
  document.getElementById('auth-reset').classList.add('dn');
}

function showForgot(){
  authMode = 'forgot';
  setAuthMsg('');
  document.getElementById('auth-login').classList.add('dn');
  document.getElementById('auth-register').classList.add('dn');
  document.getElementById('auth-forgot').classList.remove('dn');
  document.getElementById('auth-reset').classList.add('dn');
}

function showReset(){
  authMode = 'reset';
  setAuthMsg('');
  ['auth-login','auth-register','auth-forgot'].forEach(id=>document.getElementById(id).classList.add('dn'));
  document.getElementById('auth-reset').classList.remove('dn');
}

function setSyncStatus(txt){
  const el = document.getElementById('sync-status');
  if(el) el.textContent = txt || '';
  const el2 = document.getElementById('sync-status2');
  if(el2) el2.textContent = txt || '—';
}

function renderAuthHeader(){
  const wrap = document.getElementById('auth-user');
  const label = document.getElementById('auth-email-label');
  if(!wrap || !label) return;
  if(currentUser){
    wrap.style.display = 'flex';
    label.textContent = currentUser.email || '';
  } else {
    wrap.style.display = 'none';
  }
}

/* ===== Ações de login/cadastro/sair ===== */

async function doLogin(){
  if(!apiReady()){ setAuthMsg('⚠ Servidor não configurado. Preencha a URL em <b>api-config.js</b>.'); return; }
  const email = document.getElementById('auth-email').value.trim();
  const pass = document.getElementById('auth-pass').value;
  setAuthMsg('');
  if(!email || !pass){ setAuthMsg('Informe e-mail e senha.'); return; }
  setAuthLoading(true);
  let r;
  try{
    r = await apiCall('login', { auth:false, body:{ email: email, password: pass } });
  }catch(e){
    setAuthLoading(false);
    setAuthMsg('Erro: ' + e.message);
    return;
  }
  setAuthLoading(false);
  setToken(r.token);
  await onSession(r.user);
}

async function doRegister(){
  if(!apiReady()){ setAuthMsg('⚠ Servidor não configurado. Preencha a URL em <b>api-config.js</b>.'); return; }
  const email = document.getElementById('reg-email').value.trim();
  const p1 = document.getElementById('reg-pass').value;
  const p2 = document.getElementById('reg-pass2').value;
  setAuthMsg('');
  if(!email || !p1){ setAuthMsg('Informe e-mail e senha.'); return; }
  if(p1 !== p2){ setAuthMsg('As senhas não conferem.'); return; }
  if(p1.length < 6){ setAuthMsg('A senha deve ter ao menos 6 caracteres.'); return; }
  setAuthLoading(true);
  let r;
  try{
    r = await apiCall('register', { auth:false, body:{ email: email, password: p1 } });
  }catch(e){
    setAuthLoading(false);
    if(/já está cadastrado|ja esta cadastrado/i.test(e.message)){
      setAuthMsg('Este e-mail já está cadastrado. Use <a href="#" onclick="showLogin();return false">Entrar</a> ou "Esqueci minha senha".');
    } else {
      setAuthMsg('Erro: ' + e.message);
    }
    return;
  }
  setAuthLoading(false);
  if(r.token){
    setToken(r.token);
    await onSession(r.user);
  } else {
    setAuthMsg('Conta criada! Verifique seu e-mail para confirmar e depois entre.');
    showLogin();
  }
}

async function doLogout(){
  if(!confirm('Sair da conta?')) return;
  setToken(null);
  currentUser = null;
  document.getElementById('auth-screen').classList.remove('dn');
  showLogin();
  setAuthMsg('Faça login para acessar seus dados de qualquer lugar.');
  renderAuthHeader();
}

async function doForgot(){
  if(!apiReady()){ setAuthMsg('⚠ Servidor não configurado. Preencha a URL em <b>api-config.js</b>.'); return; }
  const email = document.getElementById('forgot-email').value.trim();
  setAuthMsg('');
  if(!email){ setAuthMsg('Informe seu e-mail.'); return; }
  setAuthLoading(true);
  try{
    await apiCall('forgot', { auth:false, body:{ email: email } });
  }catch(e){
    setAuthLoading(false);
    setAuthMsg('Erro: ' + e.message);
    return;
  }
  setAuthLoading(false);
  setAuthMsg('Se este e-mail estiver cadastrado, enviamos um link de recuperação. Verifique sua caixa de entrada e clique no link.');
  showLogin();
}

async function doResetPassword(){
  if(!apiReady()){ return; }
  const p1 = document.getElementById('reset-pass').value;
  const p2 = document.getElementById('reset-pass2').value;
  setAuthMsg('');
  if(!p1){ setAuthMsg('Informe a nova senha.'); return; }
  if(p1 !== p2){ setAuthMsg('As senhas não conferem.'); return; }
  if(p1.length < 6){ setAuthMsg('A senha deve ter ao menos 6 caracteres.'); return; }
  if(!resetToken){ setAuthMsg('Link inválido. Solicite uma nova recuperação de senha.'); return; }
  setAuthLoading(true);
  let r;
  try{
    r = await apiCall('reset', { auth:false, body:{ token: resetToken, password: p1 } });
  }catch(e){
    setAuthLoading(false);
    setAuthMsg('Erro: ' + e.message);
    return;
  }
  setAuthLoading(false);
  recoveryPending = false;
  resetToken = null;
  if(r.token){
    setToken(r.token);
    await onSession(r.user);
  } else {
    setAuthMsg('Senha atualizada! Agora entre com a nova senha.');
    showLogin();
  }
}

async function doChangePassword(){
  const p1 = document.getElementById('cp-pass').value;
  const p2 = document.getElementById('cp-pass2').value;
  const msgEl = document.getElementById('cp-msg');
  if(!apiReady() || !currentUser){ if(msgEl) msgEl.textContent = 'Faça login para alterar a senha.'; return; }
  if(!p1){ if(msgEl) msgEl.textContent = 'Informe a nova senha.'; return; }
  if(p1 !== p2){ if(msgEl) msgEl.textContent = 'As senhas não conferem.'; return; }
  if(p1.length < 6){ if(msgEl) msgEl.textContent = 'A senha deve ter ao menos 6 caracteres.'; return; }
  if(msgEl){ msgEl.textContent = 'Salvando…'; msgEl.style.color = 'var(--muted)'; }
  try{
    await apiCall('change-password', { body:{ password: p1 } });
  }catch(e){
    if(msgEl){ msgEl.textContent = 'Erro: ' + e.message; msgEl.style.color = 'var(--red)'; }
    return;
  }
  document.getElementById('cp-pass').value = '';
  document.getElementById('cp-pass2').value = '';
  if(msgEl){ msgEl.textContent = '✓ Senha alterada com sucesso!'; msgEl.style.color = 'var(--green)'; }
}

/* ===== Carga/gravação na nuvem ===== */

function cacheKey(){ return LS_KEY + ':' + (currentUser ? currentUser.id : 'guest'); }

async function fetchServerState(){
  const r = await apiCall('state', { method:'GET' });
  return r && r.data ? r.data : null;
}

async function pushState(){
  if(!apiReady() || !currentUser || !state) return false;
  try{
    await apiCall('state', { method:'PUT', body:{ data: state }, keepalive: true });
    setSyncStatus('✓ salvo na nuvem');
    return true;
  }catch(e){
    console.error('API push:', e.message, e);
    if(e.status === 401){ handleExpiredSession(); return false; }
    setSyncStatus(e.offline ? '⚠ offline' : '⚠ não sincronizou: ' + (e.message||''));
    return false;
  }
}

function queueSync(){
  if(!currentUser || !state) return;
  syncDirty = true;
  setSyncStatus('salvando…');
  if(syncTimer) return;
  syncTimer = setTimeout(()=>{
    syncTimer = null;
    if(!syncDirty) return;
    syncDirty = false;
    pushState();
  }, 300);
}

async function loadCloudState(){
  if(!currentUser) return;
  const ck = cacheKey();
  let serverData = null, serverUpdated = null;
  try{
    const r = await apiCall('state', { method:'GET' });
    serverData = r && r.data ? r.data : null;
    serverUpdated = r && r.updated_at ? r.updated_at : null;
  }catch(e){
    console.error('fetch server:', e.message);
    if(e.status === 401){ handleExpiredSession(); return; }
  }
  // cache local (formato novo: {data, updated_at}; compatível com formato antigo)
  let cached = null, cachedUpdated = 0;
  try{
    const raw = localStorage.getItem(ck);
    if(raw){
      const parsed = JSON.parse(raw);
      if(parsed && parsed.data && parsed.data.concursos){ cached = parsed.data; cachedUpdated = Number(parsed.updated_at) || 0; }
      else if(parsed && parsed.concursos){ cached = parsed; cachedUpdated = 0; }
    }
  }catch(e){}
  const serverTs = serverUpdated ? new Date(serverUpdated).getTime() : 0;

  if(serverData && serverData.concursos){
    if(cached && cachedUpdated > serverTs + 1000){
      // cache local mais recente: prevalece e reenvia ao servidor
      state = normalizeState(cached);
      try{ localStorage.setItem(ck, JSON.stringify({ data: state, updated_at: cachedUpdated })); }catch(e){}
      pushState();
      return;
    }
    state = normalizeState(serverData);
    try{ localStorage.setItem(ck, JSON.stringify({ data: state, updated_at: serverTs || Date.now() })); }catch(e){}
    return;
  }
  if(cached && cached.concursos){
    state = normalizeState(cached);
    try{ localStorage.setItem(ck, JSON.stringify({ data: state, updated_at: cachedUpdated || Date.now() })); }catch(e){}
    pushState();
    return;
  }
  state = defaultState();
  await pushState();
  try{ localStorage.setItem(ck, JSON.stringify({ data: state, updated_at: Date.now() })); }catch(e){}
}

async function syncNow(){
  if(!currentUser){ alert('Faça login para sincronizar.'); return; }
  setSyncStatus('sincronizando…');
  const ok = await pushState();
  if(ok){ setSyncStatus('✓ sincronizado'); alert('Sincronização concluída.'); }
  else {
    setSyncStatus('⚠ falhou');
    let msg = 'Falha ao sincronizar.';
    try{ msg += '\\nURL da API: ' + (apiBase()||'(vazia)'); }catch(e){}
    alert(msg + '\\nAbra o console (F12) para ver o erro detalhado.');
  }
}

function showLocalCaches(){
  const prefix = LS_KEY + ':';
  const items = [];
  for(let i = 0; i < localStorage.length; i++){
    const k = localStorage.key(i);
    if(!k || !k.startsWith(prefix)) continue;
    try{
      const raw = localStorage.getItem(k);
      const parsed = JSON.parse(raw);
      const d = (parsed && parsed.data && parsed.data.concursos) ? parsed.data
             : (parsed && parsed.concursos) ? parsed : null;
      const sims = d ? d.concursos.reduce((a,c)=>a+(c.simulados||[]).length,0) : 0;
      const updated = (parsed && parsed.updated_at) ? new Date(Number(parsed.updated_at)).toLocaleString() : '—';
      items.push({ key: k, sims: sims, updated: updated });
    }catch(e){ items.push({ key: k, sims: '?', updated: '—' }); }
  }
  if(!items.length){ alert('Nenhum cache local encontrado.'); return; }
  const msg = items.map((it,i)=> (i+1)+') '+it.key+' — '+it.sims+' simulados — '+it.updated).join('\\n');
  const choice = prompt('Caches encontrados:\\n'+msg+'\\n\\nDigite o número do cache para importar (ou cancelar):');
  const idx = parseInt(choice,10)-1;
  if(isNaN(idx) || idx < 0 || idx >= items.length) return;
  try{
    const raw = localStorage.getItem(items[idx].key);
    const parsed = JSON.parse(raw);
    const d = (parsed && parsed.data && parsed.data.concursos) ? parsed.data
           : (parsed && parsed.concursos) ? parsed : null;
    if(!d){ alert('Cache inválido.'); return; }
    if(!confirm('Importar este cache? Isso substituirá os dados atuais.')) return;
    state = normalizeState(d);
    const ck = cacheKey();
    try{ localStorage.setItem(ck, JSON.stringify({ data: state, updated_at: Date.now() })); }catch(e){}
    pushState();
    renderAll();
    alert('Importação concluída.');
  }catch(e){ alert('Erro ao importar: '+e.message); }
}

async function migrateLocalCaches(){
  if(!currentUser) return;
  const ck = cacheKey();
  const prefix = LS_KEY + ':';
  let best = null;
  for(let i = 0; i < localStorage.length; i++){
    const k = localStorage.key(i);
    if(!k || !k.startsWith(prefix) || k === ck) continue;
    try{
      const raw = localStorage.getItem(k);
      if(!raw) continue;
      const parsed = JSON.parse(raw);
      const d = (parsed && parsed.data && parsed.data.concursos) ? parsed.data
             : (parsed && parsed.concursos) ? parsed : null;
      const ts = (parsed && parsed.updated_at) ? Number(parsed.updated_at) : 0;
      if(d && d.concursos){
        const sims = d.concursos.reduce((a,c)=>a+(c.simulados||[]).length,0);
        if(!best || sims > best.sims || (sims === best.sims && ts > best.ts)){
          best = { data: d, ts: ts, sims: sims, key: k };
        }
      }
    }catch(e){}
  }
  if(!best) return;
  const curSims = (state && state.concursos) ? state.concursos.reduce((a,c)=>a+(c.simulados||[]).length,0) : 0;
  if(best.sims <= curSims) return;
  if(!confirm('Encontramos dados salvos localmente de uma sessão anterior (' + best.sims + ' simulados). Deseja importá-los para sua conta atual?')){
    return;
  }
  state = normalizeState(best.data);
  try{ localStorage.setItem(ck, JSON.stringify({ data: state, updated_at: Date.now() })); }catch(e){}
  await pushState();
  renderAll();
}

async function onSession(user){
  currentUser = user;
  setAuthLoading(true);
  try{ await loadCloudState(); }
  catch(e){ console.error('loadCloudState:', e.message); }
  try{ await migrateLocalCaches(); }
  catch(e){ console.error('migrateLocalCaches:', e.message); }
  setAuthLoading(false);
  document.getElementById('auth-screen').classList.add('dn');
  renderAuthHeader();
  renderAll();
}

/* ===== Inicialização (chamada no fim do script principal) ===== */

function getUrlToken(kind){
  const h = location.hash || '';
  const s = location.search || '';
  let m = h.match(new RegExp('[#&?]' + kind + '=([A-Za-z0-9]+)'));
  if(!m) m = s.match(new RegExp('[?&]' + kind + '=([A-Za-z0-9]+)'));
  return m ? m[1] : null;
}

function clearUrlToken(){
  try{ history.replaceState(null, '', location.pathname); }catch(e){}
}

function isRecoveryLink(){
  return !!getUrlToken('reset');
}

async function initAuth(){
  const authScreen = document.getElementById('auth-screen');
  if(!apiReady()){
    // Modo local: sem servidor, dados salvos apenas neste navegador.
    currentUser = null;
    const ck = cacheKey();
    let cached = null;
    try{
      const raw = localStorage.getItem(ck);
      if(raw) cached = JSON.parse(raw);
    }catch(e){}
    if(cached && cached.concursos){
      state = normalizeState(cached);
    } else {
      state = defaultState();
    }
    try{ localStorage.setItem(ck, JSON.stringify(state)); }catch(e){}
    if(authScreen) authScreen.classList.add('dn');
    renderAuthHeader();
    renderAll();
    return;
  }

  const confirmTok = getUrlToken('confirm');
  if(confirmTok){
    clearUrlToken();
    authScreen.classList.remove('dn');
    showLogin();
    setAuthMsg('Confirmando seu e-mail…');
    renderAuthHeader();
    try{
      await apiCall('confirm', { auth:false, body:{ token: confirmTok } });
      setAuthMsg('✓ E-mail confirmado! Agora entre com sua conta.');
    }catch(e){
      setAuthMsg('Erro: ' + e.message);
    }
    return;
  }

  const urlResetToken = getUrlToken('reset');
  if(urlResetToken || (recoveryPending && __RECOVERY_LINK)){
    resetToken = urlResetToken || resetToken;
    recoveryPending = true;
    authScreen.classList.remove('dn');
    showReset();
    setAuthMsg('Defina uma nova senha para continuar.');
    renderAuthHeader();
    if(urlResetToken) clearUrlToken();
    return;
  }

  if(getToken()){
    try{
      const r = await apiCall('me', { method:'GET' });
      await onSession(r.user);
      return;
    }catch(e){
      setToken(null);
    }
  }

  authScreen.classList.remove('dn');
  showLogin();
  setAuthMsg('Faça login para acessar seus dados de qualquer lugar.');
  renderAuthHeader();
  if(!currentUser){
    const as = document.getElementById('auth-screen');
    if(as) as.classList.remove('dn');
  }
}

// Auto-sync periódico: tenta enviar alterações pendentes a cada 30s
try{
  setInterval(()=>{ if(currentUser && syncDirty) { syncDirty = false; pushState(); } }, 30000);
  window.addEventListener('focus', ()=>{ if(currentUser && !syncDirty){ loadCloudState(); } });
}catch(e){}

/* ============================================================
   SUPABASE: AUTH + SINCRONIZAÇÃO DE DADOS
   Depende de: supabase-config.js (URL + anon key), SDK do Supabase
   e das funções do app (load, save, renderAll, state, LS_KEY).
   ============================================================ */

let SUPABASE_CLIENT = null;
try{
  const hasKey = window.SUPABASE_ANON_KEY && window.SUPABASE_ANON_KEY.indexOf('COLE_A_') !== 0;
  if(window.supabase && window.SUPABASE_URL && hasKey){
    SUPABASE_CLIENT = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  }
}catch(e){ console.error('Supabase init:', e.message); }

let currentUser = null;
let syncTimer = null;
let syncDirty = false;
let authMode = 'login';

function isLoggedIn(){ return !!currentUser; }

/* ===== UI de autenticação ===== */

function setAuthMsg(m){
  const el = document.getElementById('auth-msg');
  if(el) el.innerHTML = m;
}

function setAuthLoading(on){
  const loadEl = document.getElementById('auth-loading');
  const loginEl = document.getElementById('auth-login');
  const regEl = document.getElementById('auth-register');
  if(loadEl) loadEl.classList.toggle('dn', !on);
  if(on){ loginEl.classList.add('dn'); regEl.classList.add('dn'); }
  else if(authMode==='login'){ loginEl.classList.remove('dn'); regEl.classList.add('dn'); }
  else { loginEl.classList.add('dn'); regEl.classList.remove('dn'); }
}

function showLogin(){
  authMode = 'login';
  setAuthMsg('');
  document.getElementById('auth-login').classList.remove('dn');
  document.getElementById('auth-register').classList.add('dn');
}

function showRegister(){
  authMode = 'register';
  setAuthMsg('');
  document.getElementById('auth-login').classList.add('dn');
  document.getElementById('auth-register').classList.remove('dn');
}

function setSyncStatus(txt){
  const el = document.getElementById('sync-status');
  if(el) el.textContent = txt || '';
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
  if(!SUPABASE_CLIENT){ setAuthMsg('Supabase não configurado. Verifique a anon key em supabase-config.js.'); return; }
  const email = document.getElementById('auth-email').value.trim();
  const pass = document.getElementById('auth-pass').value;
  setAuthMsg('');
  if(!email || !pass){ setAuthMsg('Informe e-mail e senha.'); return; }
  setAuthLoading(true);
  const { data, error } = await SUPABASE_CLIENT.auth.signInWithPassword({ email, password: pass });
  setAuthLoading(false);
  if(error){ setAuthMsg('Erro: '+error.message); return; }
  await onSession(data.session);
}

async function doRegister(){
  if(!SUPABASE_CLIENT){ setAuthMsg('Supabase não configurado. Verifique a anon key em supabase-config.js.'); return; }
  const email = document.getElementById('reg-email').value.trim();
  const p1 = document.getElementById('reg-pass').value;
  const p2 = document.getElementById('reg-pass2').value;
  setAuthMsg('');
  if(!email || !p1){ setAuthMsg('Informe e-mail e senha.'); return; }
  if(p1 !== p2){ setAuthMsg('As senhas não conferem.'); return; }
  if(p1.length < 6){ setAuthMsg('A senha deve ter ao menos 6 caracteres.'); return; }
  setAuthLoading(true);
  const { data, error } = await SUPABASE_CLIENT.auth.signUp({ email, password: p1 });
  setAuthLoading(false);
  if(error){ setAuthMsg('Erro: '+error.message); return; }
  if(data.session){
    await onSession(data.session);
  } else {
    setAuthMsg('Conta criada! Verifique seu e-mail para confirmar e depois entre.');
    showLogin();
  }
}

async function doLogout(){
  if(!SUPABASE_CLIENT){ return; }
  if(!confirm('Sair da conta?')) return;
  await SUPABASE_CLIENT.auth.signOut();
  currentUser = null;
  document.getElementById('auth-screen').classList.remove('dn');
  showLogin();
  setAuthMsg('Faça login para acessar seus dados de qualquer lugar.');
  renderAuthHeader();
}

/* ===== Carga/gravação no Supabase ===== */

function cacheKey(){ return LS_KEY + ':' + (currentUser ? currentUser.id : 'guest'); }

async function fetchServerState(){
  if(!SUPABASE_CLIENT) return null;
  const { data, error } = await SUPABASE_CLIENT.from('states')
    .select('data').eq('user_id', currentUser.id).maybeSingle();
  if(error) throw error;
  return data && data.data ? data.data : null;
}

async function pushState(){
  if(!SUPABASE_CLIENT || !currentUser || !state) return false;
  try{
    const { error } = await SUPABASE_CLIENT.from('states').upsert({
      user_id: currentUser.id,
      data: state,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
    if(error){ console.error('Supabase push:', error.message); setSyncStatus('⚠ não sincronizou'); return false; }
    setSyncStatus('✓ salvo na nuvem');
    return true;
  }catch(e){
    console.error('Supabase push:', e.message);
    setSyncStatus('⚠ offline');
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
  }, 800);
}

async function loadCloudState(){
  if(!currentUser) return;
  const ck = cacheKey();
  let serverData = null;
  try{ serverData = await fetchServerState(); }
  catch(e){ console.error('fetch server:', e.message); }
  if(serverData){
    state = serverData;
    try{ localStorage.setItem(ck, JSON.stringify(serverData)); }catch(e){}
    return;
  }
  let local = null;
  try{
    const raw = localStorage.getItem(ck);
    if(raw) local = JSON.parse(raw);
  }catch(e){}
  if(!local) local = state;
  if(local && local.concursos){
    state = local;
    await pushState();
    try{ localStorage.setItem(ck, JSON.stringify(local)); }catch(e){}
  }
}

async function onSession(session){
  currentUser = session.user;
  setAuthLoading(true);
  try{ await loadCloudState(); }
  catch(e){ console.error('loadCloudState:', e.message); }
  setAuthLoading(false);
  document.getElementById('auth-screen').classList.add('dn');
  renderAuthHeader();
  renderAll();
}

/* ===== Inicialização (chamada no fim do script principal) ===== */

async function initAuth(){
  load();
  if(!SUPABASE_CLIENT){
    document.getElementById('auth-screen').classList.remove('dn');
    showLogin();
    setAuthMsg('⚠ Supabase não configurado. Preencha a anon key em <b>supabase-config.js</b> (Supabase → Settings → API).');
    renderAuthHeader();
    return;
  }
  const { data: { session } } = await SUPABASE_CLIENT.auth.getSession();
  if(session){
    await onSession(session);
  } else {
    document.getElementById('auth-screen').classList.remove('dn');
    showLogin();
    setAuthMsg('Faça login para acessar seus dados de qualquer lugar.');
    renderAuthHeader();
  }
}
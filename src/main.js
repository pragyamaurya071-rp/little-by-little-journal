
import './style.css';
import { supabase, isSupabaseConfigured } from './supabase.js';

const HABITS = [
  ['morning', 'Wake up with intention'],
  ['study', 'Focused study session'],
  ['movement', 'Move / stretch'],
  ['tomorrow', 'Plan a gentle tomorrow']
];
const CATEGORIES = ['Learning', 'Work', 'Personal', 'Health', 'Other'];
const $ = (id) => document.getElementById(id);
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const escapeHtml = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let user = null, tasks = [], habits = [], logs = [], filter = 'all', selectedDay = today(), busy = false;

function authView(mode='signin', message='', isError=false) {
  $('app').innerHTML = `
    <section class="auth-wrap"><div class="auth-card">
      <div class="auth-mark">✿</div><h1>Little by Little</h1>
      <p>A softer way to stay on track.<br/>Your little steps, saved safely in your own space.</p>
      <div class="auth-tabs">
        <button id="signinTab" class="${mode==='signin'?'active':''}">Log in</button>
        <button id="signupTab" class="${mode==='signup'?'active':''}">Create account</button>
      </div>
      <form id="authForm" class="auth-form">
        <label>Email address<input class="field" id="email" type="email" autocomplete="email" placeholder="you@example.com" required /></label>
        <label>Password<input class="field" id="password" type="password" autocomplete="${mode==='signup'?'new-password':'current-password'}" minlength="6" placeholder="At least 6 characters" required /></label>
        <button class="btn" id="submitAuth" type="submit">${mode==='signup'?'Create my account':'Continue with email'}</button>
      </form>
      <div id="authMessage" class="message ${isError?'error':''}">${escapeHtml(message)}</div>
      <div class="divider">OR</div>
      <button class="google" id="googleBtn">Continue with Google</button>
      <div class="auth-foot">Your journal is private to your account. Use the same login on any device to access your saved days.</div>
    </div></section>`;
  $('signinTab').onclick = () => authView('signin');
  $('signupTab').onclick = () => authView('signup');
  $('authForm').onsubmit = async (e) => {
    e.preventDefault();
    const email = $('email').value.trim(), password = $('password').value;
    const btn = $('submitAuth'); btn.disabled = true; btn.textContent = 'Please wait…';
    const result = mode === 'signup'
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
      : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) authView(mode, result.error.message, true);
    else if (mode === 'signup' && !result.data.session) authView('signin', 'Account created. Check your email and confirm your address, then log in.');
  };
  $('googleBtn').onclick = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) authView(mode, error.message, true);
  };
}

function setupView() {
  $('app').innerHTML = `<section class="setup"><div class="auth-mark">✿</div><h2>One small setup step</h2>
    <p>Supabase credentials are not connected yet. This project is ready; add your project's URL and publishable/anon key to a local <code>.env</code> file.</p>
    <ol><li>Open Supabase → Project Settings → API.</li><li>Copy Project URL and the publishable key (or legacy anon key).</li><li>Rename <code>.env.example</code> to <code>.env</code> and paste the values.</li><li>Restart the app using <code>npm run dev</code>.</li></ol>
    <p><strong>Important:</strong> Never put your Supabase service-role key in this website.</p></section>`;
}

function shell() {
  $('app').innerHTML = `
    <header class="top"><div class="brand"><div class="logo">✿</div><div><h1>Little by Little</h1><p>a softer way to stay on track</p></div></div>
      <div class="account"><span class="user-chip" id="userEmail"></span><button class="btn ghost" id="signoutBtn">Log out</button></div>
    </header>
    <section class="hero"><div class="eyebrow">YOUR PERSONAL DAILY JOURNAL</div><h2 id="greeting">A little progress is still progress.</h2><p id="todayLabel">Make room for what matters today.</p><span class="flower">✿</span></section>
    <section class="stats">
      <div class="card stat"><small>Completed</small><strong id="completed">0</strong><em>tasks finished</em></div>
      <div class="card stat"><small>Active</small><strong id="active">0</strong><em>tasks on this day</em></div>
      <div class="card stat"><small>Learning</small><strong id="learning">0h</strong><em id="learningSub">time invested</em></div>
      <div class="card stat"><small>Pending</small><strong id="pending">0</strong><em>waiting for you</em></div>
    </section>
    <section class="card progress"><div class="progressline"><b>Today's little wins</b><span id="percent">0% complete</span></div><div class="track"><div class="fill" id="fill"></div></div></section>
    <div class="grid">
      <section class="panel"><div class="head"><h3>Daily intentions</h3><input class="field" id="dayPicker" type="date" aria-label="Choose journal date" /></div>
        <form class="formrow" id="taskForm"><input class="field task" id="taskInput" placeholder="Add something you want to do…" maxlength="160" required /><select id="category">${CATEGORIES.map(c=>`<option>${c}</option>`).join('')}</select><button class="btn">＋ Add</button></form>
        <div class="filters"><button class="filter active" data-filter="all">Everything</button><button class="filter" data-filter="active">Pending</button><button class="filter" data-filter="done">Completed</button></div><div class="tasklist" id="taskList"></div>
      </section>
      <aside>
        <section class="panel"><div class="head"><h3>Daily rituals</h3><span class="muted">little habits</span></div><div id="habits"></div></section>
        <section class="panel"><div class="head"><h3>Learning log</h3><span class="muted">study / practice</span></div><form id="learnForm" class="learningrow"><input class="field" id="learnMinutes" type="number" min="1" max="1440" placeholder="Minutes" required /><button class="btn">＋ Log</button></form><p class="muted">Add the minutes you spent learning on this day.</p><div class="learningtotal" id="todayLearning">0 min</div><div id="learningItems"></div></section>
        <section class="panel"><div class="head"><h3>This week</h3><span class="muted">daily completion</span></div><div class="week" id="week"></div></section>
        <section class="panel"><div class="head"><h3>Your full record</h3><span class="muted">all saved days</span></div><div class="history" id="history"></div><p class="privacy">Your records are stored in your account and protected by database access rules.</p><div class="actions"><button class="btn ghost" id="exportBtn">Export my data</button><button class="btn ghost" id="deleteBtn">Delete my data</button></div></section>
      </aside>
    </div><div id="appMessage" class="message"></div>`;
  $('userEmail').textContent = user.email || 'Your account';
  $('greeting').textContent = `Welcome back${user.email ? '' : ''}.`;
  $('dayPicker').value = selectedDay;
  $('signoutBtn').onclick = async () => { await supabase.auth.signOut(); };
  $('dayPicker').onchange = async () => { selectedDay = $('dayPicker').value || today(); await loadData(); };
  $('taskForm').onsubmit = addTask;
  $('learnForm').onsubmit = addLearning;
  document.querySelectorAll('.filter').forEach(b => b.onclick = () => {
    filter = b.dataset.filter;
    document.querySelectorAll('.filter').forEach(x => x.classList.toggle('active', x === b));
    renderTasks();
  });
  $('exportBtn').onclick = exportData;
  $('deleteBtn').onclick = deleteData;
}

function setMessage(msg, error=false) {
  const el = $('appMessage'); if (!el) return;
  el.textContent = msg; el.classList.toggle('error', error);
}
function dayTasks(day=selectedDay) { return tasks.filter(t => t.day === day); }
function dayHabits(day=selectedDay) { return habits.filter(h => h.day === day); }
function dayLogs(day=selectedDay) { return logs.filter(l => l.day === day); }
function minutesFor(day=selectedDay) { return dayLogs(day).reduce((sum, l) => sum + l.minutes, 0); }

async function loadData() {
  setMessage('Loading your journal…');
  const [t,h,l] = await Promise.all([
    supabase.from('tasks').select('*').order('created_at', {ascending:true}),
    supabase.from('habits').select('*'),
    supabase.from('learning_logs').select('*').order('created_at', {ascending:true})
  ]);
  const error = t.error || h.error || l.error;
  if (error) { setMessage(error.message + ' — Check that you ran supabase/schema.sql.', true); return; }
  tasks = t.data || []; habits = h.data || []; logs = l.data || [];
  render(); setMessage('');
}

async function addTask(e) {
  e.preventDefault(); const title = $('taskInput').value.trim(); if (!title) return;
  const { error } = await supabase.from('tasks').insert({user_id:user.id, day:selectedDay, title, category:$('category').value});
  if (error) return setMessage(error.message, true);
  $('taskInput').value = ''; await loadData();
}
async function toggleTask(task, checked) {
  const { error } = await supabase.from('tasks').update({is_done:checked}).eq('id',task.id);
  if (error) setMessage(error.message, true); else await loadData();
}
async function removeTask(task) {
  if (!confirm('Delete this task?')) return;
  const { error } = await supabase.from('tasks').delete().eq('id',task.id);
  if (error) setMessage(error.message, true); else await loadData();
}
async function toggleHabit(key, checked) {
  const existing = habits.find(h => h.day === selectedDay && h.habit_key === key);
  const result = existing
    ? await supabase.from('habits').update({is_done:checked}).eq('id',existing.id)
    : await supabase.from('habits').insert({user_id:user.id, day:selectedDay, habit_key:key, is_done:checked});
  if (result.error) setMessage(result.error.message, true); else await loadData();
}
async function addLearning(e) {
  e.preventDefault(); const minutes = Number($('learnMinutes').value);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) return;
  const { error } = await supabase.from('learning_logs').insert({user_id:user.id, day:selectedDay, minutes});
  if (error) return setMessage(error.message, true);
  $('learnMinutes').value = ''; await loadData();
}
async function removeLearning(log) {
  const { error } = await supabase.from('learning_logs').delete().eq('id',log.id);
  if (error) setMessage(error.message, true); else await loadData();
}

function renderTasks() {
  const list = $('taskList'); if (!list) return;
  list.innerHTML = '';
  const visible = dayTasks().filter(t => filter==='all' || (filter==='done' ? t.is_done : !t.is_done));
  if (!visible.length) { list.innerHTML = '<div class="empty">Nothing here just yet. Add a small intention above ✿</div>'; return; }
  visible.forEach(task => {
    const row = document.createElement('div'); row.className = 'taskrow' + (task.is_done?' done':'');
    const cb = document.createElement('input'); cb.type='checkbox'; cb.checked=task.is_done; cb.onchange=()=>toggleTask(task,cb.checked);
    const txt = document.createElement('span'); txt.className='tasktext'; txt.textContent=task.title;
    const tag = document.createElement('span'); tag.className='tag'; tag.textContent=task.category;
    const del = document.createElement('button'); del.className='del'; del.textContent='×'; del.title='Delete task'; del.onclick=()=>removeTask(task);
    row.append(cb,txt,tag,del); list.append(row);
  });
}
function renderHabits() {
  const box=$('habits'); box.innerHTML='';
  HABITS.forEach(([key,name])=>{
    const existing=dayHabits().find(h=>h.habit_key===key), checked=!!existing?.is_done;
    const row=document.createElement('div'); row.className='habit';
    const label=document.createElement('label'), cb=document.createElement('input'); cb.type='checkbox'; cb.checked=checked; cb.onchange=()=>toggleHabit(key,cb.checked);
    label.append(cb,document.createTextNode(name));
    const status=document.createElement('span'); status.className='muted'; status.textContent=checked?'Done':'Not yet';
    row.append(label,status); box.append(row);
  });
}
function renderWeek() {
  const box=$('week'); box.innerHTML='';
  const chosen=new Date(`${selectedDay}T12:00:00`), start=new Date(chosen);
  start.setDate(chosen.getDate()-((chosen.getDay()+6)%7));
  for(let i=0;i<7;i++){
    const d=new Date(start); d.setDate(start.getDate()+i);
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const items=tasks.filter(t=>t.day===key), done=items.filter(t=>t.is_done).length;
    const el=document.createElement('div'); el.className='day'+(key===selectedDay?' current':'');
    el.innerHTML=`<span>${d.toLocaleDateString('en-IN',{weekday:'short'})}</span><b>${items.length?Math.round(done/items.length*100)+'%':'—'}</b>`;
    box.append(el);
  }
}
function renderHistory() {
  const box=$('history'); box.innerHTML='';
  const keys=[...new Set([...tasks.map(x=>x.day),...habits.map(x=>x.day),...logs.map(x=>x.day)])].sort().reverse();
  if(!keys.length){box.innerHTML='<div class="empty">Your story starts today.</div>';return;}
  keys.forEach(k=>{
    const ts=tasks.filter(t=>t.day===k), done=ts.filter(t=>t.is_done).length, mins=logs.filter(l=>l.day===k).reduce((a,x)=>a+x.minutes,0);
    const el=document.createElement('div');el.className='historyitem';
    const a=document.createElement('span');a.textContent=new Date(`${k}T12:00:00`).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
    const b=document.createElement('b');b.textContent=`${done}/${ts.length} done · ${mins} min`;
    el.append(a,b);box.append(el);
  });
}
function render() {
  const ts=dayTasks(), done=ts.filter(t=>t.is_done).length, mins=minutesFor(), pct=ts.length?Math.round(done/ts.length*100):0;
  $('completed').textContent=done; $('active').textContent=ts.length; $('pending').textContent=ts.length-done;
  $('learning').textContent=(mins/60).toFixed(mins%60?1:0)+'h'; $('learningSub').textContent=mins+' minutes';
  $('percent').textContent=pct+'% complete'; $('fill').style.width=pct+'%';
  $('todayLearning').textContent=mins+' min';
  $('todayLabel').textContent=new Date(`${selectedDay}T12:00:00`).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  $('datePicker')?.setAttribute('value',selectedDay);
  renderTasks();renderHabits();renderWeek();renderHistory();
  const items=$('learningItems');items.innerHTML='';
  dayLogs().forEach(log=>{const el=document.createElement('div');el.className='historyitem';const a=document.createElement('span');a.textContent=`${log.minutes} minutes`;const b=document.createElement('button');b.className='del';b.textContent='×';b.onclick=()=>removeLearning(log);el.append(a,b);items.append(el);});
}
function exportData() {
  const data={exported_at:new Date().toISOString(),account:user.email,tasks,habits,learning_logs:logs};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='little-by-little-journal.json';a.click();URL.revokeObjectURL(url);
}
async function deleteData() {
  if(!confirm('Permanently delete all journal data in this account? This cannot be undone.')) return;
  const results=await Promise.all([
    supabase.from('tasks').delete().eq('user_id',user.id),
    supabase.from('habits').delete().eq('user_id',user.id),
    supabase.from('learning_logs').delete().eq('user_id',user.id)
  ]);
  const error=results.find(r=>r.error)?.error;
  if(error) setMessage(error.message,true); else await loadData();
}

async function start() {
  if (!isSupabaseConfigured) { setupView(); return; }
  const { data:{session} } = await supabase.auth.getSession();
  if (session?.user) { user=session.user; shell(); await loadData(); } else authView();
  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user && !user) { user=session.user; selectedDay=today(); shell(); await loadData(); }
    else if (!session?.user && user) { user=null; tasks=[];habits=[];logs=[];authView(); }
  });
}
start();

import './style.css';
import { supabase, isSupabaseConfigured } from './supabase.js';

const HABITS = [
  ['morning', 'Wake up with intention'],
  ['study', 'Focused study session'],
  ['movement', 'Move / stretch'],
  ['tomorrow', 'Plan a gentle tomorrow']
];
const CATEGORIES = ['Learning', 'Work', 'Personal', 'Health', 'Other'];
const $ = (id) => document.getElementById(id);
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const escapeHtml = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let user = null, tasks = [], habits = [], logs = [], filter = 'all', selectedDay = today(), busy = false;

function authView(mode='signin', message='', isError=false) {
  $('app').innerHTML = `
    <section class="auth-wrap"><div class="auth-card">
      <div class="auth-mark">✿</div><h1>Little by Little</h1>
      <p>A softer way to stay on track.<br/>Your little steps, saved safely in your own space.</p>
      <div class="auth-tabs">
        <button id="signinTab" class="${mode==='signin'?'active':''}">Log in</button>
        <button id="signupTab" class="${mode==='signup'?'active':''}">Create account</button>
      </div>
      <form id="authForm" class="auth-form">
        <label>Email address<input class="field" id="email" type="email" autocomplete="email" placeholder="you@example.com" required /></label>
        <label>Password<input class="field" id="password" type="password" autocomplete="${mode==='signup'?'new-password':'current-password'}" minlength="6" placeholder="At least 6 characters" required /></label>
        <button class="btn" id="submitAuth" type="submit">${mode==='signup'?'Create my account':'Continue with email'}</button>
      </form>
      <div id="authMessage" class="message ${isError?'error':''}">${escapeHtml(message)}</div>
      <div class="divider">OR</div>
      <button class="google" id="googleBtn">Continue with Google</button>
      <div class="auth-foot">Your journal is private to your account. Use the same login on any device to access your saved days.</div>
    </div></section>`;
  $('signinTab').onclick = () => authView('signin');
  $('signupTab').onclick = () => authView('signup');
  $('authForm').onsubmit = async (e) => {
    e.preventDefault();
    const email = $('email').value.trim(), password = $('password').value;
    const btn = $('submitAuth'); btn.disabled = true; btn.textContent = 'Please wait…';
    const result = mode === 'signup'
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
      : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) authView(mode, result.error.message, true);
    else if (mode === 'signup' && !result.data.session) authView('signin', 'Account created. Check your email and confirm your address, then log in.');
  };
  $('googleBtn').onclick = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) authView(mode, error.message, true);
  };
}

function setupView() {
  $('app').innerHTML = `<section class="setup"><div class="auth-mark">✿</div><h2>One small setup step</h2>
    <p>Supabase credentials are not connected yet. This project is ready; add your project's URL and publishable/anon key to a local <code>.env</code> file.</p>
    <ol><li>Open Supabase → Project Settings → API.</li><li>Copy Project URL and the publishable key (or legacy anon key).</li><li>Rename <code>.env.example</code> to <code>.env</code> and paste the values.</li><li>Restart the app using <code>npm run dev</code>.</li></ol>
    <p><strong>Important:</strong> Never put your Supabase service-role key in this website.</p></section>`;
}

function shell() {
  $('app').innerHTML = `
    <header class="top"><div class="brand"><div class="logo">✿</div><div><h1>Little by Little</h1><p>a softer way to stay on track ♡</p></div></div>
      <div class="account"><div class="live-clock"><span>🕰️</span><strong id="liveClock">--:--:--</strong><small id="clockDate">Loading date…</small></div><span class="user-chip" id="userEmail"></span><button class="btn ghost" id="signoutBtn">Log out</button></div>
    </header>
    <section class="hero"><div class="eyebrow">YOUR PERSONAL DAILY JOURNAL</div><h2 id="greeting">A little progress is still progress.</h2><p id="todayLabel">Make room for what matters today.</p><span class="flower">✿</span></section>
    <section class="stats">
      <div class="card stat"><small>Completed</small><strong id="completed">0</strong><em>tasks finished</em></div>
      <div class="card stat"><small>Active</small><strong id="active">0</strong><em>tasks on this day</em></div>
      <div class="card stat"><small>Learning</small><strong id="learning">0h</strong><em id="learningSub">time invested</em></div>
      <div class="card stat"><small>Pending</small><strong id="pending">0</strong><em>waiting for you</em></div>
    </section>
    <section class="card progress"><div class="progressline"><b>Today's little wins</b><span id="percent">0% complete</span></div><div class="track"><div class="fill" id="fill"></div></div></section>
    <div class="grid">
      <section class="panel"><div class="head"><h3>Daily intentions</h3><input class="field" id="dayPicker" type="date" aria-label="Choose journal date" /></div>
        <form class="formrow" id="taskForm"><input class="field task" id="taskInput" placeholder="Add something you want to do…" maxlength="160" required /><select id="category">${CATEGORIES.map(c=>`<option>${c}</option>`).join('')}</select><button class="btn">＋ Add</button></form>
        <div class="filters"><button class="filter active" data-filter="all">Everything</button><button class="filter" data-filter="active">Pending</button><button class="filter" data-filter="done">Completed</button></div><div class="tasklist" id="taskList"></div>
      </section>
      <aside>
        <section class="panel"><div class="head"><h3>Daily rituals</h3><span class="muted">little habits</span></div><div id="habits"></div></section>
        <section class="panel"><div class="head"><h3>Learning log</h3><span class="muted">study / practice</span></div><form id="learnForm" class="learningrow"><input class="field" id="learnMinutes" type="number" min="1" max="1440" placeholder="Minutes" required /><button class="btn">＋ Log</button></form><p class="muted">Add the minutes you spent learning on this day.</p><div class="learningtotal" id="todayLearning">0 min</div><div id="learningItems"></div></section>
        <section class="panel"><div class="head"><h3>🌷 This week</h3><span class="muted">daily completion</span></div><div class="week" id="week"></div></section>
        <section class="panel monthly-panel"><div class="head"><h3>🗓️ Monthly little wins</h3><span class="muted" id="monthLabel">This month</span></div><div class="monthly-grid" id="monthlyReport"></div></section>
        <section class="panel"><div class="head"><h3>📖 Your full record</h3><span class="muted">all saved days</span></div><div class="history" id="history"></div><p class="privacy">Your records are stored in your account and protected by database access rules.</p><div class="actions"><button class="btn ghost" id="exportBtn">Export my data</button><button class="btn ghost" id="deleteBtn">Delete my data</button></div></section>
      </aside>
    </div><div id="appMessage" class="message"></div>`;
  $('userEmail').textContent = user.email || 'Your account';
  updateClock();
  $('dayPicker').value = selectedDay;
  $('signoutBtn').onclick = async () => { await supabase.auth.signOut(); };
  $('dayPicker').onchange = async () => { selectedDay = $('dayPicker').value || today(); await loadData(); };
  $('taskForm').onsubmit = addTask;
  $('learnForm').onsubmit = addLearning;
  document.querySelectorAll('.filter').forEach(b => b.onclick = () => {
    filter = b.dataset.filter;
    document.querySelectorAll('.filter').forEach(x => x.classList.toggle('active', x === b));
    renderTasks();
  });
  $('exportBtn').onclick = exportData;
  $('deleteBtn').onclick = deleteData;
  updateClock();
}

function setMessage(msg, error=false) {
  const el = $('appMessage'); if (!el) return;
  el.textContent = msg; el.classList.toggle('error', error);
}
function dayTasks(day=selectedDay) { return tasks.filter(t => t.day === day); }
function dayHabits(day=selectedDay) { return habits.filter(h => h.day === day); }
function dayLogs(day=selectedDay) { return logs.filter(l => l.day === day); }
function minutesFor(day=selectedDay) { return dayLogs(day).reduce((sum, l) => sum + l.minutes, 0); }

async function loadData() {
  setMessage('Loading your journal…');
  const [t,h,l] = await Promise.all([
    supabase.from('tasks').select('*').order('created_at', {ascending:true}),
    supabase.from('habits').select('*'),
    supabase.from('learning_logs').select('*').order('created_at', {ascending:true})
  ]);
  const error = t.error || h.error || l.error;
  if (error) { setMessage(error.message + ' — Check that you ran supabase/schema.sql.', true); return; }
  tasks = t.data || []; habits = h.data || []; logs = l.data || [];
  render(); setMessage('');
}

async function addTask(e) {
  e.preventDefault(); const title = $('taskInput').value.trim(); if (!title) return;
  const { error } = await supabase.from('tasks').insert({user_id:user.id, day:selectedDay, title, category:$('category').value});
  if (error) return setMessage(error.message, true);
  $('taskInput').value = ''; await loadData();
}
async function toggleTask(task, checked) {
  const { error } = await supabase.from('tasks').update({is_done:checked}).eq('id',task.id);
  if (error) setMessage(error.message, true); else await loadData();
}
async function removeTask(task) {
  if (!confirm('Delete this task?')) return;
  const { error } = await supabase.from('tasks').delete().eq('id',task.id);
  if (error) setMessage(error.message, true); else await loadData();
}
async function toggleHabit(key, checked) {
  const existing = habits.find(h => h.day === selectedDay && h.habit_key === key);
  const result = existing
    ? await supabase.from('habits').update({is_done:checked}).eq('id',existing.id)
    : await supabase.from('habits').insert({user_id:user.id, day:selectedDay, habit_key:key, is_done:checked});
  if (result.error) setMessage(result.error.message, true); else await loadData();
}
async function addLearning(e) {
  e.preventDefault(); const minutes = Number($('learnMinutes').value);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) return;
  const { error } = await supabase.from('learning_logs').insert({user_id:user.id, day:selectedDay, minutes});
  if (error) return setMessage(error.message, true);
  $('learnMinutes').value = ''; await loadData();
}
async function removeLearning(log) {
  const { error } = await supabase.from('learning_logs').delete().eq('id',log.id);
  if (error) setMessage(error.message, true); else await loadData();
}

function renderTasks() {
  const list = $('taskList'); if (!list) return;
  list.innerHTML = '';
  const visible = dayTasks().filter(t => filter==='all' || (filter==='done' ? t.is_done : !t.is_done));
  if (!visible.length) { list.innerHTML = '<div class="empty">Nothing here just yet. Add a small intention above ✿</div>'; return; }
  visible.forEach(task => {
    const row = document.createElement('div'); row.className = 'taskrow' + (task.is_done?' done':'');
    const cb = document.createElement('input'); cb.type='checkbox'; cb.checked=task.is_done; cb.onchange=()=>toggleTask(task,cb.checked);
    const txt = document.createElement('span'); txt.className='tasktext'; txt.textContent=task.title;
    const tag = document.createElement('span'); tag.className='tag'; tag.textContent=task.category;
    const del = document.createElement('button'); del.className='del'; del.textContent='×'; del.title='Delete task'; del.onclick=()=>removeTask(task);
    row.append(cb,txt,tag,del); list.append(row);
  });
}
function renderHabits() {
  const box=$('habits'); box.innerHTML='';
  HABITS.forEach(([key,name])=>{
    const existing=dayHabits().find(h=>h.habit_key===key), checked=!!existing?.is_done;
    const row=document.createElement('div'); row.className='habit';
    const label=document.createElement('label'), cb=document.createElement('input'); cb.type='checkbox'; cb.checked=checked; cb.onchange=()=>toggleHabit(key,cb.checked);
    label.append(cb,document.createTextNode(name));
    const status=document.createElement('span'); status.className='muted'; status.textContent=checked?'Done':'Not yet';
    row.append(label,status); box.append(row);
  });
}
function renderWeek() {
  const box=$('week'); box.innerHTML='';
  const chosen=new Date(`${selectedDay}T12:00:00`), start=new Date(chosen);
  start.setDate(chosen.getDate()-((chosen.getDay()+6)%7));
  for(let i=0;i<7;i++){
    const d=new Date(start); d.setDate(start.getDate()+i);
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const items=tasks.filter(t=>t.day===key), done=items.filter(t=>t.is_done).length;
    const el=document.createElement('div'); el.className='day'+(key===selectedDay?' current':'');
    el.innerHTML=`<span>${d.toLocaleDateString('en-IN',{weekday:'short'})}</span><b>${items.length?Math.round(done/items.length*100)+'%':'—'}</b>`;
    box.append(el);
  }
}
function renderHistory() {
  const box=$('history'); box.innerHTML='';
  const keys=[...new Set([...tasks.map(x=>x.day),...habits.map(x=>x.day),...logs.map(x=>x.day)])].sort().reverse();
  if(!keys.length){box.innerHTML='<div class="empty">Your story starts today.</div>';return;}
  keys.forEach(k=>{
    const ts=tasks.filter(t=>t.day===k), done=ts.filter(t=>t.is_done).length, mins=logs.filter(l=>l.day===k).reduce((a,x)=>a+x.minutes,0);
    const el=document.createElement('div');el.className='historyitem';
    const a=document.createElement('span');a.textContent=new Date(`${k}T12:00:00`).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
    const b=document.createElement('b');b.textContent=`${done}/${ts.length} done · ${mins} min`;
    el.append(a,b);box.append(el);
  });
}
function updateClock() {
  const now = new Date();
  const clock = $('liveClock');
  const date = $('clockDate');
  const greeting = $('greeting');
  if (clock) clock.textContent = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  if (date) date.textContent = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  if (greeting) {
    const hour = now.getHours();
    const mood = hour < 12 ? 'Good morning ☀️' : hour < 17 ? 'Good afternoon 🌼' : hour < 21 ? 'Good evening 🌷' : 'Good night 🌙';
    greeting.textContent = `${mood}${user?.email ? ', welcome back' : ''}. A little progress is still progress.`;
  }
}

function renderMonthlyReport() {
  const box = $('monthlyReport');
  if (!box) return;
  const [year, month] = selectedDay.split('-').map(Number);
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const monthTasks = tasks.filter(t => t.day?.startsWith(monthKey));
  const completed = monthTasks.filter(t => t.is_done).length;
  const minutes = logs.filter(l => l.day?.startsWith(monthKey)).reduce((sum, l) => sum + Number(l.minutes || 0), 0);
  const habitCount = habits.filter(h => h.day?.startsWith(monthKey) && h.is_done).length;
  const days = new Set([...monthTasks.map(t => t.day), ...logs.filter(l => l.day?.startsWith(monthKey)).map(l => l.day)]).size;
  const label = new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  $('monthLabel').textContent = label;
  const cards = [
    ['✅', completed, 'Tasks completed'],
    ['📝', monthTasks.length, 'Tasks added'],
    ['📚', `${Math.floor(minutes / 60)}h ${minutes % 60}m`, 'Learning time'],
    ['🌱', habitCount, 'Habits completed'],
    ['📅', days, 'Active days']
  ];
  box.innerHTML = cards.map(([emoji, value, title]) => `<div class="monthly-stat"><span>${emoji}</span><strong>${value}</strong><small>${title}</small></div>`).join('');
}

function render() {
  const ts=dayTasks(), done=ts.filter(t=>t.is_done).length, mins=minutesFor(), pct=ts.length?Math.round(done/ts.length*100):0;
  $('completed').textContent=done; $('active').textContent=ts.length; $('pending').textContent=ts.length-done;
  $('learning').textContent=(mins/60).toFixed(mins%60?1:0)+'h'; $('learningSub').textContent=mins+' minutes';
  $('percent').textContent=pct+'% complete'; $('fill').style.width=pct+'%';
  $('todayLearning').textContent=mins+' min';
  $('todayLabel').textContent=new Date(`${selectedDay}T12:00:00`).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  $('datePicker')?.setAttribute('value',selectedDay);
  renderTasks();renderHabits();renderWeek();renderHistory();renderMonthlyReport();updateClock();
  const items=$('learningItems');items.innerHTML='';
  dayLogs().forEach(log=>{const el=document.createElement('div');el.className='historyitem';const a=document.createElement('span');a.textContent=`${log.minutes} minutes`;const b=document.createElement('button');b.className='del';b.textContent='×';b.onclick=()=>removeLearning(log);el.append(a,b);items.append(el);});
}
function exportData() {
  const data={exported_at:new Date().toISOString(),account:user.email,tasks,habits,learning_logs:logs};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='little-by-little-journal.json';a.click();URL.revokeObjectURL(url);
}
async function deleteData() {
  if(!confirm('Permanently delete all journal data in this account? This cannot be undone.')) return;
  const results=await Promise.all([
    supabase.from('tasks').delete().eq('user_id',user.id),
    supabase.from('habits').delete().eq('user_id',user.id),
    supabase.from('learning_logs').delete().eq('user_id',user.id)
  ]);
  const error=results.find(r=>r.error)?.error;
  if(error) setMessage(error.message,true); else await loadData();
}

async function start() {
  if (!isSupabaseConfigured) { setupView(); return; }
  const { data:{session} } = await supabase.auth.getSession();
  if (session?.user) { user=session.user; shell(); await loadData(); } else authView();
  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user && !user) { user=session.user; selectedDay=today(); shell(); await loadData(); }
    else if (!session?.user && user) { user=null; tasks=[];habits=[];logs=[];authView(); }
  });
}
start();
setInterval(updateClock, 1000);

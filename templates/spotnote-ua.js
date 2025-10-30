const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));
const escapeHtml = (str) => String(str === undefined || str === null ? '' : str)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

const LS_KEYS = {
  USERS: 'spot_users_v1',
  CURRENT: 'spot_current_user_v1',
  POSTS: 'spot_posts_v1',
  CATS: 'spot_cats_v1'
};

const DEFAULT_CATEGORIES = ['Загальне', 'Ідеї', 'Нотатки', 'Важливе'];

let users = {};
let currentUser = null;
let posts = [];
let categories = [];

// Save/load
function saveState(){
  localStorage.setItem(LS_KEYS.USERS, JSON.stringify(users));
  localStorage.setItem(LS_KEYS.CURRENT, currentUser || '');
  localStorage.setItem(LS_KEYS.POSTS, JSON.stringify(posts));
  localStorage.setItem(LS_KEYS.CATS, JSON.stringify(categories));
}

function loadState(){
  try {
    users = JSON.parse(localStorage.getItem(LS_KEYS.USERS) || '{}');
  } catch(e){ users = {}; }
  currentUser = localStorage.getItem(LS_KEYS.CURRENT) || '';
  if(currentUser === '') currentUser = null;
  try {
    posts = JSON.parse(localStorage.getItem(LS_KEYS.POSTS) || '[]');
  } catch(e){ posts = []; }
  try {
    categories = JSON.parse(localStorage.getItem(LS_KEYS.CATS) || 'null');
  } catch(e){ categories = null; }
  if(!Array.isArray(categories)){
    categories = DEFAULT_CATEGORIES.slice();
  }
}

// Rendering helpers (these are intentionally selector-light to fit original markup)
function ensureUiContainers(){
  // If original index.html doesn't have dedicated containers, create minimal scaffold
  if(!$('#spotnote-root')){
    // append a small root to body but keep it unobtrusive if original markup exists
    const root = document.createElement('div');
    root.id = 'spotnote-root';
    // we will not overwrite existing design — root will be appended at the end of <main> if possible
    const main = document.querySelector('main') || document.body;
    main.appendChild(root);
  }
}

function renderAuth(){
  ensureUiContainers();
  const area = $('#spotnote-auth-area') || document.createElement('div');
  area.id = 'spotnote-auth-area';
  area.className = 'spotnote-auth-area';
  area.innerHTML = '';
  if(currentUser){
    area.innerHTML = `
      <span class="spot-user"> ${escapeHtml(currentUser)} </span>
      <button id="spot-logout" class="spot-btn">Вийти</button>
      <button id="spot-account" class="spot-btn">Профіль</button>
    `;
  } else {
    area.innerHTML = `
      <button id="spot-login" class="spot-btn">Увійти</button>
      <button id="spot-register" class="spot-btn">Реєстрація</button>
    `;
  }
  // attach into header if possible (non-destructive)
  const header = document.querySelector('header') || document.querySelector('.header') || document.body;
  const existing = header.querySelector('#spotnote-auth-area');
  if(!existing){
    const wrapper = document.createElement('div');
    wrapper.id = 'spotnote-auth-area';
    wrapper.appendChild(area);
    header.appendChild(wrapper);
  } else {
    existing.replaceWith(area);
    area.id = 'spotnote-auth-area';
  }

  // events
  if($('#spot-logout')) $('#spot-logout').addEventListener('click', () => { logout(); });
  if($('#spot-account')) $('#spot-account').addEventListener('click', () => { openAccountModal(); });
  if($('#spot-login')) $('#spot-login').addEventListener('click', () => { openAuthModal('login'); });
  if($('#spot-register')) $('#spot-register').addEventListener('click', () => { openAuthModal('register'); });
}

function renderCategoriesList(targetSelector = '#spotnote-cats'){
  ensureUiContainers();
  let container = $(targetSelector);
  if(!container){
    container = document.createElement('div');
    container.id = targetSelector.replace('#','');
    container.className = 'spot-cats';
    // try insert to sidebar or create new sidebar-like area
    const sidebar = document.querySelector('.sidebar') || document.querySelector('aside') || document.querySelector('main') || document.body;
    sidebar.appendChild(container);
  }
  container.innerHTML = `<h4>Категорії</h4>`;
  const ul = document.createElement('ul');
  ul.className = 'spot-cats-list';
  categories.forEach(cat => {
    const li = document.createElement('li');
    li.className = 'spot-cat-item';
    li.innerHTML = `<button class="spot-cat-btn" data-cat="${escapeHtml(cat)}">${escapeHtml(cat)}</button> <button class="spot-cat-del" data-cat="${escapeHtml(cat)}" title="Видалити">✕</button>`;
    ul.appendChild(li);
  });
  container.appendChild(ul);
  const addRow = document.createElement('div');
  addRow.className = 'spot-add-cat';
  addRow.innerHTML = `<input id="spot-new-cat" placeholder="Нова категорія"> <button id="spot-add-cat">Додати</button>`;
  container.appendChild(addRow);

  // events
  $$('.spot-cat-btn').forEach(b => b.addEventListener('click', (e)=> filterByCategory(e.target.dataset.cat)));
  $$('.spot-cat-del').forEach(b => b.addEventListener('click', (e)=> {
    const cat = e.target.dataset.cat;
    if(confirm(`Видалити категорію "${cat}"?`)){
      categories = categories.filter(c => c !== cat);
      saveState(); renderCategoriesList(); renderPostsList();
    }
  }));
  $('#spot-add-cat')?.addEventListener('click', ()=>{
    const v = $('#spot-new-cat').value.trim();
    if(v) { addCategory(v); $('#spot-new-cat').value = ''; }
  });
}

let activeCategory = null;
let filterAuthor = 'all';

function renderPostsList(targetSelector = '#spotnote-posts'){
  ensureUiContainers();
  let container = $(targetSelector);
  if(!container){
    container = document.createElement('div');
    container.id = targetSelector.replace('#','');
    container.className = 'spot-posts';
    // place after categories if exists
    const main = document.querySelector('main') || document.body;
    main.appendChild(container);
  }
  // toolbar
  container.innerHTML = '';
  const toolbar = document.createElement('div');
  toolbar.className = 'spot-toolbar';
  toolbar.innerHTML = `<button id="spot-new-post" class="spot-btn primary">Новий допис</button>
    <label>Показати: <select id="spot-filter-author"><option value="all">Всі автори</option><option value="me">Тільки мої</option></select></label>`;
  container.appendChild(toolbar);

  const list = document.createElement('div');
  list.id = 'spot-posts-list';
  list.className = 'spot-posts-list';
  container.appendChild(list);

  // populate posts
  let shown = posts.slice().sort((a,b) => b.createdAt - a.createdAt);
  if(activeCategory) shown = shown.filter(p => p.category === activeCategory);
  if(filterAuthor === 'me' && currentUser) shown = shown.filter(p => p.author === currentUser);

  if(shown.length === 0){
    list.innerHTML = `<div class="spot-empty">Дописів немає. Створи перший допис!</div>`;
  } else {
    shown.forEach(p => {
      const card = document.createElement('article');
      card.className = 'spot-post-card';
      card.innerHTML = `<h4>${escapeHtml(p.title)}</h4>
        <div class="spot-meta">Категорія: <strong>${escapeHtml(p.category)}</strong> · Автор: <em>${escapeHtml(p.author)}</em> · ${new Date(p.createdAt).toLocaleString()}</div>
        <div class="spot-body">${escapeHtml(p.content).replace(/\n/g,'<br>')}</div>
        <div class="spot-actions"></div>`;
      const actions = card.querySelector('.spot-actions');
      if(currentUser && currentUser === p.author){
        const e = document.createElement('button'); e.className='spot-btn'; e.textContent='Редагувати'; e.addEventListener('click', ()=> openPostModal('edit', p.id));
        const d = document.createElement('button'); d.className='spot-btn danger'; d.textContent='Видалити'; d.addEventListener('click', ()=> deletePost(p.id));
        actions.appendChild(e); actions.appendChild(d);
      }
      list.appendChild(card);
    });
  }

  // events
  $('#spot-new-post')?.addEventListener('click', ()=>{
    if(!currentUser){ alert('Увійдіть або зареєструйтесь, щоб створити допис.'); return; }
    openPostModal('new');
  });
  $('#spot-filter-author')?.addEventListener('change', (e) => { filterAuthor = e.target.value; renderPostsList(); });
}

// Simple modal (non-destructive, injects single modal container)
function openModalWithHtml(html){
  let modal = document.querySelector('#spotnote-modal');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'spotnote-modal';
    modal.className = 'spot-modal hidden';
    modal.innerHTML = `<div class="spot-modal-inner"><button id="spot-modal-close" class="spot-close">✕</button><div id="spot-modal-body"></div></div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e)=>{ if(e.target === modal) closeModal(); });
    document.body.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeModal(); });
  }
  $('#spot-modal-body').innerHTML = html;
  modal.classList.remove('hidden');
  $('#spot-modal-close')?.addEventListener('click', closeModal);
}
function closeModal(){ const m = $('#spotnote-modal'); if(m) m.classList.add('hidden'); }

function openAuthModal(mode='login'){
  if(mode==='login'){
    openModalWithHtml(`
      <h3>Вхід</h3>
      <label>Ім'я користувача <input id="spot-auth-user"></label>
      <label>Пароль <input id="spot-auth-pass" type="password"></label>
      <div class="spot-modal-row">
        <button id="spot-auth-submit" class="spot-btn primary">Увійти</button>
        <button id="spot-auth-switch" class="spot-btn">Реєстрація</button>
      </div>
    `);
    $('#spot-auth-submit').addEventListener('click', ()=> {
      const u = $('#spot-auth-user').value.trim();
      const p = $('#spot-auth-pass').value;
      login(u,p);
    });
    $('#spot-auth-switch').addEventListener('click', ()=> openAuthModal('register'));
  } else {
    openModalWithHtml(`
      <h3>Реєстрація</h3>
      <label>Ім'я користувача <input id="spot-reg-user"></label>
      <label>Пароль <input id="spot-reg-pass" type="password"></label>
      <label>Показане ім'я (необов'язково) <input id="spot-reg-display"></label>
      <div class="spot-modal-row">
        <button id="spot-reg-submit" class="spot-btn primary">Створити обліковий запис</button>
        <button id="spot-reg-switch" class="spot-btn">Увійти</button>
      </div>
    `);
    $('#spot-reg-submit').addEventListener('click', ()=> {
      const u = $('#spot-reg-user').value.trim();
      const p = $('#spot-reg-pass').value;
      const d = $('#spot-reg-display').value.trim() || u;
      register(u,p,d);
    });
    $('#spot-reg-switch').addEventListener('click', ()=> openAuthModal('login'));
  }
}

function openAccountModal(){
  openModalWithHtml(`<h3>Обліковий запис: ${escapeHtml(currentUser)}</h3>
    <div class="spot-modal-row">
      <button id="spot-del-acc" class="spot-btn danger">Видалити обліковий запис</button>
      <button id="spot-close-acc" class="spot-btn">Закрити</button>
    </div>
    <p class="muted">Після видалення облікового запису всі ваші дописи буде видалено.</p>`);
  $('#spot-del-acc')?.addEventListener('click', ()=>{
    if(confirm('Підтвердити видалення облікового запису? Це видалить ваші дописи і не можна буде повернути.')){
      deleteAccount(currentUser);
      closeModal();
    }
  });
  $('#spot-close-acc')?.addEventListener('click', closeModal);
}

function openPostModal(mode='new', postId=null){
  let p = {title:'', content:'', category: categories[0] || ''};
  if(mode === 'edit'){
    p = posts.find(x => x.id === postId) || p;
  }
  openModalWithHtml(`
    <h3>${mode === 'edit' ? 'Редагувати допис' : 'Новий допис'}</h3>
    <label>Заголовок <input id="spot-post-title" value="${escapeHtml(p.title)}"></label>
    <label>Категорія <select id="spot-post-cat">${categories.map(c => '<option value="'+escapeHtml(c)+'">'+escapeHtml(c)+'</option>').join('')}</select></label>
    <label>Зміст <textarea id="spot-post-content">${escapeHtml(p.content)}</textarea></label>
    <div class="spot-modal-row">
      <button id="spot-post-save" class="spot-btn primary">${mode === 'edit' ? 'Зберегти' : 'Створити'}</button>
      <button id="spot-post-cancel" class="spot-btn">Скасувати</button>
    </div>
  `);
  $('#spot-post-cat').value = p.category || categories[0];
  $('#spot-post-save').addEventListener('click', ()=>{
    const title = $('#spot-post-title').value.trim();
    const content = $('#spot-post-content').value.trim();
    const category = $('#spot-post-cat').value;
    if(!currentUser){ alert('Потрібно увійти в обліковий запис, щоб створювати дописи.'); return; }
    if(title.length < 1){ alert('Введіть заголовок'); return; }
    if(mode === 'edit') updatePost(postId, title, content, category);
    else createPost(title, content, category);
    closeModal();
  });
  $('#spot-post-cancel').addEventListener('click', closeModal);
}

// Account logic
function register(username, password, displayName){
  if(!username || !password){ alert('Ім\'я користувача й пароль обов\'язкові'); return; }
  if(users[username]){ alert('Користувач з таким імʼям вже існує'); return; }
  users[username] = {password: btoa(password), displayName: displayName || username};
  currentUser = username;
  saveState(); renderAuth(); renderCategoriesList(); renderPostsList(); closeModal();
  alert('Обліковий запис створено, ви увійшли як ' + username);
}
function login(username, password){
  if(!username || !password){ alert('Введіть ім\'я та пароль'); return; }
  const u = users[username];
  if(!u || atob(u.password) !== password){ alert('Невірне імʼя користувача або пароль'); return; }
  currentUser = username;
  saveState(); renderAuth(); renderPostsList(); closeModal();
  alert('Вхід виконано');
}
function logout(){ currentUser = null; saveState(); renderAuth(); renderPostsList(); }
function deleteAccount(username){
  if(!users[username]) return;
  posts = posts.filter(p => p.author !== username);
  delete users[username];
  if(currentUser === username) currentUser = null;
  saveState(); renderAuth(); renderCategoriesList(); renderPostsList();
  alert('Обліковий запис видалено');
}

// Post functions
function createPost(title, content, category){
  const id = 'p_' + Date.now() + '_' + Math.floor(Math.random()*10000);
  const now = Date.now();
  const post = {id, title, content, category, author: currentUser, createdAt: now, updatedAt: now};
  posts.push(post);
  saveState(); renderPostsList();
}
function updatePost(id, title, content, category){
  const p = posts.find(x => x.id === id);
  if(!p) return;
  p.title = title; p.content = content; p.category = category; p.updatedAt = Date.now();
  saveState(); renderPostsList();
}
function deletePost(id){
  if(!confirm('Видалити допис?')) return;
  posts = posts.filter(p => p.id !== id);
  saveState(); renderPostsList();
}

// Categories
function addCategory(name){
  if(!name) return;
  if(categories.includes(name)){ alert('Така категорія вже існує'); return; }
  categories.push(name);
  saveState(); renderCategoriesList();
}

function filterByCategory(cat){
  if(activeCategory === cat) activeCategory = null; else activeCategory = cat;
  renderCategoriesList(); renderPostsList();
}

// Init
document.addEventListener('DOMContentLoaded', ()=>{
  loadState();
  // Render into original layout but in non-destructive way
  renderAuth();
  renderCategoriesList();
  renderPostsList();
});

// expose for debugging
window.spotnote = {
  _state: ()=> ({ users, currentUser, posts, categories }),
  createPost, updatePost, deletePost, addCategory
};

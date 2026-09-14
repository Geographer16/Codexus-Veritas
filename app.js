/* ============================================================
   Codexus Veritas — Kütüphane Fihristi
   ============================================================ */

const DATA_URL = 'books.json'; // aynı repo içinde relatif yol
const LS_KEYS = { owner: 'cv_gh_owner', repo: 'cv_gh_repo', token: 'cv_gh_token' };
const ADMIN_PASSWORD_HASH = null; // aşağıda setup() içinde ayarlanacak (bkz. README)

let allBooks = [];      // GitHub'dan/dosyadan çekilen ham liste
let currentSort = 'title';
let fileSha = null;     // GitHub'daki books.json dosyasının mevcut sha'sı (güncelleme için gerekli)

/* ---------------- Yardımcılar ---------------- */

function trTurkishLower(str){
  // Türkçe karakterleri doğru küçük harfe çeviren basit normalize
  return str
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLocaleLowerCase('tr-TR');
}

function normalize(str){
  return trTurkishLower(str || '').trim();
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function highlight(text, query){
  if(!query) return escapeHtml(text);
  const norm = normalize(text);
  const q = normalize(query);
  const idx = norm.indexOf(q);
  if(idx === -1) return escapeHtml(text);
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);
  return `${escapeHtml(before)}<mark>${escapeHtml(match)}</mark>${escapeHtml(after)}`;
}

/* ---------------- Veri yükleme ---------------- */

async function loadBooks(){
  try{
    const res = await fetch(DATA_URL, { cache: 'no-store' });
    if(!res.ok) throw new Error('books.json okunamadı');
    allBooks = await res.json();
  }catch(err){
    console.error(err);
    allBooks = [];
    document.getElementById('empty-state').hidden = false;
    document.getElementById('empty-state').textContent = 'Kitap verisi yüklenemedi.';
  }
  renderCatalog();
  updateFooter();
}

function updateFooter(){
  document.getElementById('total-count').textContent = allBooks.length;
  document.getElementById('last-updated').textContent = new Date().toLocaleDateString('tr-TR', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

/* ---------------- Arama + sıralama ---------------- */

function getFilteredSorted(){
  const query = document.getElementById('search').value.trim();
  const q = normalize(query);

  let list = allBooks;
  if(q){
    list = allBooks.filter(b =>
      normalize(b.title).includes(q) ||
      normalize(b.author).includes(q) ||
      normalize(b.publisher).includes(q)
    );
  }

  const sorted = [...list].sort((a, b) => {
    const av = normalize(a[currentSort] || '');
    const bv = normalize(b[currentSort] || '');
    return av.localeCompare(bv, 'tr-TR');
  });

  return { sorted, query };
}

function renderCatalog(){
  const { sorted, query } = getFilteredSorted();
  const catalog = document.getElementById('catalog');
  const empty = document.getElementById('empty-state');
  const countEl = document.getElementById('result-count');

  countEl.textContent = `${sorted.length} kitap`;

  if(sorted.length === 0){
    catalog.innerHTML = '';
    empty.hidden = false;
    empty.textContent = query
      ? `"${query}" ile eşleşen kitap bulunamadı.`
      : 'Kütüphanede henüz kitap yok.';
    return;
  }
  empty.hidden = true;

  const frag = document.createDocumentFragment();
  for(const book of sorted){
    const row = document.createElement('div');
    row.className = 'book-row';
    row.setAttribute('role', 'listitem');
    row.innerHTML = `
      <div class="book-title">${highlight(book.title, query)}</div>
      <div class="book-author">${highlight(book.author || '—', query)}</div>
      <div class="book-publisher">${highlight(book.publisher || '—', query)}</div>
    `;
    frag.appendChild(row);
  }
  catalog.innerHTML = '';
  catalog.appendChild(frag);
}

/* ---------------- Event listeners: arama/sıralama ---------------- */

document.getElementById('search').addEventListener('input', renderCatalog);
document.getElementById('sort-select').addEventListener('change', (e) => {
  currentSort = e.target.value;
  renderCatalog();
});

/* ============================================================
   ADMIN PANEL
   ============================================================ */

const overlay = document.getElementById('admin-overlay');
const loginView = document.getElementById('admin-login-view');
const tokenView = document.getElementById('admin-token-view');
const mainView = document.getElementById('admin-main-view');

document.getElementById('admin-toggle').addEventListener('click', openAdmin);
document.getElementById('admin-close').addEventListener('click', closeAdmin);
overlay.addEventListener('click', (e) => { if(e.target === overlay) closeAdmin(); });

function openAdmin(){
  overlay.hidden = false;
  resetAdminViews();

  const owner = localStorage.getItem(LS_KEYS.owner);
  const repo = localStorage.getItem(LS_KEYS.repo);
  const token = localStorage.getItem(LS_KEYS.token);

  if(owner && repo && token){
    showMainView();
  }else{
    showLoginView();
  }
}

function closeAdmin(){
  overlay.hidden = true;
}

function resetAdminViews(){
  loginView.hidden = true;
  tokenView.hidden = true;
  mainView.hidden = true;
  document.getElementById('admin-login-error').hidden = true;
  document.getElementById('gh-token-error').hidden = true;
  document.getElementById('admin-status').hidden = true;
  document.getElementById('admin-password').value = '';
}

function showLoginView(){
  resetAdminViews();
  loginView.hidden = false;
  document.getElementById('admin-password').focus();
}

function showTokenView(){
  resetAdminViews();
  tokenView.hidden = false;
  document.getElementById('gh-owner').value = localStorage.getItem(LS_KEYS.owner) || '';
  document.getElementById('gh-repo').value = localStorage.getItem(LS_KEYS.repo) || '';
}

function showMainView(){
  resetAdminViews();
  mainView.hidden = false;
  renderAdminList();
}

/* ---- Şifre girişi ----
   NOT: Bu istemci-taraflı bir kontrol, gerçek bir güvenlik sınırı değildir.
   Sadece paneli tesadüfen gezinenlerden gizler. Asıl koruma GitHub token'ında. */
const ADMIN_PASSWORD = 'JulesVerne'; // <-- 

document.getElementById('admin-login-btn').addEventListener('click', () => {
  const pw = document.getElementById('admin-password').value;
  const errEl = document.getElementById('admin-login-error');
  if(pw === ADMIN_PASSWORD){
    const owner = localStorage.getItem(LS_KEYS.owner);
    const repo = localStorage.getItem(LS_KEYS.repo);
    const token = localStorage.getItem(LS_KEYS.token);
    if(owner && repo && token){
      showMainView();
    }else{
      showTokenView();
    }
  }else{
    errEl.textContent = 'Şifre yanlış.';
    errEl.hidden = false;
  }
});
document.getElementById('admin-password').addEventListener('keydown', (e) => {
  if(e.key === 'Enter') document.getElementById('admin-login-btn').click();
});

/* ---- Token kaydetme ---- */

document.getElementById('gh-save-btn').addEventListener('click', () => {
  const owner = document.getElementById('gh-owner').value.trim();
  const repo = document.getElementById('gh-repo').value.trim();
  const token = document.getElementById('gh-token').value.trim();
  const errEl = document.getElementById('gh-token-error');

  if(!owner || !repo || !token){
    errEl.textContent = 'Lütfen üç alanı da doldur.';
    errEl.hidden = false;
    return;
  }

  localStorage.setItem(LS_KEYS.owner, owner);
  localStorage.setItem(LS_KEYS.repo, repo);
  localStorage.setItem(LS_KEYS.token, token);

  showMainView();
});

document.getElementById('gh-forget-btn').addEventListener('click', () => {
  if(confirm('Bu tarayıcıda kayıtlı GitHub bilgilerini silmek istediğine emin misin?')){
    localStorage.removeItem(LS_KEYS.owner);
    localStorage.removeItem(LS_KEYS.repo);
    localStorage.removeItem(LS_KEYS.token);
    showLoginView();
  }
});

/* ---- Admin liste görünümü (silme) ---- */

function renderAdminList(){
  const listEl = document.getElementById('admin-list');
  const countEl = document.getElementById('admin-count');
  const searchVal = normalize(document.getElementById('admin-search').value);

  countEl.textContent = `(${allBooks.length})`;

  let list = allBooks;
  if(searchVal){
    list = allBooks.filter(b =>
      normalize(b.title).includes(searchVal) ||
      normalize(b.author).includes(searchVal) ||
      normalize(b.publisher).includes(searchVal)
    );
  }

  listEl.innerHTML = '';
  const frag = document.createDocumentFragment();
  for(const book of list.slice(0, 200)){ // performans için sınırlı göster
    const row = document.createElement('div');
    row.className = 'admin-list-row';
    row.innerHTML = `
      <div class="admin-list-row-text">
        <div class="admin-list-row-title">${escapeHtml(book.title)}</div>
        <div class="admin-list-row-meta">${escapeHtml(book.author || '—')} · ${escapeHtml(book.publisher || '—')}</div>
      </div>
      <button class="admin-delete-btn" data-id="${book.id}">Sil</button>
    `;
    frag.appendChild(row);
  }
  listEl.appendChild(frag);

  listEl.querySelectorAll('.admin-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => handleDelete(Number(btn.dataset.id)));
  });
}

document.getElementById('admin-search').addEventListener('input', renderAdminList);

/* ---- Kitap ekleme ---- */

document.getElementById('add-book-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('new-title').value.trim();
  const author = document.getElementById('new-author').value.trim();
  const publisher = document.getElementById('new-publisher').value.trim();

  if(!title) return;

  const nextId = allBooks.length ? Math.max(...allBooks.map(b => b.id)) + 1 : 1;
  const newBook = { id: nextId, title, author, publisher };
  const updated = [...allBooks, newBook];

  const ok = await saveToGitHub(updated, `Kitap eklendi: ${title}`);
  if(ok){
    allBooks = updated;
    document.getElementById('add-book-form').reset();
    renderAdminList();
    renderCatalog();
    updateFooter();
  }
});

/* ---- Kitap silme ---- */

async function handleDelete(id){
  const book = allBooks.find(b => b.id === id);
  if(!book) return;
  if(!confirm(`"${book.title}" kitabını silmek istediğine emin misin?`)) return;

  const updated = allBooks.filter(b => b.id !== id);
  const ok = await saveToGitHub(updated, `Kitap silindi: ${book.title}`);
  if(ok){
    allBooks = updated;
    renderAdminList();
    renderCatalog();
    updateFooter();
  }
}

/* ---- GitHub API ile kaydetme ---- */

function setStatus(msg, type){
  const el = document.getElementById('admin-status');
  el.textContent = msg;
  el.className = `admin-status ${type}`;
  el.hidden = false;
}

async function fetchCurrentSha(owner, repo, token){
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/books.json`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json'
    }
  });
  if(!res.ok){
    throw new Error(`Dosya bilgisi alınamadı (${res.status})`);
  }
  const data = await res.json();
  return data.sha;
}

async function saveToGitHub(updatedBooks, commitMessage){
  const owner = localStorage.getItem(LS_KEYS.owner);
  const repo = localStorage.getItem(LS_KEYS.repo);
  const token = localStorage.getItem(LS_KEYS.token);

  if(!owner || !repo || !token){
    setStatus('GitHub bağlantı bilgileri eksik. Lütfen tekrar bağlan.', 'err');
    showTokenView();
    return false;
  }

  setStatus('Kaydediliyor…', 'pending');

  try{
    const sha = await fetchCurrentSha(owner, repo, token);

    const jsonStr = JSON.stringify(updatedBooks, null, 2);
    // UTF-8 güvenli base64 encode
    const base64Content = btoa(unescape(encodeURIComponent(jsonStr)));

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/books.json`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: commitMessage,
        content: base64Content,
        sha: sha
      })
    });

    if(!res.ok){
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.message || `GitHub API hatası (${res.status})`);
    }

    setStatus('Kaydedildi. Site birkaç dakika içinde güncellenecek.', 'ok');
    return true;

  }catch(err){
    console.error(err);
    setStatus(`Hata: ${err.message}`, 'err');
    return false;
  }
}

/* ---------------- Başlat ---------------- */

loadBooks();

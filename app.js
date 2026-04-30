// ─── FIREBASE CONFIG ─────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, increment, query, orderBy, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyAHKJ4qw9oDEZ2zhsBRB-0G0SaW6zkImNU",
  authDomain:        "mensaje-para-profesores.firebaseapp.com",
  projectId:         "mensaje-para-profesores",
  storageBucket:     "mensaje-para-profesores.firebasestorage.app",
  messagingSenderId: "93773928576",
  appId:             "1:93773928576:web:f2d20b7ecd11e284e2ee65"
};

const firebaseApp = initializeApp(firebaseConfig);
const db          = getFirestore(firebaseApp);
// ─────────────────────────────────────────────────────────────────

// ─── CONFIGURACIÓN SHEET CSV ─────────────────────────────────────
const SHEET_CSV_URL = 'TU_URL_AQUÍ';
// ─────────────────────────────────────────────────────────────────

let PROFESORES  = [];
let allMensajes = [];
let likedIds    = new Set(JSON.parse(localStorage.getItem('liked') || '[]'));

const POSTIT_COLORS = ['#fde87c','#ffb3c6','#b5f0d3','#a8d8f8','#d4c5f9','#ffc9a8'];
let selectedColor   = POSTIT_COLORS[0];
const ROTATIONS     = [-3, -2, -1, 0, 1, 2, 3, -2.5, 1.5, -1.5];

// ─── INIT ───
document.addEventListener('DOMContentLoaded', async () => {
  buildSwatches();
  await loadProfesores();
  listenMessages();
});

// ─── ESCUCHAR MENSAJES APROBADOS EN TIEMPO REAL ───
function listenMessages() {
  const q = query(collection(db, 'mensajes'), orderBy('createdAt', 'desc'));
  onSnapshot(q, snapshot => {
    allMensajes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderBoard(allMensajes);
  });
}

// ─── RENDER BOARD ───
function renderBoard(list) {
  const board = document.getElementById('board');
  const empty = document.getElementById('empty-state');
  const q     = document.getElementById('search').value.toLowerCase().trim();
  const filtered = q ? list.filter(m => (m.profeNombre || '').toLowerCase().includes(q)) : list;

  board.innerHTML = '';
  if (filtered.length === 0) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  filtered.forEach((m, i) => {
    const profe = PROFESORES.find(p => p.nombre === m.profeNombre) || { nombre: m.profeNombre, materia: '' };
    const liked = likedIds.has(m.id);
    const card  = document.createElement('div');
    card.className = 'postit';
    card.style.background     = m.color || POSTIT_COLORS[i % POSTIT_COLORS.length];
    card.style.transform      = `rotate(${ROTATIONS[i % ROTATIONS.length]}deg)`;
    card.style.animationDelay = `${i * 0.05}s`;
    card.innerHTML = `
      <div class="postit-teacher">${escapeHtml(profe.nombre)}</div>
      ${profe.materia ? `<div class="postit-subject">${escapeHtml(profe.materia)}</div>` : ''}
      <div class="postit-msg">${escapeHtml(m.texto)}</div>
      <div class="postit-footer">
        <div class="postit-from">${escapeHtml(m.desde)}</div>
        <button class="heart-btn${liked ? ' liked' : ''}" onclick="toggleLike('${m.id}', this)" aria-label="Me gusta">
          <span class="heart-icon">${liked ? '❤️' : '🤍'}</span>
          <span class="heart-count">${m.likes || 0}</span>
        </button>
      </div>`;
    board.appendChild(card);
  });
}

// ─── LIKE / UNLIKE ───
async function toggleLike(id, btn) {
  const alreadyLiked = likedIds.has(id);
  const delta = alreadyLiked ? -1 : 1;
  const icon  = btn.querySelector('.heart-icon');
  const count = btn.querySelector('.heart-count');
  count.textContent = Math.max(0, (parseInt(count.textContent) || 0) + delta);
  if (alreadyLiked) { likedIds.delete(id); btn.classList.remove('liked'); icon.textContent = '🤍'; }
  else              { likedIds.add(id);    btn.classList.add('liked');    icon.textContent = '❤️'; }
  localStorage.setItem('liked', JSON.stringify([...likedIds]));
  try { await updateDoc(doc(db, 'mensajes', id), { likes: increment(delta) }); }
  catch(e) { console.error('Error like:', e); }
}

// ─── FILTER ───
function filterMessages() { renderBoard(allMensajes); }

// ─── ENVIAR MENSAJE (va a "pendientes", no directo a "mensajes") ───
async function sendMessage() {
  const profeNombre = document.getElementById('f-profe').value.trim();
  const desde       = document.getElementById('f-nombre').value.trim() || 'Anónimo';
  const texto       = document.getElementById('f-mensaje').value.trim();

  if (!profeNombre) { showToast('Por favor elige o escribe el nombre del profesor ✦'); return; }
  if (!texto)       { showToast('El mensaje no puede estar vacío'); return; }

  const btn = document.querySelector('.btn-send');
  btn.disabled = true;
  btn.textContent = 'Enviando…';

  try {
    await addDoc(collection(db, 'pendientes'), {
      profeNombre,
      desde,
      texto,
      color: selectedColor,
      createdAt: serverTimestamp()
    });
    document.getElementById('f-nombre').value  = '';
    document.getElementById('f-mensaje').value = '';
    document.getElementById('f-profe').value   = '';
    showToast('¡Mensaje enviado! Pronto aparecerá en el tablero ✨');
  } catch(e) {
    console.error('Error enviando:', e);
    showToast('Hubo un error, intenta de nuevo.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Enviar mensaje ✦';
  }
}

// ─── CARGAR PROFESORES ───
async function loadProfesores() {
  const loadingEl = document.getElementById('select-loading');
  if (!SHEET_CSV_URL || SHEET_CSV_URL === 'TU_URL_AQUÍ') {
    PROFESORES = [
      { nombre: 'Profesora García',    materia: 'Matemáticas' },
      { nombre: 'Profesor Martínez',   materia: 'Ciencias Naturales' },
      { nombre: 'Profesora López',     materia: 'Lengua y Literatura' },
      { nombre: 'Profesor Rodríguez',  materia: 'Historia' },
      { nombre: 'Profesora Torres',    materia: 'Artes' },
      { nombre: 'Profesor Ramírez',    materia: 'Filosofía' },
    ];
    if (loadingEl) loadingEl.remove();
    populateDatalist();
    return;
  }
  try {
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(SHEET_CSV_URL)}`;
    const res   = await fetch(proxy);
    const json  = await res.json();
    PROFESORES  = parseCSV(json.contents);
    if (loadingEl) loadingEl.remove();
    populateDatalist();
  } catch(e) {
    console.error('Error cargando profesores:', e);
    if (loadingEl) loadingEl.textContent = '⚠ No se pudo cargar la lista.';
  }
}

// ─── DATALIST (campo de texto con sugerencias) ───
function populateDatalist() {
  const dl = document.getElementById('profesores-list');
  if (!dl) return;
  dl.innerHTML = '';
  PROFESORES.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.nombre;
    opt.label = p.materia || '';
    dl.appendChild(opt);
  });
}

// ─── SWATCHES ───
function buildSwatches() {
  const wrap = document.getElementById('swatches');
  POSTIT_COLORS.forEach(c => {
    const s = document.createElement('div');
    s.className = 'swatch' + (c === selectedColor ? ' active' : '');
    s.style.background = c;
    s.onclick = () => {
      selectedColor = c;
      document.querySelectorAll('.swatch').forEach(el => el.classList.remove('active'));
      s.classList.add('active');
    };
    wrap.appendChild(s);
  });
}

// ─── TOAST ───
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.filterMessages = filterMessages;
window.sendMessage    = sendMessage;
window.toggleLike     = toggleLike;

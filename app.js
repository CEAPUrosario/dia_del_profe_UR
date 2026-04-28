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
// 👇 Pega aquí tu URL de Google Sheets exportada como CSV
const SHEET_CSV_URL = 'TU_URL_AQUÍ';
// ─────────────────────────────────────────────────────────────────

let PROFESORES   = [];
let allMensajes  = []; // cache local del snapshot
let likedIds     = new Set(JSON.parse(localStorage.getItem('liked') || '[]'));

const POSTIT_COLORS = ['#fde87c','#ffb3c6','#b5f0d3','#a8d8f8','#d4c5f9','#ffc9a8'];
let selectedColor   = POSTIT_COLORS[0];
const ROTATIONS     = [-3, -2, -1, 0, 1, 2, 3, -2.5, 1.5, -1.5];

// ─── INIT ───
document.addEventListener('DOMContentLoaded', async () => {
  buildSwatches();
  await loadProfesores();
  listenMessages();   // escucha Firestore en tiempo real
});

// ─── FIRESTORE: escuchar mensajes en tiempo real ───
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

  const filtered = q
    ? list.filter(m => (m.profeNombre || '').toLowerCase().includes(q))
    : list;

  board.innerHTML = '';

  if (filtered.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  filtered.forEach((m, i) => {
    const profe  = PROFESORES.find(p => p.nombre === m.profeNombre) || { nombre: m.profeNombre, materia: '' };
    const rot    = ROTATIONS[i % ROTATIONS.length];
    const liked  = likedIds.has(m.id);
    const likes  = m.likes || 0;

    const card = document.createElement('div');
    card.className = 'postit';
    card.style.background     = m.color || POSTIT_COLORS[i % POSTIT_COLORS.length];
    card.style.transform      = `rotate(${rot}deg)`;
    card.style.animationDelay = `${i * 0.05}s`;
    card.innerHTML = `
      <div class="postit-teacher">${escapeHtml(profe.nombre)}</div>
      ${profe.materia ? `<div class="postit-subject">${escapeHtml(profe.materia)}</div>` : ''}
      <div class="postit-msg">${escapeHtml(m.texto)}</div>
      <div class="postit-footer">
        <div class="postit-from">${escapeHtml(m.desde)}</div>
        <button class="heart-btn${liked ? ' liked' : ''}" onclick="toggleLike('${m.id}', this)" aria-label="Me gusta">
          <span class="heart-icon">${liked ? '❤️' : '🤍'}</span>
          <span class="heart-count">${likes}</span>
        </button>
      </div>`;
    board.appendChild(card);
  });
}

// ─── LIKE / UNLIKE ───
async function toggleLike(id, btn) {
  const alreadyLiked = likedIds.has(id);
  const ref   = doc(db, 'mensajes', id);
  const delta = alreadyLiked ? -1 : 1;

  // Optimistic UI
  const icon  = btn.querySelector('.heart-icon');
  const count = btn.querySelector('.heart-count');
  const cur   = parseInt(count.textContent) || 0;
  count.textContent = Math.max(0, cur + delta);
  if (alreadyLiked) {
    likedIds.delete(id);
    btn.classList.remove('liked');
    icon.textContent = '🤍';
  } else {
    likedIds.add(id);
    btn.classList.add('liked');
    icon.textContent = '❤️';
  }
  localStorage.setItem('liked', JSON.stringify([...likedIds]));

  try {
    await updateDoc(ref, { likes: increment(delta) });
  } catch (e) {
    console.error('Error actualizando like:', e);
  }
}

// ─── FILTER ───
function filterMessages() {
  renderBoard(allMensajes);
}

// ─── SEND MESSAGE ───
async function sendMessage() {
  const profeNombre = document.getElementById('f-profe').value;
  const desde       = document.getElementById('f-nombre').value.trim() || 'Anónimo';
  const texto       = document.getElementById('f-mensaje').value.trim();

  if (!profeNombre) { showToast('Por favor elige un profesor ✦'); return; }
  if (!texto)       { showToast('El mensaje no puede estar vacío'); return; }

  const btn = document.querySelector('.btn-send');
  btn.disabled = true;
  btn.textContent = 'Enviando…';

  try {
    await addDoc(collection(db, 'mensajes'), {
      profeNombre,
      desde,
      texto,
      color: selectedColor,
      likes: 0,
      createdAt: serverTimestamp()
    });

    document.getElementById('f-nombre').value  = '';
    document.getElementById('f-mensaje').value = '';
    document.getElementById('f-profe').value   = '';
    showToast('¡Mensaje enviado! ✨');
    setTimeout(() => document.getElementById('mensajes').scrollIntoView({ behavior: 'smooth' }), 300);
  } catch (e) {
    console.error('Error enviando mensaje:', e);
    showToast('Hubo un error, intenta de nuevo.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Enviar mensaje ✦';
  }
}

// ─── CARGAR PROFESORES DESDE GOOGLE SHEETS ───
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
    populateSelect();
    return;
  }
  try {
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(SHEET_CSV_URL)}`;
    const res   = await fetch(proxy);
    const json  = await res.json();
    PROFESORES  = parseCSV(json.contents);
    if (loadingEl) loadingEl.remove();
    populateSelect();
  } catch (e) {
    console.error('Error cargando profesores:', e);
    if (loadingEl) loadingEl.textContent = '⚠ No se pudo cargar la lista.';
  }
}

function parseCSV(csv) {
  return csv.trim().split('\n').slice(1).map(line => {
    const cols = splitCSVLine(line);
    const nombre  = (cols[0] || '').trim();
    const materia = (cols[1] || '').trim();
    return nombre ? { nombre, materia } : null;
  }).filter(Boolean);
}

function splitCSVLine(line) {
  const result = []; let cur = '', inQuotes = false;
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ',' && !inQuotes) { result.push(cur); cur = ''; }
    else cur += ch;
  }
  result.push(cur);
  return result;
}

function populateSelect() {
  const sel = document.getElementById('f-profe');
  while (sel.options.length > 1) sel.remove(1);
  PROFESORES.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.nombre;
    opt.textContent = p.materia ? `${p.nombre} · ${p.materia}` : p.nombre;
    sel.appendChild(opt);
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
  setTimeout(() => t.classList.remove('show'), 2600);
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Exponer funciones al HTML
window.filterMessages = filterMessages;
window.sendMessage    = sendMessage;
window.toggleLike     = toggleLike;

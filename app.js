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

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTQ1qABPJ1JsLscAM1rVowVwSZQqvDMs2M1pCUOAHSS15tm5_JPxgyR6pPZ-bknvQ/pub?gid=1785077199&output=csv';

// ─── VARIABLES GLOBALES ──────────────────────────────────────────
let PROFESORES  = [];
let allMensajes = [];
let likedIds    = new Set(JSON.parse(localStorage.getItem('liked') || '[]'));

// NUEVO: Variables para controlar la navegación de 12 en 12
let currentPage = 0;
const messagesPerPage = 12;

const POSTIT_COLORS = ['#fde87c','#ffb3c6','#b5f0d3','#a8d8f8','#d4c5f9','#ffc9a8'];
let selectedColor   = POSTIT_COLORS[0];
const ROTATIONS     = [-3, -2, -1, 0, 1, 2, 3, -2.5, 1.5, -1.5];

// ─── INIT ───
document.addEventListener('DOMContentLoaded', async () => {
  buildSwatches();
  await loadProfesores();
  listenMessages();
});

// ─── ESCUCHAR MENSAJES APROBADOS ───
function listenMessages() {
  const q = query(collection(db, 'mensajes'), orderBy('createdAt', 'desc'));
  onSnapshot(q, snapshot => {
    allMensajes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderBoard(allMensajes);
  });
}

// ─── RENDER BOARD (MODIFICADO PARA PAGINACIÓN) ───
function renderBoard(list) {
  const board = document.getElementById('board');
  const empty = document.getElementById('empty-state');
  const q     = document.getElementById('search').value.toLowerCase().trim();
  
  const filtered = q ? list.filter(m => (m.profeNombre || '').toLowerCase().includes(q)) : list;

  board.innerHTML = '';
  if (filtered.length === 0) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  const start = currentPage * messagesPerPage;
  const end   = start + messagesPerPage;
  const currentMessages = filtered.slice(start, end);

  currentMessages.forEach((m, i) => {
    // REINTRODUCE ESTA LÍNEA:
    const profe = PROFESORES.find(p => p.nombre === m.profeNombre) || { nombre: m.profeNombre, materia: '' };
    
    const liked = likedIds.has(m.id);
    const card  = document.createElement('div');
    card.className = 'postit';
    card.style.background     = m.color || POSTIT_COLORS[i % POSTIT_COLORS.length];
    card.style.transform      = `rotate(${ROTATIONS[i % ROTATIONS.length]}deg) scale(0.98)`; // Pequeño ajuste visual para el slider
    
    card.innerHTML = `
      <div class="postit-teacher">${escapeHtml(profe.nombre)}</div>
      <div class="postit-msg">${escapeHtml(m.texto)}</div>
      <div class="postit-footer">
        <div class="postit-from">${escapeHtml(m.desde)}</div>
        <button class="heart-btn${liked ? ' liked' : ''}" onclick="toggleLike('${m.id}', this)">
          <span class="heart-icon">${liked ? '❤️' : '🤍'}</span>
          <span class="heart-count">${m.likes || 0}</span>
        </button>
      </div>`;
    board.appendChild(card);
  });
}
// NUEVO: Función para cambiar de página (usada por los triángulos)
window.changePage = (direction) => {
  const q = document.getElementById('search').value.toLowerCase().trim();
  const filtered = q ? allMensajes.filter(m => (m.profeNombre || '').toLowerCase().includes(q)) : allMensajes;
  
  const totalPages = Math.ceil(filtered.length / messagesPerPage);
  
  currentPage += direction;

  // Evitar salirse de los límites
  if (currentPage < 0) currentPage = 0;
  if (currentPage >= totalPages) currentPage = totalPages - 1;

  renderBoard(allMensajes);
};

// ─── LIKES ───
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

// ─── ENVIAR MENSAJE (CON LÍMITE DE 70 PALABRAS) ───
async function sendMessage() {
  const profeNombre = document.getElementById('f-profe').value.trim();
  const desde       = document.getElementById('f-nombre').value.trim() || 'Anónimo';
  const texto       = document.getElementById('f-mensaje').value.trim();

  // NUEVO: Validación de 70 palabras
  const palabras = texto.split(/\s+/).filter(p => p.length > 0);
  if (palabras.length > 70) {
    showToast(`Mensaje muy largo (${palabras.length} palabras). Máximo 70.`);
    return;
  }

  if (!profeNombre || !texto) { showToast('Completa los campos obligatorios ✦'); return; }

  const btn = document.querySelector('.btn-send');
  btn.disabled = true;
  btn.textContent = 'Enviando…';

  try {
    await addDoc(collection(db, 'pendientes'), {
      profeNombre, desde, texto,
      color: selectedColor,
      createdAt: serverTimestamp()
    });
    document.getElementById('f-nombre').value  = '';
    document.getElementById('f-mensaje').value = '';
    document.getElementById('f-profe').value   = '';
    showToast('¡Enviado! Espera la moderación ✨');
  } catch(e) {
    showToast('Error al enviar.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Enviar mensaje ✦';
  }
}

// ─── CARGAR PROFESORES Y PARSEAR CSV ───
async function loadProfesores() {
  const loadingEl = document.getElementById('select-loading');
  try {
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(SHEET_CSV_URL)}&timestamp=${Date.now()}`;
    const res = await fetch(proxy);
    const json = await res.json();
    PROFESORES = parseCSV(json.contents);
    if (loadingEl) loadingEl.remove();
    populateDatalist();
  } catch (e) {
    console.error("Fallo carga:", e);
  }
}

function parseCSV(text) {
  const lines = text.split('\n').slice(1);
  return lines.map(line => {
    const columns = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    return {
      nombre: columns[0]?.replace(/"/g, '').trim(),
      materia: columns[1]?.replace(/"/g, '').trim()
    };
  }).filter(p => p.nombre);
}

function populateDatalist() {
  const dl = document.getElementById('profesores-list');
  if (!dl) return;
  dl.innerHTML = PROFESORES.map(p => `<option value="${p.nombre}">${p.materia || ''}</option>`).join('');
}

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

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Funciones globales
window.filterMessages = () => {
    currentPage = 0; // Reiniciar página al buscar
    renderBoard(allMensajes);
};
window.sendMessage    = sendMessage;
window.toggleLike     = toggleLike;

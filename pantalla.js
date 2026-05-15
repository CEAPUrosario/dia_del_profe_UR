// ─── FIREBASE ────────────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, orderBy }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyAHKJ4qw9oDEZ2zhsBRB-0G0SaW6zkImNU",
  authDomain:        "mensaje-para-profesores.firebaseapp.com",
  projectId:         "mensaje-para-profesores",
  storageBucket:     "mensaje-para-profesores.firebasestorage.app",
  messagingSenderId: "93773928576",
  appId:             "1:93773928576:web:f2d20b7ecd11e284e2ee65"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
// ─────────────────────────────────────────────────────────────────

const POSTIT_COLORS = ['#fde87c','#ffb3c6','#b5f0d3','#a8d8f8','#d4c5f9','#ffc9a8'];
const ROTATIONS     = [-3, -2, -1, 0, 1, 2, 3, -2.5, 1.5, -1.5];
const SEGUNDOS_POR_HOJA = 20;

let allMensajes      = [];
let filteredMensajes = [];
let searchTerm       = '';

let currentPage  = 0;
let totalPages   = 1;
let rotateTimer  = null;

// ─── ESCUCHAR MENSAJES EN TIEMPO REAL ───
const q = query(collection(db, 'mensajes'), orderBy('createdAt', 'desc'));

onSnapshot(q, snapshot => {
  allMensajes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  applyFilter();
});

// ─── FILTRAR MENSAJES ───
function applyFilter() {
  const term = searchTerm.trim().toLowerCase();

  if (!term) {
    filteredMensajes = [...allMensajes];
  } else {
    filteredMensajes = allMensajes.filter(m =>
      (m.profeNombre || '').toLowerCase().includes(term) ||
      (m.desde || '').toLowerCase().includes(term)
    );
  }

  document.getElementById('msg-count').textContent = filteredMensajes.length;

  currentPage = 0;
  renderPage();
  startRotation();
  updateProgressBar();
}

// ─── RENDERIZAR PÁGINA ACTUAL ───
function renderPage() {
  const board = document.getElementById('pantalla-board');

  if (filteredMensajes.length === 0) {
    board.innerHTML = '<div class="pantalla-empty">Aún no hay mensajes… ¡sé el primero! ✦</div>';
    return;
  }

  // Calcular cuántas tarjetas caben midiendo el espacio disponible
  const boardH    = board.clientHeight || window.innerHeight - 220;
  const boardW    = board.clientWidth  || window.innerWidth  - 64;
  const cardH     = 200;
  const cardW     = 260;

  const cols      = Math.max(1, Math.floor(boardW / (cardW + 18)));
  const rows      = Math.max(1, Math.floor(boardH / (cardH + 18)));
  const perPage   = cols * rows;

  totalPages = Math.max(1, Math.ceil(filteredMensajes.length / perPage));

  // Asegurar que currentPage no se salga
  if (currentPage >= totalPages) currentPage = 0;

  const start = currentPage * perPage;
  const slice = filteredMensajes.slice(start, start + perPage);

  // Actualizar indicador de hoja
  document.getElementById('page-indicator').textContent =
    totalPages > 1 ? `Hoja ${currentPage + 1} de ${totalPages}` : '';

  // Renderizar tarjetas con animación de salida/entrada
  board.style.opacity = '0';
  board.style.transition = 'opacity 0.5s';

  setTimeout(() => {
    board.innerHTML = '';

    slice.forEach((m, i) => {
      const card = document.createElement('div');

      card.className = 'postit';
      card.dataset.id = m.id;

      card.style.background     = m.color || POSTIT_COLORS[i % POSTIT_COLORS.length];
      card.style.transform      = `rotate(${ROTATIONS[i % ROTATIONS.length]}deg)`;
      card.style.animationDelay = `${i * 0.04}s`;

      card.innerHTML = `
        <div class="postit-teacher">${escapeHtml(m.profeNombre)}</div>

        <div class="postit-msg">
          ${escapeHtml(m.texto)}
        </div>

        <div class="postit-footer">
          <div class="postit-from">${escapeHtml(m.desde)}</div>

          ${m.likes ? `<span style="font-size:13px;opacity:0.6">❤️ ${m.likes}</span>` : ''}
        </div>
      `;

      board.appendChild(card);
    });

    board.style.opacity = '1';
  }, 400);
}

// ─── ROTACIÓN AUTOMÁTICA CADA 20 SEGUNDOS ───
function startRotation() {
  if (rotateTimer) clearInterval(rotateTimer);

  if (totalPages <= 1) return;

  rotateTimer = setInterval(() => {
    currentPage = (currentPage + 1) % totalPages;

    renderPage();
    updateProgressBar();

  }, SEGUNDOS_POR_HOJA * 1000);
}

// ─── BARRA DE PROGRESO ───
function updateProgressBar() {
  const bar = document.getElementById('progress-bar');

  if (!bar) return;

  bar.style.transition = 'none';
  bar.style.width = '0%';

  setTimeout(() => {
    bar.style.transition = `width ${SEGUNDOS_POR_HOJA}s linear`;
    bar.style.width = '100%';
  }, 50);
}

// Re-calcular al redimensionar ventana
window.addEventListener('resize', () => {
  currentPage = 0;
  renderPage();
});

// ─── BUSCADOR ───
const searchInput = document.getElementById('search-input');

searchInput.addEventListener('input', (e) => {
  searchTerm = e.target.value;
  applyFilter();
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

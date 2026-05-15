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

const POSTIT_COLORS     = ['#fde87c','#ffb3c6','#b5f0d3','#a8d8f8','#d4c5f9','#ffc9a8'];
const ROTATIONS         = [-3, -2, -1, 0, 1, 2, 3, -2.5, 1.5, -1.5];
const SEGUNDOS_POR_HOJA = 60; // ← cambiado de 20 a 60 segundos

let allMensajes      = [];
let filteredMensajes = [];
let searchTerm       = '';

let currentPage = 0;
let totalPages  = 1;
let perPageLast = 0;
let rotateTimer = null;

// ─── DOM refs ───
const board         = document.getElementById('pantalla-board');
const msgCount      = document.getElementById('msg-count');
const pageIndicator = document.getElementById('page-indicator');
const progressBar   = document.getElementById('progress-bar');
const btnPrev       = document.getElementById('btn-prev');
const btnNext       = document.getElementById('btn-next');
const searchInput   = document.getElementById('search-input');

// Modal refs
const modalOverlay  = document.getElementById('modal-overlay');
const modalCard     = document.getElementById('modal-card');
const modalTeacher  = document.getElementById('modal-teacher');
const modalMsg      = document.getElementById('modal-msg');
const modalFrom     = document.getElementById('modal-from');
const modalClose    = document.getElementById('modal-close');

// ─── FIREBASE: escuchar mensajes en tiempo real ───
const q = query(collection(db, 'mensajes'), orderBy('createdAt', 'desc'));

onSnapshot(q, snapshot => {
  allMensajes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  applyFilter();
});

// ─── FILTRAR ───
function applyFilter() {
  const term = searchTerm.trim().toLowerCase();

  filteredMensajes = term
    ? allMensajes.filter(m =>
        (m.profeNombre || '').toLowerCase().includes(term) ||
        (m.desde       || '').toLowerCase().includes(term))
    : [...allMensajes];

  msgCount.textContent = filteredMensajes.length;

  currentPage = 0;
  renderPage();
  startRotation();
  updateProgressBar();
}

// ─── CALCULAR cuántas tarjetas caben ───
function calcPerPage() {
  // Usar offsetHeight del body menos header y footer para evitar que
  // board.clientHeight devuelva 0 en algunos momentos
  const header  = document.querySelector('.pantalla-header');
  const footer  = document.querySelector('.pantalla-footer');
  const boardH  = window.innerHeight
                  - (header ? header.offsetHeight : 80)
                  - (footer ? footer.offsetHeight : 50)
                  - 16; // padding

  const boardW  = board.clientWidth || window.innerWidth - 56;

  const cardMinW = 240;
  const cardMinH = 160; // altura promedio real de un post-it con texto

  const cols = Math.max(1, Math.floor((boardW + 16) / (cardMinW + 16)));
  const rows = Math.max(1, Math.floor((boardH + 16) / (cardMinH + 16)));

  return cols * rows;
}

// ─── RENDERIZAR PÁGINA ACTUAL ───
function renderPage() {
  if (filteredMensajes.length === 0) {
    board.innerHTML = '<div class="pantalla-empty">Aún no hay mensajes… ¡sé el primero! ✦</div>';
    updateNavButtons();
    return;
  }

  const perPage = calcPerPage();
  totalPages    = Math.max(1, Math.ceil(filteredMensajes.length / perPage));

  if (currentPage >= totalPages) currentPage = 0;

  const start = currentPage * perPage;
  const slice = filteredMensajes.slice(start, start + perPage);

  pageIndicator.textContent = totalPages > 1
    ? `Hoja ${currentPage + 1} de ${totalPages}`
    : '';

  updateNavButtons();

  board.style.opacity    = '0';
  board.style.transition = 'opacity 0.45s ease';

  setTimeout(() => {
    board.innerHTML = '';

    slice.forEach((m, i) => {
      const card = document.createElement('div');
      card.className = 'postit';
      card.dataset.id = m.id;

      const bg = m.color || POSTIT_COLORS[i % POSTIT_COLORS.length];
      card.style.background     = bg;
      card.style.transform      = `rotate(${ROTATIONS[i % ROTATIONS.length]}deg)`;
      card.style.animationDelay = `${i * 0.04}s`;

      card.innerHTML = `
        <div class="postit-teacher">${escapeHtml(m.profeNombre)}</div>
        <div class="postit-msg">${escapeHtml(m.texto)}</div>
        <div class="postit-footer">
          <div class="postit-from">${escapeHtml(m.desde)}</div>
          ${m.likes ? `<span style="font-size:13px;opacity:0.6">❤️ ${m.likes}</span>` : ''}
        </div>
      `;

      card.addEventListener('click', () => openModal(m, bg));
      board.appendChild(card);
    });

    board.style.opacity = '1';
  }, 380);
}

// ─── ACTUALIZAR BOTONES DE NAVEGACIÓN ───
function updateNavButtons() {
  btnPrev.disabled = currentPage === 0;
  btnNext.disabled = currentPage >= totalPages - 1;
}

// ─── NAVEGACIÓN MANUAL ───
btnPrev.addEventListener('click', () => {
  if (currentPage > 0) {
    currentPage--;
    renderPage();
    resetRotation();
  }
});

btnNext.addEventListener('click', () => {
  if (currentPage < totalPages - 1) {
    currentPage++;
    renderPage();
    resetRotation();
  }
});

// ─── ROTACIÓN AUTOMÁTICA CADA 60 SEGUNDOS ───
function startRotation() {
  if (rotateTimer) clearInterval(rotateTimer);
  if (totalPages <= 1) return;

  rotateTimer = setInterval(() => {
    currentPage = (currentPage + 1) % totalPages;
    renderPage();
    updateProgressBar();
  }, SEGUNDOS_POR_HOJA * 1000);
}

function resetRotation() {
  updateProgressBar();
  startRotation();
}

// ─── BARRA DE PROGRESO ───
function updateProgressBar() {
  if (!progressBar) return;

  progressBar.style.transition = 'none';
  progressBar.style.width      = '0%';

  setTimeout(() => {
    progressBar.style.transition = `width ${SEGUNDOS_POR_HOJA}s linear`;
    progressBar.style.width      = '100%';
  }, 50);
}

// ─── BUSCADOR ───
searchInput.addEventListener('input', e => {
  searchTerm = e.target.value;
  applyFilter();
});

// ─── MODAL: abrir ───
function openModal(m, bgColor) {
  modalCard.style.background = bgColor || '#fde87c';
  modalTeacher.textContent   = m.profeNombre || '';
  modalMsg.textContent       = m.texto       || '';
  modalFrom.textContent      = m.desde       ? `— ${m.desde}` : '';

  modalOverlay.classList.add('active');
  document.addEventListener('keydown', onKeyClose);
}

// ─── MODAL: cerrar ───
function closeModal() {
  modalOverlay.classList.remove('active');
  document.removeEventListener('keydown', onKeyClose);
}

function onKeyClose(e) {
  if (e.key === 'Escape') closeModal();
}

modalClose.addEventListener('click', closeModal);

// Cerrar al hacer clic fuera del card
modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) closeModal();
});

// ─── RESPONSIVE: recalcular al redimensionar ───
window.addEventListener('resize', () => {
  currentPage = 0;
  renderPage();
});

// ─── UTILIDAD ───
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}

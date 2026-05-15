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

  currentPage       = 0;
  pageStartIndices  = [0]; // reiniciar mapa de páginas al cambiar filtro
  renderPage();
  startRotation();
  updateProgressBar();
}

// ─── CREAR ELEMENTO DE TARJETA ───
function createCard(m, globalIndex) {
  const card = document.createElement('div');
  card.className = 'postit';
  card.dataset.id = m.id;

  const colorIndex = globalIndex % POSTIT_COLORS.length;
  const bg = m.color || POSTIT_COLORS[colorIndex];

  card.style.background     = bg;
  card.style.transform      = `rotate(${ROTATIONS[globalIndex % ROTATIONS.length]}deg)`;
  card.style.animationDelay = `${(globalIndex % 20) * 0.04}s`;

  card.innerHTML = `
    <div class="postit-teacher">${escapeHtml(m.profeNombre)}</div>
    <div class="postit-msg">${escapeHtml(m.texto)}</div>
    <div class="postit-footer">
      <div class="postit-from">${escapeHtml(m.desde)}</div>
      ${m.likes ? `<span style="font-size:13px;opacity:0.6">❤️ ${m.likes}</span>` : ''}
    </div>
  `;

  card.addEventListener('click', () => openModal(m, bg));
  return card;
}

// ─── PÁGINAS: mapa de índice de inicio por página ───
// Se construye dinámicamente después de medir el DOM real.
let pageStartIndices = [0]; // pageStartIndices[n] = primer índice de filteredMensajes en página n

// ─── RENDERIZAR PÁGINA ACTUAL ───
// Estrategia: renderizar tarjetas una a una, medir si se sale del board,
// detener al primer desborde y guardar ese índice como inicio de la página siguiente.
function renderPage() {
  if (filteredMensajes.length === 0) {
    board.innerHTML = '<div class="pantalla-empty">Aún no hay mensajes… ¡sé el primero! ✦</div>';
    totalPages = 1;
    updateNavButtons();
    return;
  }

  // Asegurar que pageStartIndices tiene entrada para currentPage
  if (!pageStartIndices[currentPage]) pageStartIndices[currentPage] = 0;

  const startIndex = pageStartIndices[currentPage];

  // Fade out
  board.style.transition = 'opacity 0.3s ease';
  board.style.opacity    = '0';

  // Esperar que termine el fade, luego poblar y medir
  setTimeout(() => {
    board.innerHTML = '';

    // Insertar todas las tarjetas de esta página candidate (invisible)
    // Las iremos removiendo si no caben
    const cards = [];
    for (let i = startIndex; i < filteredMensajes.length; i++) {
      const card = createCard(filteredMensajes[i], i);
      card.style.visibility = 'hidden';
      board.appendChild(card);
      cards.push({ card, i });
    }

    // Esperar un frame para que el navegador calcule el layout real
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const boardBottom = board.getBoundingClientRect().bottom;
        let cutAt = -1; // índice donde cortamos

        for (const { card, i } of cards) {
          const cardBottom = card.getBoundingClientRect().bottom;

          if (cardBottom > boardBottom + 4) {
            // A partir de aquí no caben — remover estas y las siguientes
            cutAt = i;
            break;
          }

          // Cabe: hacerla visible
          card.style.visibility = '';
        }

        if (cutAt !== -1) {
          // Remover tarjetas que no caben
          for (const { card, i } of cards) {
            if (i >= cutAt) board.removeChild(card);
          }
          // Guardar inicio de la siguiente página
          if (!pageStartIndices[currentPage + 1]) {
            pageStartIndices[currentPage + 1] = cutAt;
          }
        } else {
          // Todas cupieron — mostrarlas todas
          for (const { card } of cards) card.style.visibility = '';
          pageStartIndices = pageStartIndices.slice(0, currentPage + 1);
        }

        const allFit = cutAt === -1;
        totalPages = allFit
          ? pageStartIndices.length
          : Math.max(pageStartIndices.length, currentPage + 2);

        pageIndicator.textContent = totalPages > 1
          ? `Hoja ${currentPage + 1} de ${totalPages}`
          : '';

        updateNavButtons();

        // Fade in
        board.style.opacity = '1';
      });
    });
  }, 320);
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
    // Si no tenemos el índice de inicio de esta página aún, se calculará al renderizar
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
  currentPage      = 0;
  pageStartIndices = [0];
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

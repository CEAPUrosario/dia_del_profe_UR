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

// Escuchar mensajes aprobados en tiempo real
const q = query(collection(db, 'mensajes'), orderBy('createdAt', 'desc'));
onSnapshot(q, snapshot => {
  const mensajes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  renderBoard(mensajes);
});

function renderBoard(list) {
  const board = document.getElementById('pantalla-board');
  const count = document.getElementById('msg-count');
  count.textContent = list.length;

  if (list.length === 0) {
    board.innerHTML = '<div class="pantalla-empty">Aún no hay mensajes… ¡sé el primero! ✦</div>';
    return;
  }

  // Solo re-renderizar tarjetas nuevas para no perder animaciones
  const existingIds = new Set([...board.querySelectorAll('.postit')].map(el => el.dataset.id));
  const newIds      = new Set(list.map(m => m.id));

  // Eliminar las que ya no están
  board.querySelectorAll('.postit').forEach(el => {
    if (!newIds.has(el.dataset.id)) el.remove();
  });

  // Agregar las nuevas al principio
  list.forEach((m, i) => {
    if (existingIds.has(m.id)) return; // ya existe, no la duplicamos
    const card = document.createElement('div');
    card.className     = 'postit';
    card.dataset.id    = m.id;
    card.style.background     = m.color || POSTIT_COLORS[i % POSTIT_COLORS.length];
    card.style.transform      = `rotate(${ROTATIONS[i % ROTATIONS.length]}deg)`;
    card.style.animationDelay = '0s';
    card.innerHTML = `
      <div class="postit-teacher">${escapeHtml(m.profeNombre)}</div>
      <div class="postit-msg">${escapeHtml(m.texto)}</div>
      <div class="postit-footer">
        <div class="postit-from">${escapeHtml(m.desde)}</div>
        ${m.likes ? `<span style="font-size:13px;opacity:0.6">❤️ ${m.likes}</span>` : ''}
      </div>`;
    board.insertBefore(card, board.firstChild);
  });
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

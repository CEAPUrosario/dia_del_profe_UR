// ─── FIREBASE ────────────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, addDoc, deleteDoc,
         query, orderBy, serverTimestamp }
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

// 🔑 CAMBIA ESTA CONTRASEÑA antes de subir a GitHub
const ADMIN_PASSWORD = 'rosario2025';

let pendientes = [];
let aprobados  = [];
let currentTab = 'pendientes';

// ─── LOGIN ───
function checkPassword() {
  const val = document.getElementById('pwd-input').value;
  if (val === ADMIN_PASSWORD) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-panel').style.display  = 'block';
    startListeners();
  } else {
    document.getElementById('pwd-error').style.display = 'block';
    document.getElementById('pwd-input').value = '';
  }
}

// ─── LISTENERS EN TIEMPO REAL ───
function startListeners() {
  // Pendientes
  onSnapshot(query(collection(db, 'pendientes'), orderBy('createdAt', 'desc')), snap => {
    pendientes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    updateBadges();
    if (currentTab === 'pendientes') renderPendientes();
  });

  // Aprobados
  onSnapshot(query(collection(db, 'mensajes'), orderBy('createdAt', 'desc')), snap => {
    aprobados = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    updateBadges();
    if (currentTab === 'aprobados') renderAprobados();
  });
}

// ─── RENDER PENDIENTES ───
function renderPendientes() {
  const el = document.getElementById('tab-pendientes');
  if (pendientes.length === 0) {
    el.innerHTML = '<div class="admin-empty">No hay mensajes pendientes 🎉</div>';
    return;
  }
  el.innerHTML = pendientes.map(m => `
    <div class="pending-card" id="card-${m.id}">
      <div style="display:flex;align-items:center;margin-top:3px">
        <span class="color-dot" style="background:${m.color || '#fde87c'}"></span>
      </div>
      <div class="pending-card-body">
        <div class="pending-profe">Para: ${escapeHtml(m.profeNombre)}</div>
        <div class="pending-texto">${escapeHtml(m.texto)}</div>
        <div class="pending-desde">— ${escapeHtml(m.desde)}</div>
      </div>
      <div class="pending-actions">
        <button class="btn-approve" onclick="aprobar('${m.id}')">✅ Aprobar</button>
        <button class="btn-reject"  onclick="rechazar('${m.id}')">❌ Rechazar</button>
      </div>
    </div>`).join('');
}

// ─── RENDER APROBADOS ───
function renderAprobados() {
  const el = document.getElementById('tab-aprobados');
  if (aprobados.length === 0) {
    el.innerHTML = '<div class="admin-empty">No hay mensajes aprobados aún.</div>';
    return;
  }
  el.innerHTML = aprobados.map(m => `
    <div class="pending-card" id="aprob-${m.id}">
      <div style="display:flex;align-items:center;margin-top:3px">
        <span class="color-dot" style="background:${m.color || '#fde87c'}"></span>
      </div>
      <div class="pending-card-body">
        <div class="pending-profe">Para: ${escapeHtml(m.profeNombre)}</div>
        <div class="pending-texto">${escapeHtml(m.texto)}</div>
        <div class="pending-desde">— ${escapeHtml(m.desde)} · ❤️ ${m.likes || 0}</div>
      </div>
      <div class="pending-actions">
        <button class="btn-reject" onclick="eliminar('${m.id}')">🗑 Eliminar</button>
      </div>
    </div>`).join('');
}

// ─── APROBAR ───
async function aprobar(id) {
  const m = pendientes.find(p => p.id === id);
  if (!m) return;
  try {
    await addDoc(collection(db, 'mensajes'), {
      profeNombre: m.profeNombre,
      desde:       m.desde,
      texto:       m.texto,
      color:       m.color || '#fde87c',
      likes:       0,
      createdAt:   serverTimestamp()
    });
    await deleteDoc(doc(db, 'pendientes', id));
    showToast('✅ Mensaje aprobado y publicado');
  } catch(e) { console.error(e); showToast('Error al aprobar'); }
}

// ─── RECHAZAR ───
async function rechazar(id) {
  if (!confirm('¿Seguro que quieres rechazar este mensaje?')) return;
  try {
    await deleteDoc(doc(db, 'pendientes', id));
    showToast('Mensaje rechazado');
  } catch(e) { console.error(e); showToast('Error al rechazar'); }
}

// ─── ELIMINAR APROBADO ───
async function eliminar(id) {
  if (!confirm('¿Eliminar este mensaje del tablero público?')) return;
  try {
    await deleteDoc(doc(db, 'mensajes', id));
    showToast('Mensaje eliminado del tablero');
  } catch(e) { console.error(e); showToast('Error al eliminar'); }
}

// ─── TABS ───
function setAdminTab(tab, btn) {
  currentTab = tab;
  document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-pendientes').style.display = tab === 'pendientes' ? '' : 'none';
  document.getElementById('tab-aprobados').style.display  = tab === 'aprobados'  ? '' : 'none';
  if (tab === 'pendientes') renderPendientes();
  else renderAprobados();
}

function updateBadges() {
  document.getElementById('badge-pendientes').textContent = pendientes.length ? `(${pendientes.length})` : '';
  document.getElementById('badge-aprobados').textContent  = aprobados.length  ? `(${aprobados.length})`  : '';
  document.getElementById('admin-counts').textContent =
    `${pendientes.length} pendiente${pendientes.length !== 1 ? 's' : ''} · ${aprobados.length} publicado${aprobados.length !== 1 ? 's' : ''}`;
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

window.checkPassword = checkPassword;
window.setAdminTab   = setAdminTab;
window.aprobar       = aprobar;
window.rechazar      = rechazar;
window.eliminar      = eliminar;

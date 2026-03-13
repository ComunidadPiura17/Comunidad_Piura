// ============================================
//  COMUNIDAD PIURANA — DASHBOARD JS v3
// ============================================

import { auth, db } from '../firebase/config.js';
import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, onSnapshot, query, orderBy, limit,
  addDoc, serverTimestamp, getDocs, doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser     = null;
let currentUserData = null;
let isAdmin         = false;
let countdownInterval = null;

const hoy = new Date();
document.getElementById('fechaHoy').textContent =
  hoy.toLocaleDateString('es-PE', { weekday:'long', day:'numeric', month:'long' });

// ── Countdown fijo: 21 julio 2025 ──
iniciarCountdown(new Date('2026-07-21T23:59:59'));

// ── Auth guard ──
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = '../login/login.html'; return; }
  currentUser = user;
  await loadUserData(user.uid);
  initDashboard();
});

async function loadUserData(uid) {
  const snap = await getDoc(doc(db, 'usuarios', uid));
  if (snap.exists()) {
    currentUserData = snap.data();
    isAdmin = currentUserData.rol === 'admin';
    const nombre = currentUserData.nombres || currentUser?.displayName || 'Miembro';
    document.getElementById('userNameDisplay').textContent = nombre;
    document.getElementById('userAvatar').textContent = nombre.charAt(0).toUpperCase();
    if (isAdmin) {
      const btnExp = document.getElementById('btnExportCumples');
      if (btnExp) btnExp.style.display = 'flex';
    }
  }
}

document.getElementById('btnLogout').addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = '../login/login.html';
});

// ── Navegación ──
document.querySelectorAll('.nav-item, .ver-mas').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const section = link.dataset.section;
    if (!section) return;
    navigateTo(section);
    // Cerrar sidebar en móvil
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('visible');
  });
});

function navigateTo(sectionId) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.section-page').forEach(s => s.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
  const page    = document.getElementById(`sec-${sectionId}`);
  if (navItem) navItem.classList.add('active');
  if (page)    page.classList.add('active');
  if (sectionId === 'cumpleanos')      loadCumpleanos();
  if (sectionId === 'eventos')         loadEventos();
  if (sectionId === 'miembros')        loadMiembros();
  if (sectionId === 'anuncios')        loadAnuncios();
  if (sectionId === 'reconocimientos') loadReconocimientos();
  if (sectionId === 'foro')            initForo();
  if (sectionId === 'perfil')          loadPerfil();
  if (sectionId === 'sorteo')          loadSorteo();
  if (sectionId === 'juegos')          mostrarJuegosView();
}

const sidebar  = document.getElementById('sidebar');
const overlay  = document.getElementById('sidebarOverlay');
document.getElementById('sidebarToggle').addEventListener('click', () => {
  sidebar.classList.toggle('open');
  overlay.classList.toggle('visible');
});
overlay.addEventListener('click', () => {
  sidebar.classList.remove('open');
  overlay.classList.remove('visible');
});

// ====================================================  INICIO
async function initDashboard() {
  await loadStats();
  loadCumpleanosPreview();
  loadEventosPreview();
  loadAnunciosPreview();
}

async function loadStats() {
  try {
    const snapM = await getDocs(collection(db, 'usuarios'));
    document.getElementById('totalMiembros').textContent = snapM.size;
    const mesActual = hoy.getMonth() + 1;
    let cmes = 0;
    snapM.forEach(d => {
      const data = d.data();
      if (data.fechaNac && parseInt(data.fechaNac.split('-')[1]) === mesActual) cmes++;
    });
    document.getElementById('cumplesMes').textContent = cmes;
    const snapEv = await getDocs(collection(db, 'eventos'));
    document.getElementById('eventosProx').textContent = snapEv.size;
    const snapAn = await getDocs(collection(db, 'anuncios'));
    document.getElementById('anunciosCount').textContent = snapAn.size;
  } catch(e) { console.error(e); }
}

// ====================================================  CUMPLEAÑOS
function loadCumpleanosPreview() {
  const container = document.getElementById('cumpleanosPreview');
  const mesActual = hoy.getMonth() + 1, diaActual = hoy.getDate();
  getDocs(collection(db, 'usuarios')).then(snap => {
    const cumples = [];
    snap.forEach(d => {
      const data = d.data();
      if (data.fechaNac) {
        const [,mesStr,diaStr] = data.fechaNac.split('-');
        const mes = parseInt(mesStr), dia = parseInt(diaStr);
        if (mes === mesActual) cumples.push({...data, dia, mes});
      }
    });
    cumples.sort((a,b) => a.dia - b.dia);
    if (!cumples.length) { container.innerHTML = '<p class="empty-text">Sin cumpleaños este mes.</p>'; return; }
    container.innerHTML = cumples.slice(0,5).map(c => {
      const esHoy = c.dia === diaActual;
      return `<div class="cumple-item">
        <div class="c-avatar">${(c.nombres||'?').charAt(0).toUpperCase()}</div>
        <div class="c-info">
          <h4>${c.nombreCompleto||c.nombres}${esHoy?' <span class="today-badge">¡Hoy!</span>':''}</h4>
          <p>${c.distrito||'Comunidad Piurana'}</p>
        </div>
        <div class="c-date">${c.dia} ${mesNombre(c.mes)}</div>
      </div>`;
    }).join('');
  }).catch(() => { container.innerHTML = '<p class="empty-text">Error al cargar.</p>'; });
}

function loadCumpleanos() {
  const grid = document.getElementById('cumpleGrid');
  const tabsEl = document.getElementById('monthTabs');
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  let mesSeleccionado = hoy.getMonth() + 1;
  tabsEl.innerHTML = meses.map((m,i) =>
    `<button class="month-tab ${i+1===mesSeleccionado?'active':''}" data-mes="${i+1}">${m}</button>`
  ).join('');
  tabsEl.querySelectorAll('.month-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      tabsEl.querySelectorAll('.month-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      mesSeleccionado = parseInt(btn.dataset.mes);
      renderCumplesMes(mesSeleccionado, grid);
    });
  });
  const btnExp = document.getElementById('btnExportCumples');
  if (btnExp && isAdmin) { btnExp.style.display = 'flex'; btnExp.onclick = exportarCumpleanosExcel; }
  renderCumplesMes(mesSeleccionado, grid);
}

function renderCumplesMes(mes, container) {
  container.innerHTML = '<div class="skeleton-list"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>';
  getDocs(collection(db, 'usuarios')).then(snap => {
    const cumples = [];
    snap.forEach(d => {
      const data = d.data();
      if (data.fechaNac) {
        const parts = data.fechaNac.split('-');
        if (parseInt(parts[1]) === mes) cumples.push({id:d.id,...data,dia:parseInt(parts[2])});
      }
    });
    cumples.sort((a,b) => a.dia - b.dia);
    if (!cumples.length) { container.innerHTML = '<p class="empty-text">Sin cumpleaños en este mes.</p>'; return; }
    const diaHoy = hoy.getDate();
    container.innerHTML = cumples.map(c => {
      const esHoy = c.dia === diaHoy && mes === hoy.getMonth()+1;
      const diasFaltan = calcularDiasFaltan(c.dia, mes);
      return `<div class="cumple-card ${esHoy?'today':''}">
        <div class="cumple-avatar">${(c.nombres||'?').charAt(0).toUpperCase()}</div>
        <div class="cumple-info">
          <h4>${c.nombreCompleto||c.nombres}${esHoy?' <span class="today-badge">¡Hoy!</span>':''}</h4>
          <p>${c.dia} de ${mesNombreLargo(mes)}${c.distrito?' · '+c.distrito:''}</p>
        </div>
        <div class="cumple-dias">
          <span class="dias-num">${esHoy?'🎂':diasFaltan}</span>
          <span class="dias-label">${esHoy?'es hoy':'días'}</span>
        </div>
      </div>`;
    }).join('');
  });
}

function calcularDiasFaltan(dia, mes) {
  const anio = hoy.getFullYear();
  let f = new Date(anio, mes-1, dia);
  if (f < hoy) f = new Date(anio+1, mes-1, dia);
  return Math.ceil((f - hoy) / (1000*60*60*24));
}

async function exportarCumpleanosExcel() {
  const snap = await getDocs(collection(db, 'usuarios'));
  const cumples = [];
  snap.forEach(d => {
    const data = d.data();
    if (data.fechaNac) {
      const parts = data.fechaNac.split('-');
      const dia = parseInt(parts[2]), mes = parseInt(parts[1]);
      cumples.push({ Nombre: data.nombreCompleto||data.nombres||'—', 'Fecha de Cumpleaños': `${dia} de ${mesNombreLargo(mes)}`, 'Días que Faltan': calcularDiasFaltan(dia,mes) });
    }
  });
  cumples.sort((a,b) => a['Días que Faltan'] - b['Días que Faltan']);
  const BOM = '\uFEFF';
  const headers = Object.keys(cumples[0]);
  const csv = BOM + [headers.join(','), ...cumples.map(r => headers.map(h => `"${r[h]}"`).join(','))].join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'cumpleanos-comunidad-piurana.csv'; a.click(); URL.revokeObjectURL(url);
}

// ====================================================  EVENTOS (con modal al tocar foto)
function loadEventosPreview() {
  const container = document.getElementById('eventosPreview');
  getDocs(query(collection(db, 'eventos'), orderBy('fecha'), limit(3))).then(snap => {
    if (snap.empty) { container.innerHTML = '<p class="empty-text">Sin eventos próximos.</p>'; return; }
    container.innerHTML = snap.docs.map(d => {
      const ev = d.data();
      return `<div class="cumple-item">
        <div class="c-avatar" style="background:linear-gradient(135deg,#0891b2,#0e7490)"><i class="fa-solid fa-calendar-day" style="font-size:.8rem"></i></div>
        <div class="c-info"><h4>${ev.titulo||'Evento'}</h4><p>${ev.descripcion||''}</p></div>
        <div class="c-date">${ev.dia||''} ${ev.mes||''}</div>
      </div>`;
    }).join('');
  }).catch(() => { container.innerHTML = '<p class="empty-text">No se pudo cargar.</p>'; });
}

// Eventos de demostración para mostrar la funcionalidad
const EVENTOS_DEMO = [
  {
    titulo: 'Viaje a Máncora', tipo: 'Viaje', dia: '15', mes: 'ABR',
    fecha: '15 de abril de 2025', lugar: 'Máncora, Piura',
    descripcion: 'Un increíble viaje grupal a las hermosas playas de Máncora. Disfrutaremos de sol, mar, gastronomía piurana y la mejor compañía de la comunidad. El precio incluye transporte, alojamiento dos noches y actividades en la playa. ¡Cupos limitados!',
    imagen: null
  },
  {
    titulo: 'Torneo de Fútbol', tipo: 'Deporte', dia: '22', mes: 'ABR',
    fecha: '22 de abril de 2025', lugar: 'Estadio Municipal, Piura',
    descripcion: 'Gran torneo de fútbol entre los miembros de la comunidad. Se formarán equipos mixtos y habrá premios para los primeros tres lugares. Inscripciones abiertas hasta el 18 de abril.',
    imagen: null
  },
  {
    titulo: 'Noche Piurana', tipo: 'Cultura', dia: '01', mes: 'MAY',
    fecha: '1 de mayo de 2025', lugar: 'Salón Principal',
    descripcion: 'Una noche especial para celebrar nuestra cultura piurana con música en vivo, gastronomía típica como cebiche, seco de cabrito y clarito. Habrá shows de marinera y concurso de baile típico.',
    imagen: null
  },
  {
    titulo: 'Viaje a Huancabamba', tipo: 'Viaje', dia: '10', mes: 'MAY',
    fecha: '10 de mayo de 2025', lugar: 'Huancabamba, Piura',
    descripcion: 'Excursión a las Huaringas de Huancabamba. Visitaremos las lagunas sagradas, conoceremos la cultura local y disfrutaremos del paisaje serrano. Incluye guía turístico y transporte desde Piura.',
    imagen: null
  }
];

function loadEventos() {
  const container = document.getElementById('eventosList');
  container.innerHTML = '<div class="skeleton-list"><div class="skel"></div><div class="skel"></div></div>';

  getDocs(query(collection(db, 'eventos'), orderBy('fecha'))).then(snap => {
    let eventos = [];
    if (!snap.empty) {
      snap.docs.forEach(d => eventos.push(d.data()));
    } else {
      eventos = EVENTOS_DEMO;
    }
    renderEventosGrid(eventos, container);
  }).catch(() => {
    renderEventosGrid(EVENTOS_DEMO, container);
  });
}

function renderEventosGrid(eventos, container) {
  container.innerHTML = eventos.map((ev, idx) => `
    <div class="evento-card" data-idx="${idx}">
      <div class="evento-card__img">
        ${ev.imagen ? `<img src="${ev.imagen}" alt="${ev.titulo}"/>` : `<i class="fa-solid fa-map-location-dot"></i>`}
      </div>
      <div class="evento-card__body">
        <div class="evento-card__tag">${ev.tipo||'Evento'}</div>
        <div class="evento-card__title">${ev.titulo||'Sin título'}</div>
        <div class="evento-card__meta">
          <span><i class="fa-solid fa-calendar-day"></i>${ev.dia||''} ${ev.mes||ev.fecha||''}</span>
          ${ev.lugar?`<span><i class="fa-solid fa-location-dot"></i>${ev.lugar}</span>`:''}
        </div>
        <div class="evento-card__hint"><i class="fa-solid fa-hand-pointer"></i> Toca para ver detalles</div>
      </div>
    </div>
  `).join('');

  // Al tocar/click la tarjeta → abrir modal
  container.querySelectorAll('.evento-card').forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.idx);
      abrirModalEvento(eventos[idx]);
    });
  });
}

function abrirModalEvento(ev) {
  document.getElementById('eventoModalImg').src = ev.imagen || '';
  document.getElementById('eventoModalImg').style.display = ev.imagen ? 'block' : 'none';
  document.getElementById('eventoModal').querySelector('.evento-modal__img-wrap').style.display = ev.imagen ? 'block' : 'none';
  document.getElementById('eventoModalTag').textContent = ev.tipo || 'Evento';
  document.getElementById('eventoModalTitulo').textContent = ev.titulo || '—';
  document.getElementById('eventoModalFecha').textContent = ev.fecha || `${ev.dia} ${ev.mes}`;
  document.getElementById('eventoModalLugar').textContent = ev.lugar || '—';
  document.getElementById('eventoModalDesc').textContent = ev.descripcion || '—';
  document.getElementById('eventoModalOverlay').classList.add('open');
}

document.getElementById('eventoModalClose').addEventListener('click', () => {
  document.getElementById('eventoModalOverlay').classList.remove('open');
});
document.getElementById('eventoModalOverlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
});

// ====================================================  ANUNCIOS
function loadAnunciosPreview() {
  const container = document.getElementById('anunciosPreview');
  getDocs(query(collection(db, 'anuncios'), orderBy('creadoEn','desc'), limit(3))).then(snap => {
    if (snap.empty) { container.innerHTML = '<p class="empty-text">Sin anuncios.</p>'; return; }
    container.innerHTML = snap.docs.map(d => anuncioItemHTML(d.data())).join('');
  }).catch(() => { container.innerHTML = '<p class="empty-text">No se pudo cargar.</p>'; });
}

function loadAnuncios() {
  const container = document.getElementById('anunciosList');
  container.innerHTML = '<div class="skeleton-list"><div class="skel"></div><div class="skel"></div></div>';
  getDocs(query(collection(db, 'anuncios'), orderBy('creadoEn','desc'))).then(snap => {
    if (snap.empty) { container.innerHTML = '<p class="empty-text">No hay anuncios.</p>'; return; }
    container.innerHTML = snap.docs.map(d => anuncioItemHTML(d.data())).join('');
  }).catch(() => { container.innerHTML = '<p class="empty-text">Error al cargar.</p>'; });
}

function anuncioItemHTML(an) {
  const fecha = an.creadoEn?.toDate?.()?.toLocaleDateString('es-PE') || '';
  return `<div class="anuncio-item">
    <div class="anuncio-item__header"><h4>${an.titulo||'Anuncio'}</h4><span class="anuncio-item__fecha">${fecha}</span></div>
    <p>${an.cuerpo||''}</p>
  </div>`;
}

// ====================================================  MIEMBROS
function loadMiembros() {
  const container = document.getElementById('miembrosGrid');
  const searchInput = document.getElementById('searchMiembro');
  container.innerHTML = '<div class="skeleton-list"><div class="skel"></div><div class="skel"></div></div>';
  getDocs(collection(db, 'usuarios')).then(snap => {
    const miembros = [];
    snap.forEach(d => miembros.push(d.data()));
    function render(lista) {
      if (!lista.length) { container.innerHTML = '<p class="empty-text">Sin resultados.</p>'; return; }
      container.innerHTML = lista.map(m => `<div class="miembro-card">
        <div class="big-avatar">${(m.nombres||'?').charAt(0).toUpperCase()}</div>
        <h4>${m.nombreCompleto||m.nombres}</h4>
        <p>@${m.username||'—'}</p>
        <p>${m.distrito||''}</p>
      </div>`).join('');
    }
    render(miembros);
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase();
      render(miembros.filter(m => (m.nombreCompleto||'').toLowerCase().includes(q) || (m.username||'').toLowerCase().includes(q)));
    });
  }).catch(() => { container.innerHTML = '<p class="empty-text">Error al cargar.</p>'; });
}

// ====================================================  RECONOCIMIENTOS
function loadReconocimientos() {
  const container = document.getElementById('reconocimientosGrid');
  container.innerHTML = '<div class="skeleton-list"><div class="skel"></div><div class="skel"></div></div>';
  getDocs(collection(db, 'reconocimientos')).then(snap => {
    if (snap.empty) {
      container.innerHTML = `
        <div class="reconocimiento-card"><div class="trophy">🥇</div><h4>Miembro del Mes</h4><p>Por destacar en torneos y actividades comunitarias</p><div class="medal">Próximamente</div></div>
        <div class="reconocimiento-card"><div class="trophy">🥈</div><h4>Mejor Deportista</h4><p>Reconocimiento al atleta más comprometido</p><div class="medal">Próximamente</div></div>
        <div class="reconocimiento-card"><div class="trophy">🥉</div><h4>Espíritu Piurano</h4><p>Por promover la cultura y tradiciones de Piura</p><div class="medal">Próximamente</div></div>`;
      return;
    }
    container.innerHTML = snap.docs.map(d => {
      const r = d.data();
      return `<div class="reconocimiento-card"><div class="trophy">${r.emoji||'🏆'}</div><h4>${r.nombre||'—'}</h4><p>${r.razon||''}</p><div class="medal">${r.periodo||''}</div></div>`;
    }).join('');
  }).catch(() => { container.innerHTML = '<p class="empty-text">Error al cargar.</p>'; });
}

// ====================================================  FORO PERSISTENTE
let foroUnsubscribe = null;
function initForo() {
  const messagesEl = document.getElementById('foroMessages');
  const inputEl    = document.getElementById('foroMsgInput');
  const sendBtn    = document.getElementById('foroSend');
  const emptyEl    = document.getElementById('foroEmpty');

  if (foroUnsubscribe) foroUnsubscribe();

  // Cargar TODOS los mensajes ordenados (persistentes en Firebase)
  const q = query(collection(db, 'foro'), orderBy('creadoEn', 'asc'));
  foroUnsubscribe = onSnapshot(q, (snap) => {
    // Limpiar mensajes previos (no el empty)
    messagesEl.querySelectorAll('.foro-msg').forEach(el => el.remove());

    if (snap.empty) {
      emptyEl.style.display = 'flex';
    } else {
      emptyEl.style.display = 'none';
      snap.docs.forEach(d => {
        const m = d.data();
        const esPropio = m.uid === currentUser?.uid;
        const hora = m.creadoEn?.toDate?.()?.toLocaleTimeString('es-PE', {hour:'2-digit',minute:'2-digit'}) || '';
        const fecha = m.creadoEn?.toDate?.()?.toLocaleDateString('es-PE', {day:'numeric',month:'short'}) || '';
        const msgEl = document.createElement('div');
        msgEl.className = `foro-msg ${esPropio?'own':''}`;
        msgEl.innerHTML = `
          <div class="foro-avatar">${(m.autor||'?').charAt(0).toUpperCase()}</div>
          <div class="foro-msg__body">
            <div class="foro-msg__header">
              <span class="foro-msg__name">${m.autor||'Anónimo'}</span>
              <span class="foro-msg__time">${fecha} ${hora}</span>
            </div>
            <div class="foro-msg__text">${escapeHTML(m.texto)}</div>
          </div>`;
        messagesEl.appendChild(msgEl);
      });
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  });

  async function sendMsg() {
    const texto = inputEl.value.trim();
    if (!texto || !currentUser) return;
    if (texto.length > 500) { alert('Mensaje demasiado largo (máx. 500 caracteres)'); return; }
    inputEl.value = '';
    sendBtn.disabled = true;
    try {
      await addDoc(collection(db, 'foro'), {
        texto,
        uid: currentUser.uid,
        autor: currentUserData?.nombreCompleto || currentUserData?.nombres || currentUser.displayName || 'Miembro',
        creadoEn: serverTimestamp(),
      });
    } catch(e) { console.error(e); }
    sendBtn.disabled = false;
    inputEl.focus();
  }

  sendBtn.onclick = sendMsg;
  inputEl.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } };
}

function escapeHTML(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ====================================================  PERFIL
function loadPerfil() {
  const container = document.getElementById('perfilCard');
  if (!currentUserData) { container.innerHTML = '<p class="empty-text">No se pudo cargar el perfil.</p>'; return; }
  const d = currentUserData;
  container.innerHTML = `
    <div class="big-avatar">${(d.nombres||'?').charAt(0).toUpperCase()}</div>
    <h2>${d.nombreCompleto||d.nombres||'—'}</h2>
    <p class="username">@${d.username||'—'}</p>
    <div class="perfil-data">
      <div class="perfil-row"><label>Correo</label><span>${d.email||'—'}</span></div>
      <div class="perfil-row"><label>Fecha de nacimiento</label><span>${formatFecha(d.fechaNac)}</span></div>
      <div class="perfil-row"><label>Género</label><span>${capitalize(d.genero)||'—'}</span></div>
      <div class="perfil-row"><label>Teléfono</label><span>${d.telefono||'—'}</span></div>
      <div class="perfil-row"><label>Distrito</label><span>${d.distrito||'—'}</span></div>
      <div class="perfil-row"><label>Rol</label><span>${capitalize(d.rol)||'Miembro'}</span></div>
    </div>`;
}

// ====================================================  SORTEO
async function loadSorteo() {
  const adminPanel = document.getElementById('adminSorteoPanel');
  if (isAdmin) { adminPanel.style.display = 'block'; setupAdminSorteo(); }

  // Cargar sorteo guardado en Firebase
  try {
    const sorteoSnap = await getDoc(doc(db, 'sorteo', 'actual'));
    if (sorteoSnap.exists()) {
      renderSorteoPublico(sorteoSnap.data());
    } else {
      // Datos por defecto
      renderSorteoPublico({ premio: 'Premio especial', descripcion: 'Próximamente se anunciará el premio del sorteo.', fecha: '2025-07-21', precio: 'S/ 10.00' });
    }
  } catch(e) {
    renderSorteoPublico({ premio: 'Premio especial', descripcion: 'Próximamente se anunciará el premio del sorteo.', fecha: '2025-07-21', precio: 'S/ 10.00' });
  }
}

function renderSorteoPublico(data) {
  if (data.imagenBase64) {
    document.getElementById('sorteoImgDisplay').src = data.imagenBase64;
    document.getElementById('sorteoImgDisplay').style.display = 'block';
    document.getElementById('sorteoNoImg').style.display = 'none';
  }
  if (data.premio) document.getElementById('sorteoNombrePremio').textContent = data.premio;
  if (data.descripcion) document.getElementById('sorteoDescPublic').textContent = data.descripcion;
  if (data.fecha) {
    const d = new Date(data.fecha + 'T00:00:00');
    document.getElementById('sorteoFechaDisplay').textContent = d.toLocaleDateString('es-PE', {day:'numeric',month:'long',year:'numeric'});
    iniciarCountdown(new Date(data.fecha + 'T23:59:59'));
  }
  if (data.precio) document.getElementById('sorteoPrecioDisplay').textContent = data.precio;

  const premioWA = data.premio || 'el sorteo';
  const msg = encodeURIComponent(
    `Hola Anghelo! 👋 Quiero participar en el sorteo de *${premioWA}*.\n\nAquí dejo la captura del pago 📸\n\nMi nombre es: \nTeléfono: \nDistrito: \nCantidad de tickets: `
  );
  document.getElementById('btnWhatsapp').href = `https://wa.me/51946182119?text=${msg}`;
}

function iniciarCountdown(fechaObjetivo) {
  if (countdownInterval) clearInterval(countdownInterval);
  function tick() {
    const diff = fechaObjetivo - new Date();
    if (diff <= 0) {
      ['cdDias','cdHoras','cdMin','cdSeg'].forEach(id => document.getElementById(id).textContent = '00');
      clearInterval(countdownInterval); return;
    }
    document.getElementById('cdDias').textContent  = String(Math.floor(diff/(1000*60*60*24))).padStart(2,'0');
    document.getElementById('cdHoras').textContent = String(Math.floor((diff%(1000*60*60*24))/(1000*60*60))).padStart(2,'0');
    document.getElementById('cdMin').textContent   = String(Math.floor((diff%(1000*60*60))/(1000*60))).padStart(2,'0');
    document.getElementById('cdSeg').textContent   = String(Math.floor((diff%(1000*60))/1000)).padStart(2,'0');
  }
  tick(); countdownInterval = setInterval(tick, 1000);
}

function setupAdminSorteo() {
  const fileInput = document.getElementById('sorteoImgInput');
  const previewWrap = document.getElementById('sorteoImgPreview');
  const previewImg  = document.getElementById('sorteoImgPreviewImg');
  const removeBtn   = document.getElementById('removeSorteoImg');
  const btnSave     = document.getElementById('btnSaveSorteo');
  let imagenBase64  = null;

  // Evitar múltiples listeners
  const newBtn = btnSave.cloneNode(true);
  btnSave.parentNode.replaceChild(newBtn, btnSave);

  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { imagenBase64 = ev.target.result; previewImg.src = imagenBase64; previewWrap.style.display = 'block'; };
    reader.readAsDataURL(file);
  };
  removeBtn.onclick = () => { imagenBase64 = null; previewWrap.style.display = 'none'; fileInput.value = ''; };

  newBtn.addEventListener('click', async () => {
    const premio      = document.getElementById('sorteoPremio').value.trim();
    const descripcion = document.getElementById('sorteoDescripcion').value.trim();
    const fecha       = document.getElementById('sorteoFecha').value;
    const precio      = document.getElementById('sorteoPrecio').value.trim();
    if (!premio) { alert('Ingresa el nombre del premio'); return; }
    newBtn.disabled = true;
    newBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando…';
    try {
      const sorteoData = { premio, descripcion, fecha, precio, actualizadoEn: serverTimestamp() };
      if (imagenBase64) sorteoData.imagenBase64 = imagenBase64;
      await setDoc(doc(db, 'sorteo', 'actual'), sorteoData, {merge:true});
      renderSorteoPublico(sorteoData);
      newBtn.innerHTML = '<i class="fa-solid fa-check"></i> ¡Publicado!';
      setTimeout(() => { newBtn.disabled = false; newBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar y publicar'; }, 2500);
    } catch(err) {
      alert('Error al guardar: ' + err.message);
      newBtn.disabled = false;
      newBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar y publicar';
    }
  });
}

// ====================================================  JUEGOS
function mostrarJuegosView() {
  document.getElementById('juegosView').style.display = 'block';
  document.getElementById('panelPupiletras').style.display = 'none';
  document.getElementById('panelTrivia').style.display = 'none';
  document.getElementById('panelMemory').style.display = 'none';
}

document.querySelectorAll('.btn-jugar').forEach(btn => {
  btn.addEventListener('click', () => {
    const game = btn.dataset.game;
    document.getElementById('juegosView').style.display = 'none';
    if (game === 'pupiletras') { document.getElementById('panelPupiletras').style.display = 'block'; generarPupiletras(); }
    if (game === 'trivia')     { document.getElementById('panelTrivia').style.display = 'block'; iniciarTrivia(); }
    if (game === 'memory')     { document.getElementById('panelMemory').style.display = 'block'; iniciarMemory(); }
  });
});

document.querySelectorAll('.btn-back').forEach(btn => {
  btn.addEventListener('click', () => mostrarJuegosView());
});

// ──── PUPILETRAS ────
const PALABRAS_PIURA = [
  'PIURA','SULLANA','TUMBES','CATACAOS','MANCORA','CEBICHE','SECO','TORTILLA',
  'NATILLAS','CLARITO','COMUNIDAD','PIURANO','FUTBOL','CULTURA','FIESTA',
  'AMIGOS','VOLEY','VIAJES','EXPERIENCIAS','PLAYAS','DESIERTO','GRAU',
  'CHIFLES','MARINERA','TRADICION','VERANO','ALEGRIA','UNION','FAMILIA','DEPORTE'
];

const COLS = 12, ROWS = 11;
let selectedCells = [], foundWords = [], isDragging = false, placedWords = [];

function generarPupiletras() {
  foundWords = []; selectedCells = []; placedWords = [];
  const palabras = [...PALABRAS_PIURA].sort(() => Math.random()-.5).slice(0,10);
  document.getElementById('wordsTotal').textContent = palabras.length;
  document.getElementById('wordsFound').textContent = 0;

  const grid = Array.from({length:ROWS}, () => Array(COLS).fill(''));
  const dirs = [[0,1],[1,0],[0,-1],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];

  for (const word of palabras) {
    let placed = false;
    for (let att = 0; att < 300 && !placed; att++) {
      const dir = dirs[Math.floor(Math.random()*dirs.length)];
      const sr = Math.floor(Math.random()*ROWS), sc = Math.floor(Math.random()*COLS);
      const cells = []; let valid = true;
      for (let i = 0; i < word.length; i++) {
        const r = sr+dir[0]*i, c = sc+dir[1]*i;
        if (r<0||r>=ROWS||c<0||c>=COLS) { valid=false; break; }
        if (grid[r][c]!==''&&grid[r][c]!==word[i]) { valid=false; break; }
        cells.push({r,c});
      }
      if (valid) { cells.forEach((cell,i) => grid[cell.r][cell.c]=word[i]); placedWords.push({word,cells}); placed=true; }
    }
  }
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) if (grid[r][c]==='') grid[r][c]=letras[Math.floor(Math.random()*26)];

  const gridEl = document.getElementById('letterGrid');
  // Tamaño responsivo
  const maxW = Math.min(window.innerWidth - 200, 480);
  const cellSize = Math.max(24, Math.floor(maxW / COLS));
  gridEl.style.gridTemplateColumns = `repeat(${COLS}, ${cellSize}px)`;
  gridEl.innerHTML = '';
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
    const cell = document.createElement('div');
    cell.className = 'letter-cell';
    cell.style.width = cell.style.height = cellSize+'px';
    cell.style.fontSize = Math.max(10, cellSize-14)+'px';
    cell.textContent = grid[r][c];
    cell.dataset.r = r; cell.dataset.c = c;
    gridEl.appendChild(cell);
  }
  document.getElementById('wordList').innerHTML = placedWords.map(pw =>
    `<div class="word-item" id="word-${pw.word}">${pw.word}</div>`
  ).join('');
  setupGridEvents(gridEl);
}

function setupGridEvents(gridEl) {
  // Prevenir scroll en touch dentro del grid
  gridEl.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const cell = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY)?.closest('.letter-cell');
    if (!cell) return;
    isDragging = true; selectedCells = [cell]; cell.classList.add('selected');
  }, {passive:false});

  gridEl.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!isDragging) return;
    const cell = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY)?.closest('.letter-cell');
    if (!cell || !selectedCells[0]) return;
    const first = selectedCells[0];
    gridEl.querySelectorAll('.letter-cell.selected').forEach(c => { if (!c.classList.contains('found')) c.classList.remove('selected'); });
    selectedCells = getCellsInLine(parseInt(first.dataset.r),parseInt(first.dataset.c),parseInt(cell.dataset.r),parseInt(cell.dataset.c),gridEl);
    selectedCells.forEach(c => { if (!c.classList.contains('found')) c.classList.add('selected'); });
  }, {passive:false});

  gridEl.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (!isDragging) return;
    isDragging = false; checkSelection();
    gridEl.querySelectorAll('.letter-cell.selected').forEach(c => { if (!c.classList.contains('found')) c.classList.remove('selected'); });
    selectedCells = [];
  }, {passive:false});

  gridEl.addEventListener('mousedown', (e) => {
    const cell = e.target.closest('.letter-cell');
    if (!cell) return;
    isDragging = true; selectedCells = [cell]; cell.classList.add('selected');
  });
  gridEl.addEventListener('mouseover', (e) => {
    if (!isDragging) return;
    const cell = e.target.closest('.letter-cell');
    if (!cell || !selectedCells[0]) return;
    const first = selectedCells[0];
    gridEl.querySelectorAll('.letter-cell.selected').forEach(c => { if (!c.classList.contains('found')) c.classList.remove('selected'); });
    selectedCells = getCellsInLine(parseInt(first.dataset.r),parseInt(first.dataset.c),parseInt(cell.dataset.r),parseInt(cell.dataset.c),gridEl);
    selectedCells.forEach(c => { if (!c.classList.contains('found')) c.classList.add('selected'); });
  });
  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false; checkSelection();
    gridEl.querySelectorAll('.letter-cell.selected').forEach(c => { if (!c.classList.contains('found')) c.classList.remove('selected'); });
    selectedCells = [];
  });
}

function getCellsInLine(r0,c0,r1,c1,gridEl) {
  const dr=r1-r0, dc=c1-c0, len=Math.max(Math.abs(dr),Math.abs(dc));
  if (len===0) return [gridEl.querySelector(`[data-r="${r0}"][data-c="${c0}"]`)].filter(Boolean);
  const cells = [];
  for (let i=0;i<=len;i++) {
    const r=Math.round(r0+dr*i/len), c=Math.round(c0+dc*i/len);
    const cell = gridEl.querySelector(`[data-r="${r}"][data-c="${c}"]`);
    if (cell) cells.push(cell);
  }
  return cells;
}

function checkSelection() {
  const word    = selectedCells.map(c => c.textContent).join('');
  const wordRev = word.split('').reverse().join('');
  const match   = placedWords.find(pw => pw.word===word||pw.word===wordRev);
  if (match && !foundWords.includes(match.word)) {
    foundWords.push(match.word);
    selectedCells.forEach(c => { c.classList.remove('selected'); c.classList.add('found'); });
    const wordEl = document.getElementById(`word-${match.word}`);
    if (wordEl) wordEl.classList.add('found');
    document.getElementById('wordsFound').textContent = foundWords.length;
    if (foundWords.length === placedWords.length) setTimeout(() => alert('🎉 ¡Encontraste todas las palabras! ¡Excelente piurano!'), 300);
  }
}

// ──── TRIVIA ────
const PREGUNTAS_TRIVIA = [
  { p: '¿Cuál es la capital del departamento de Piura?', ops: ['Sullana','Piura','Paita','Talara'], r: 1 },
  { p: '¿Qué plato típico es más representativo de Piura?', ops: ['Cau cau','Pachamanca','Cebiche de conchas negras','Lomo saltado'], r: 2 },
  { p: '¿En qué playa famosa de Piura hacen surf de clase mundial?', ops: ['Máncora','Paita','Talara','Colán'], r: 0 },
  { p: '¿Cómo se llama el desierto que hay en Piura?', ops: ['Sechura','Atacama','Nazca','Paracas'], r: 0 },
  { p: '¿Qué héroe peruano nació en Piura?', ops: ['Miguel Grau','Andrés Avelino Cáceres','Francisco Bolognesi','José Olaya'], r: 0 },
  { p: '¿Cuál es la bebida típica de Piura?', ops: ['Chicha de jora','Clarito','Pisco','Masato'], r: 1 },
  { p: '¿En qué provincia están las Huaringas?', ops: ['Piura','Sullana','Huancabamba','Ayabaca'], r: 2 },
  { p: '¿Qué fruta es muy famosa de Piura?', ops: ['Mango','Chirimoya','Lúcuma','Aguaymanto'], r: 0 },
  { p: '¿Cómo se llama el baile típico de la costa peruana?', ops: ['Huayno','Marinera','Vals','Cumbia'], r: 1 },
  { p: '¿Qué río importante pasa por la ciudad de Piura?', ops: ['Río Amazonas','Río Chira','Río Piura','Río Tumbes'], r: 2 },
];

let triviaIdx = 0, triviaPuntos = 0, triviaRespondida = false;

function iniciarTrivia() {
  triviaIdx = 0; triviaPuntos = 0;
  const preguntas = [...PREGUNTAS_TRIVIA].sort(() => Math.random()-.5);
  document.getElementById('triviaPuntos').textContent = 0;
  renderPregunta(preguntas, triviaIdx);
  window._triviaPreguntas = preguntas;
}

function renderPregunta(preguntas, idx) {
  const container = document.getElementById('triviaContainer');
  if (idx >= preguntas.length) {
    container.innerHTML = `<div class="trivia-fin">
      <div style="font-size:3rem;margin-bottom:.5rem">${triviaPuntos >= preguntas.length*0.7 ? '🏆' : triviaPuntos >= preguntas.length*0.4 ? '👍' : '💪'}</div>
      <h3>¡Terminaste!</h3>
      <p>Obtuviste <strong>${triviaPuntos}</strong> de <strong>${preguntas.length}</strong> puntos</p>
      <button class="btn-trivia-next" onclick="iniciarTrivia()"><i class="fa-solid fa-rotate-right"></i> Jugar de nuevo</button>
    </div>`; return;
  }
  triviaRespondida = false;
  const q = preguntas[idx];
  container.innerHTML = `
    <div style="font-size:.75rem;color:var(--text-muted);margin-bottom:.75rem;font-weight:500">Pregunta ${idx+1} de ${preguntas.length}</div>
    <div class="trivia-pregunta"><p>${q.p}</p></div>
    <div class="trivia-opciones">
      ${q.ops.map((op,i) => `<button class="trivia-opcion" data-idx="${i}">${op}</button>`).join('')}
    </div>`;

  container.querySelectorAll('.trivia-opcion').forEach(btn => {
    btn.addEventListener('click', () => {
      if (triviaRespondida) return;
      triviaRespondida = true;
      const sel = parseInt(btn.dataset.idx);
      const ok  = sel === q.r;
      if (ok) { triviaPuntos++; document.getElementById('triviaPuntos').textContent = triviaPuntos; }
      container.querySelectorAll('.trivia-opcion').forEach((b,i) => {
        b.disabled = true;
        if (i === q.r) b.classList.add('correct');
        if (i === sel && !ok) b.classList.add('wrong');
      });
      const res = document.createElement('div');
      res.className = `trivia-result ${ok?'ok':'bad'}`;
      res.textContent = ok ? '✓ ¡Correcto!' : `✗ La respuesta era: ${q.ops[q.r]}`;
      container.appendChild(res);
      const nextBtn = document.createElement('button');
      nextBtn.className = 'btn-trivia-next';
      nextBtn.innerHTML = idx+1 < preguntas.length ? 'Siguiente <i class="fa-solid fa-arrow-right"></i>' : 'Ver resultado <i class="fa-solid fa-flag-checkered"></i>';
      nextBtn.onclick = () => renderPregunta(preguntas, idx+1);
      container.appendChild(nextBtn);
    });
  });
}

// ──── MEMORY ────
const PALABRAS_MEMORY = [
  'PIURA','MANCORA','CEBICHE','FUTBOL','AMIGOS',
  'VOLEY','VIAJES','PLAYAS','GRAU','NATILLAS',
  'SULLANA','MARINERA'
];

let memoryFlipped = [], memoryMatched = [], memoryBlocked = false;

function iniciarMemory() {
  memoryFlipped = []; memoryMatched = []; memoryBlocked = false;
  const palabras = [...PALABRAS_MEMORY].sort(() => Math.random()-.5).slice(0,8);
  const pares = [...palabras,...palabras].sort(() => Math.random()-.5);
  document.getElementById('memoryPares').textContent = 0;
  document.getElementById('memoryTotal').textContent = palabras.length;

  const gridEl = document.getElementById('memoryGrid');
  gridEl.innerHTML = pares.map((p,i) => `
    <div class="memory-card" data-word="${p}" data-idx="${i}">
      <div class="memory-card__inner">
        <div class="memory-card__front"><i class="fa-solid fa-question"></i></div>
        <div class="memory-card__back">${p}</div>
      </div>
    </div>`).join('');

  gridEl.querySelectorAll('.memory-card').forEach(card => {
    card.addEventListener('click', () => flipCard(card, palabras.length));
  });
}

function flipCard(card, total) {
  if (memoryBlocked || card.classList.contains('flipped') || card.classList.contains('matched')) return;
  card.classList.add('flipped');
  memoryFlipped.push(card);
  if (memoryFlipped.length === 2) {
    memoryBlocked = true;
    const [a,b] = memoryFlipped;
    if (a.dataset.word === b.dataset.word) {
      a.classList.add('matched'); b.classList.add('matched');
      memoryMatched.push(a,b);
      memoryFlipped = []; memoryBlocked = false;
      const pares = memoryMatched.length / 2;
      document.getElementById('memoryPares').textContent = pares;
      if (pares === total) setTimeout(() => alert('🎉 ¡Encontraste todos los pares! ¡Excelente memoria piurana!'), 300);
    } else {
      setTimeout(() => { a.classList.remove('flipped'); b.classList.remove('flipped'); memoryFlipped = []; memoryBlocked = false; }, 1000);
    }
  }
}

// ====================================================  UTILIDADES
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MESES_LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
function mesNombre(n)      { return MESES[n-1]||''; }
function mesNombreLargo(n) { return MESES_LARGO[n-1]||''; }
function capitalize(str)   { return str ? str.charAt(0).toUpperCase()+str.slice(1) : ''; }
function formatFecha(f) {
  if (!f) return '—';
  const [y,m,d] = f.split('-');
  return `${d} de ${mesNombreLargo(parseInt(m))} de ${y}`;
}

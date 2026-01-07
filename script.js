// =============================
// CONFIGURAÇÕES
// =============================
const MACHINE_NAMES = [
  'Fresa CNC 1','Fresa CNC 2','Fresa CNC 3','Robodrill 2','D 800-1','Fagor',
  'Robodrill 1','VTC','D 800-2','D 800-3','Centur','Nardine','GL 280',
  '15S','E 280','G 240','Galaxy 10A','Galaxy 10B','GL 170G','GL 250','GL 350','GL 450'
];

let state = { machines: [] };

// =============================
// FIREBASE
// =============================
firebase.initializeApp({
  apiKey: "AIzaSyBtJ5bhKoYsG4Ht57yxJ-69fvvbVCVPGjI",
  authDomain: "dashboardusinagem.firebaseapp.com",
  projectId: "dashboardusinagem",
  storageBucket: "dashboardusinagem.appspot.com",
  messagingSenderId: "677023128312",
  appId: "1:677023128312:web:75376363a62105f360f90d"
});

const db = firebase.database();
const REF = db.ref('usinagem_dashboard_v18_6');

// =============================
// UTILIDADES
// =============================
function parseMin(v) {
  if (!v) return 0;
  if (v.includes(':')) {
    const [m, s = 0] = v.split(':').map(Number);
    return m + s / 60;
  }
  return Number(v.replace(',', '.')) || 0;
}

function calcularPrevisto(ciclo) {
  if (!ciclo) return 0;
  return Math.floor(525 / ciclo);
}

function prioridadeCor(p) {
  if (p === 'vermelho') return 'bg-red-600';
  if (p === 'amarelo') return 'bg-yellow-500';
  return 'bg-green-600';
}

// =============================
// RENDER
// =============================
function render() {
  const container = document.getElementById('machinesContainer');
  container.innerHTML = '';

  state.machines.forEach(m => {
    const tpl = document.getElementById('machine-template');
    const root = tpl.content.cloneNode(true).firstElementChild;
    const $ = r => root.querySelector(`[data-role="${r}"]`);

    // ===== DADOS =====
    $('title').textContent = m.id;
    $('operator').value = m.operator || '';
    $('process').value = m.process || '';
    $('cycle').value = m.cycle || '';
    $('produced').value = m.produced ?? '';
    $('observacao').value = m.observacao || '';
    $('predicted').textContent = m.predicted || 0;

    // ===== HISTÓRICO =====
    const historyBox = $('history');
    historyBox.innerHTML = '';

    (m.history || []).forEach(h => {
      const div = document.createElement('div');
      div.className = 'border-b border-gray-700 pb-1 mb-1';
      div.innerHTML = `
        <div><b>${h.data}</b></div>
        <div>${h.processo}</div>
        <div>${h.produzidas} peças — <b>${h.eficiencia}%</b></div>
        ${h.obs ? `<div>📝 ${h.obs}</div>` : ''}
      `;
      historyBox.appendChild(div);
    });

    // ===== EVENTOS =====
    $('save').onclick = () => {
      m.operator = $('operator').value.trim();
      m.process = $('process').value.trim();
      m.cycle = parseMin($('cycle').value);
      m.produced = Number($('produced').value) || 0;
      m.observacao = $('observacao').value.trim();
      m.predicted = calcularPrevisto(m.cycle);
      salvar(m);
    };

    $('addHistory').onclick = () => {
      if (!m.history) m.history = [];

      const eficiencia = m.predicted > 0
        ? ((m.produced / m.predicted) * 100).toFixed(1)
        : '0.0';

      m.history.unshift({
        processo: m.process,
        produzidas: m.produced,
        eficiencia,
        obs: m.observacao || '',
        data: new Date().toLocaleString()
      });

      salvar(m);
    };

    $('clearHistory').onclick = () => {
      if (!m.history || m.history.length === 0) return;
      m.history = [];
      salvar(m);
    };

    // ===== LISTA DE ESPERA =====
    const futureList = $('futureList');
    futureList.innerHTML = '';

    (m.future || []).forEach((f, i) => {
      const div = document.createElement('div');
      div.className = `flex justify-between items-center px-2 py-1 rounded text-sm ${prioridadeCor(f.priority)}`;
      div.innerHTML = `
        <span>${f.item}</span>
        <button class="text-white font-bold">✕</button>
      `;
      div.querySelector('button').onclick = () => {
        m.future.splice(i, 1);
        salvar(m);
      };
      futureList.appendChild(div);
    });

    new Sortable(futureList, {
      animation: 150,
      onEnd: e => {
        const [item] = m.future.splice(e.oldIndex, 1);
        m.future.splice(e.newIndex, 0, item);
        salvar(m);
      }
    });

    $('addFuture').onclick = () => {
      const val = $('futureInput').value.trim();
      const prio = $('prioritySelect').value;
      if (!val) return;
      if (!m.future) m.future = [];
      m.future.push({ item: val, priority: prio });
      $('futureInput').value = '';
      salvar(m);
    };

    // ===== INSERE CARD =====
    container.appendChild(root);
  });
}

// =============================
// FIREBASE
// =============================
function salvar(m) {
  REF.child(m.id).set(m);
}

REF.on('value', snap => {
  const data = snap.val() || {};
  state.machines = MACHINE_NAMES.map(id => ({
    id,
    ...data[id],
    history: data[id]?.history || [],
    future: data[id]?.future || []
  }));
  render();
});

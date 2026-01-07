// =============================
// CONFIGURAÇÕES
// =============================
const MACHINE_NAMES = [
  'Fresa CNC 1','Fresa CNC 2','Fresa CNC 3','Robodrill 2','D 800-1','Fagor',
  'Robodrill 1','VTC','D 800-2','D 800-3','Centur','Nardine','GL 280',
  '15S','E 280','G 240','Galaxy 10A','Galaxy 10B','GL 170G','GL 250','GL 350','GL 450'
];

let state = { machines: [] };
let charts = {};

// =============================
// FIREBASE
// =============================
firebase.initializeApp({
  apiKey: "AIzaSyBtJ5bhKoYsG4Ht57yxJ-69fvvbVCVPGjI",
  authDomain: "dashboardusinagem.firebaseapp.com",
  databaseURL: "https://dashboardusinagem-default-rtdb.firebaseio.com",
  projectId: "dashboardusinagem"
});

const db = firebase.database();
const REF = db.ref('usinagem_dashboard_v18_6');

// =============================
// UTIL
// =============================
const parseMin = v => {
  if (!v) return 0;
  if (v.includes(':')) {
    const [m,s=0] = v.split(':').map(Number);
    return m + s/60;
  }
  return Number(v.replace(',','.')) || 0;
};

const previsto = ciclo => ciclo ? Math.floor(525 / ciclo) : 0;

const corEficiencia = e =>
  e < 50 ? '#dc2626' :
  e < 75 ? '#facc15' : '#16a34a';

// =============================
// RENDER
// =============================
function render() {
  const container = document.getElementById('machinesContainer');
  container.innerHTML = '';

  state.machines.forEach(m => {
    const tpl = document.getElementById('machine-template');
    const card = tpl.content.cloneNode(true).firstElementChild;
    const $ = r => card.querySelector(`[data-role="${r}"]`);

    $('title').textContent = m.id;
    $('operator').value = m.operator || '';
    $('process').value = m.process || '';
    $('cycle').value = m.cycleRaw || '';
    $('produced').value = m.produced ?? '';
    $('observacao').value = m.obs || '';
    $('predicted').textContent = m.predicted || 0;

    // ================= HISTÓRICO =================
    const histBox = $('history');
    histBox.innerHTML = '';
    (m.history || []).forEach(h => {
      const d = document.createElement('div');
      d.className = 'border-b border-gray-700 pb-1 mb-1';
      d.innerHTML = `
        <div><b>${h.processo}</b></div>
        <div>${h.qtd} peças — <b>${h.eficiencia}%</b></div>
        ${h.obs ? `<div>📝 ${h.obs}</div>` : ''}
      `;
      histBox.appendChild(d);
    });

    // ================= BOTÕES =================
    $('save').onclick = () => {
      m.operator = $('operator').value.trim();
      m.process = $('process').value.trim();
      m.cycleRaw = $('cycle').value;
      m.cycle = parseMin(m.cycleRaw);
      m.produced = Number($('produced').value) || 0;
      m.obs = $('observacao').value.trim();
      m.predicted = previsto(m.cycle);
      salvar(m);
    };

    $('addHistory').onclick = () => {
      if (!m.history) m.history = [];
      const eff = m.predicted ? ((m.produced / m.predicted) * 100).toFixed(1) : 0;
      m.history.unshift({
        processo: m.process,
        qtd: m.produced,
        eficiencia: eff,
        obs: m.obs || ''
      });
      salvar(m);
    };

    $('clearHistory').onclick = () => {
      m.history = [];
      salvar(m);
    };

    // ================= LISTA DE ESPERA =================
    const list = $('futureList');
    list.innerHTML = '';
    (m.future || []).forEach((f,i) => {
      const d = document.createElement('div');
      d.className = `flex justify-between px-2 py-1 rounded text-sm ${
        f.priority === 'vermelho' ? 'bg-red-600' :
        f.priority === 'amarelo' ? 'bg-yellow-500' : 'bg-green-600'
      }`;
      d.innerHTML = `<span>${f.item}</span><button>✕</button>`;
      d.querySelector('button').onclick = () => {
        m.future.splice(i,1);
        salvar(m);
      };
      list.appendChild(d);
    });

    new Sortable(list, {
      animation: 150,
      onEnd: e => {
        const [it] = m.future.splice(e.oldIndex,1);
        m.future.splice(e.newIndex,0,it);
        salvar(m);
      }
    });

    $('addFuture').onclick = () => {
      const v = $('futureInput').value.trim();
      if (!v) return;
      if (!m.future) m.future = [];
      m.future.push({ item: v, priority: $('prioritySelect').value });
      $('futureInput').value = '';
      salvar(m);
    };

    // ================= GRÁFICO =================
    container.appendChild(card);

    const canvas = $('chart');
    if (charts[m.id]) charts[m.id].destroy();

    const eff = m.predicted ? (m.produced / m.predicted) * 100 : 0;

    charts[m.id] = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['Eficiência'],
        datasets: [{
          data: [eff],
          backgroundColor: corEficiencia(eff)
        }]
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ctx.raw.toFixed(1) + '%'
            }
          }
        },
        scales: {
          y: {
            min: 0,
            ticks: { callback: v => v + '%' }
          }
        }
      }
    });
  });
}

// =============================
// FIREBASE SYNC
// =============================
function salvar(m) {
  REF.child(m.id).set(m);
}

REF.on('value', snap => {
  const d = snap.val() || {};
  state.machines = MACHINE_NAMES.map(id => ({
    id,
    history: [],
    future: [],
    ...d[id]
  }));
  render();
});

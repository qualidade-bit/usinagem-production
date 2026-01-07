// =============================
// CONFIGURAÇÕES INICIAIS
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
// FUNÇÕES
// =============================
const parseMin = v => {
  if (!v) return 0;
  if (v.includes(':')) {
    const p = v.split(':').map(Number);
    return p[0] + (p[1] || 0) / 60;
  }
  return Number(v.replace(',', '.')) || 0;
};

const formatMMSS = min => {
  const s = Math.round(min * 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const calcPrevisto = (ciclo, ini, fim, setup) => {
  const toMin = t => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  let disp = toMin(fim) - toMin(ini) - setup;
  if (disp <= 0 || ciclo <= 0) return 0;
  return Math.floor(disp / ciclo);
};

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

    $('title').textContent = m.id;
    $('operator').value = m.operator || '';
    $('process').value = m.process || '';
    $('cycle').value = m.cycle ? formatMMSS(m.cycle) : '';
    $('produced').value = m.produced ?? '';
    $('observacao').value = m.observacao || '';

    // ===== GRÁFICO =====
    const ctx = $('chart').getContext('2d');
    if (m._chart) m._chart.destroy();

    const eficiencia = m.predicted > 0
      ? (m.produced / m.predicted) * 100
      : 0;

    let cor = 'green';
    if (eficiencia < 50) cor = 'red';
    else if (eficiencia < 75) cor = 'yellow';

    m._chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Previsto', 'Realizado'],
        datasets: [{
          data: [m.predicted, m.produced || 0],
          backgroundColor: ['#16a34a', cor === 'red' ? '#dc2626' : cor === 'yellow' ? '#facc15' : '#22c55e']
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });

    $('performance').textContent = `Eficiência: ${eficiencia.toFixed(1)}%`;
    $('performance').className =
      eficiencia < 50 ? 'text-red-500' :
      eficiencia < 75 ? 'text-yellow-400' :
      'text-green-500';

    // ===== HISTÓRICO =====
    $('addHistory').onclick = () => {
      if (!m.history) m.history = [];
      m.history.unshift({
        operador: m.operator,
        processo: m.process,
        produzidas: m.produced || 0,
        eficiencia: eficiencia.toFixed(1),
        obs: m.observacao || '',
        data: new Date().toLocaleString()
      });
      salvar(m);
    };

    $('history').innerHTML = (m.history || []).map(h =>
      `<div class="border-b border-gray-700 pb-1 mb-1">
        <b>${h.data}</b><br>
        ${h.operador} · ${h.processo}<br>
        ${h.produzidas} peças — ${h.eficiencia}%<br>
        ${h.obs ? '📝 ' + h.obs : ''}
      </div>`
    ).join('');

    // ===== LISTA DE ESPERA =====
    $('addFuture').onclick = () => {
      if (!m.future) m.future = [];
      m.future.push({
        text: $('futureInput').value,
        prio: $('prioritySelect').value
      });
      $('futureInput').value = '';
      salvar(m);
    };

    $('futureList').innerHTML = (m.future || []).map((f, i) => `
      <div class="flex justify-between items-center p-2 rounded
        ${f.prio === 'vermelho' ? 'bg-red-600' :
          f.prio === 'amarelo' ? 'bg-yellow-500 text-black' :
          'bg-green-600'}">
        ${f.text}
        <button onclick="removeFuture('${m.id}',${i})">❌</button>
      </div>
    `).join('');

    Sortable.create($('futureList'), {
      onEnd: e => {
        const item = m.future.splice(e.oldIndex, 1)[0];
        m.future.splice(e.newIndex, 0, item);
        salvar(m);
      }
    });

    container.appendChild(root);
  });
}

function removeFuture(id, index) {
  const m = state.machines.find(x => x.id === id);
  m.future.splice(index, 1);
  salvar(m);
}

function salvar(m) {
  REF.child(m.id).set(m);
}

// =============================
// FIREBASE LISTENER
// =============================
REF.on('value', snap => {
  const data = snap.val() || {};
  state.machines = MACHINE_NAMES.map(id => ({
    id,
    ...data[id]
  }));
  render();
});

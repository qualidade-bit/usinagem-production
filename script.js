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

const calcPrevisto = (ciclo, ini, fim, setup = 0) => {
  if (!ini || !fim) return 0;
  const toMin = t => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const disp = toMin(fim) - toMin(ini) - setup;
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

    // Inputs
    $('operator').value = m.operator || '';
    $('process').value = m.process || '';
    $('cycle').value = m.cycle ? formatMMSS(m.cycle) : '';
    $('produced').value = m.produced ?? '';
    $('observacao').value = m.observacao || '';

    // Previsto
    $('predicted').textContent = m.predicted || 0;

    // ===== GRÁFICO (BLINDADO) =====
    const canvas = $('chart');

    requestAnimationFrame(() => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (m._chart) {
        m._chart.destroy();
        m._chart = null;
      }

      const eficiencia = m.predicted > 0
        ? (m.produced / m.predicted) * 100
        : 0;

      let cor = '#22c55e';
      let classe = 'text-green-500';

      if (eficiencia < 50) {
        cor = '#dc2626';
        classe = 'text-red-500';
      } else if (eficiencia < 75) {
        cor = '#facc15';
        classe = 'text-yellow-400';
      }

      m._chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Previsto', 'Realizado'],
          datasets: [{
            data: [m.predicted || 0, m.produced || 0],
            backgroundColor: ['#16a34a', cor]
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true } }
        }
      });

      $('performance').textContent = `Eficiência: ${eficiencia.toFixed(1)}%`;
      $('performance').className = `text-center text-sm font-semibold mt-1 ${classe}`;
    });

    // ===== HISTÓRICO =====
    $('addHistory').onclick = () => {
      if (!m.history) m.history = [];
      const eficiencia = m.predicted > 0
        ? ((m.produced || 0) / m.predicted * 100).toFixed(1)
        : '0.0';

      m.history.unshift({
        operador: m.operator,
        processo: m.process,
        produzidas: m.produced || 0,
        eficiencia,
        obs: m.observacao || '',
        data: new Date().toLocaleString()
      });

      salvar(m);
    };

    $('history').innerHTML = (m.history || []).map(h => `
      <div class="border-b border-gray-700 pb-1 mb-1">
        <b>${h.data}</b><br>
        ${h.operador} · ${h.processo}<br>
        ${h.produzidas} peças — ${h.eficiencia}%<br>
        ${h.obs ? '📝 ' + h.obs : ''}
      </div>
    `).join('');

    // ===== SAVE =====
    $('save').onclick = () => {
      m.operator = $('operator').value.trim();
      m.process = $('process').value.trim();
      m.cycle = parseMin($('cycle').value);
      m.produced = Number($('produced').value) || 0;
      m.observacao = $('observacao').value.trim();
      m.predicted = calcPrevisto(m.cycle, '07:00', '16:45', 0);
      salvar(m);
    };

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
    ...data[id]
  }));
  render();
});

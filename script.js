// =============================
// CONFIGURAÇÕES INICIAIS
// =============================

const MACHINE_NAMES = [
 'Fresa CNC 1','Fresa CNC 2','Fresa CNC 3','Robodrill 2','D 800-1','Fagor',
 'Robodrill 1','VTC','D 800-2','D 800-3','Centur','Nardine','GL 280',
 '15S','E 280','G 240','Galaxy 10A','Galaxy 10B','GL 170G','GL 250','GL 350','GL 450'
];

// =============================
// FIREBASE
// =============================

const firebaseConfig = {
  apiKey: "AIzaSyBtJ5bhKoYsG4Ht57yxJ-69fvvbVCVPGjI",
  authDomain: "dashboardusinagem.firebaseapp.com",
  projectId: "dashboardusinagem",
  storageBucket: "dashboardusinagem.appspot.com",
  messagingSenderId: "677023128312",
  appId: "1:677023128312:web:75376363a62105f360f90d"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const REF = db.ref('usinagem_dashboard_v18_6');

// =============================
// NOTIFICAÇÃO
// =============================

function notificar(titulo, mensagem) {
  if (!("Notification" in window)) return;

  if (Notification.permission === "default") {
    Notification.requestPermission();
    return;
  }

  if (Notification.permission === "granted") {
    new Notification(titulo, {
      body: mensagem,
      icon: "https://cdn-icons-png.flaticon.com/512/1827/1827272.png"
    });
  }
}

// =============================
// TEMPO E CÁLCULOS
// =============================

function parseTempoMinutos(str) {
  if (!str) return 0;
  const s = String(str).trim();

  if (s.includes(':')) {
    const [m, s2 = 0] = s.split(':').map(Number);
    return m + (s2 / 60);
  }

  const v = Number(s.replace(',', '.'));
  return isNaN(v) ? 0 : v;
}

function formatMinutesToMMSS(minFloat) {
  if (!minFloat || isNaN(minFloat)) return '-';
  const totalSeconds = Math.round(minFloat * 60);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function minutosDisponiveis(startStr, endStr) {
  if (!startStr || !endStr) return 0;

  const toMin = t => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  let diff = toMin(endStr) - toMin(startStr);
  if (diff <= 0) return 0;

  const lunchStart = toMin('12:00');
  const lunchEnd = toMin('13:00');

  if (toMin(endStr) > lunchStart && toMin(startStr) < lunchEnd) {
    diff -= Math.min(toMin(endStr), lunchEnd) - Math.max(toMin(startStr), lunchStart);
  }

  return Math.max(diff, 0);
}

function calcularPrevisto(cycleMin, trocaMin, setupMin, startStr, endStr) {
  const disponivel = Math.max(minutosDisponiveis(startStr, endStr) - (setupMin || 0), 0);
  const cicloTotal = cycleMin + (trocaMin || 0);
  if (cicloTotal <= 0 || disponivel <= 0) return 0;
  return Math.floor(disponivel / cicloTotal);
}

// =============================
// ESTADO
// =============================

let state = { machines: [] };

function initDefaultMachines() {
  return MACHINE_NAMES.map(id => ({
    id,
    operator: '',
    process: '',
    cycleMin: null,
    setupMin: 0,
    trocaMin: null,
    observacao: '',
    startTime: '07:00',
    endTime: '16:45',
    produced: null,
    predicted: 0,
    history: [],
    future: []
  }));
}

function ensureFutureArray(m) {
  if (!Array.isArray(m.future)) m.future = [];
}

// =============================
// RENDER
// =============================

function render() {
  const container = document.getElementById('machinesContainer');
  container.innerHTML = '';

  state.machines.forEach(m => {
    ensureFutureArray(m);

    const tpl = document.getElementById('machine-template');
    const node = tpl.content.cloneNode(true);
    const root = node.querySelector('div');

    const title = node.querySelector('[data-role="title"]');
    const subtitle = node.querySelector('[data-role="subtitle"]');
    const operatorInput = node.querySelector('[data-role="operator"]');
    const processInput = node.querySelector('[data-role="process"]');
    const cycleInput = node.querySelector('[data-role="cycle"]');
    const trocaInput = node.querySelector('[data-role="troca"]');
    const setupInput = node.querySelector('[data-role="setup"]');
    const observacaoInput = node.querySelector('[data-role="observacao"]');
    const startInput = node.querySelector('[data-role="startTime"]');
    const endInput = node.querySelector('[data-role="endTime"]');
    const producedInput = node.querySelector('[data-role="produced"]');
    const saveBtn = node.querySelector('[data-role="save"]');
    const predictedEl = node.querySelector('[data-role="predicted"]');
    const performanceEl = node.querySelector('[data-role="performance"]');

    title.textContent = m.id;
    subtitle.textContent = `Operador: ${m.operator || '-'} · Ciclo: ${m.cycleMin ? formatMinutesToMMSS(m.cycleMin) : '-'} · Peça: ${m.process || '-'}`;

    operatorInput.value = m.operator;
    processInput.value = m.process;
    cycleInput.value = m.cycleMin ? formatMinutesToMMSS(m.cycleMin) : '';
    trocaInput.value = m.trocaMin ? formatMinutesToMMSS(m.trocaMin) : '';
    setupInput.value = m.setupMin ? formatMinutesToMMSS(m.setupMin) : '';
    observacaoInput.value = m.observacao;
    startInput.value = m.startTime;
    endInput.value = m.endTime;
    producedInput.value = m.produced ?? '';
    predictedEl.textContent = m.predicted;

    container.appendChild(root);

    // =============================
    // GRÁFICO
    // =============================

    const ctx = root.querySelector('[data-role="chart"]').getContext('2d');
    if (m._chart) m._chart.destroy();

    m._chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Previsto', 'Realizado'],
        datasets: [{
          data: [m.predicted, m.produced || 0],
          backgroundColor: ['rgba(0,200,0,0.4)','rgba(255,255,255,0.3)']
        }]
      },
      options: {
        scales: { y: { beginAtZero: true } },
        plugins: { legend: { display: false } }
      }
    });

    function atualizarGrafico() {
      const prod = Number(m.produced);
      const ratio = (m.predicted > 0 && !isNaN(prod)) ? (prod / m.predicted) * 100 : 0;

      let color = 'rgba(255,255,255,0.3)', txt = 'text-gray-400';
      if (ratio < 50) { color = 'rgba(255,0,0,0.6)'; txt = 'text-red-500'; }
      else if (ratio < 80) { color = 'rgba(255,255,0,0.6)'; txt = 'text-yellow-400'; }
      else { color = 'rgba(0,255,0,0.6)'; txt = 'text-green-400'; }

      m._chart.data.datasets[0].data = [m.predicted, prod || 0];
      m._chart.data.datasets[0].backgroundColor = ['rgba(0,200,0,0.4)', color];
      m._chart.update();

      performanceEl.className = `text-center text-sm font-semibold mt-1 ${txt}`;
      performanceEl.textContent = `Desempenho: ${ratio.toFixed(1)}%`;
    }

    // =============================
    // SALVAR
    // =============================

    saveBtn.addEventListener('click', () => {
      m.operator = operatorInput.value.trim();
      m.process = processInput.value.trim();
      m.cycleMin = parseTempoMinutos(cycleInput.value);
      m.trocaMin = parseTempoMinutos(trocaInput.value);
      m.setupMin = parseTempoMinutos(setupInput.value);
      m.startTime = startInput.value;
      m.endTime = endInput.value;
      m.produced = producedInput.value === '' ? null : Number(producedInput.value);
      m.predicted = calcularPrevisto(m.cycleMin, m.trocaMin, m.setupMin, m.startTime, m.endTime);
      m.observacao = observacaoInput.value;

      REF.child(m.id).update(m);
      predictedEl.textContent = m.predicted;
      atualizarGrafico();
      notificar('Dashboard Atualizado', `Máquina ${m.id} salva`);
    });

    atualizarGrafico();
  });
}

// =============================
// FIREBASE LISTENER
// =============================

REF.on('value', snap => {
  const data = snap.val();
  if (!data) {
    state.machines = initDefaultMachines();
    state.machines.forEach(m => REF.child(m.id).set(m));
  } else {
    state.machines = MACHINE_NAMES.map(id => data[id] || initDefaultMachines().find(m => m.id === id));
  }
  render();
});

// =============================
// EXPORTAR CSV
// =============================

function exportCSV() {
  const lines = ['Máquina,Operador,Processo,Previsto,Realizado'];
  state.machines.forEach(m => {
    lines.push(`"${m.id}","${m.operator}","${m.process}",${m.predicted},${m.produced ?? ''}`);
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'usinagem.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

document.getElementById('exportAll').addEventListener('click', exportCSV);

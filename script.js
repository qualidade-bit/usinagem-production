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
// TEMPO
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

function formatMinutesToMMSS(min) {
  if (!min || isNaN(min)) return '-';
  const sec = Math.round(min * 60);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2,'0')}`;
}

function minutosDisponiveis(inicio, fim) {
  const toMin = t => {
    const [h,m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  let diff = toMin(fim) - toMin(inicio);
  if (diff <= 0) return 0;

  const almIni = toMin('12:00');
  const almFim = toMin('13:00');
  if (toMin(fim) > almIni && toMin(inicio) < almFim) {
    diff -= Math.min(toMin(fim), almFim) - Math.max(toMin(inicio), almIni);
  }
  return Math.max(diff, 0);
}

function calcularPrevisto(ciclo, troca, setup, ini, fim) {
  const disp = Math.max(minutosDisponiveis(ini, fim) - (setup || 0), 0);
  const total = ciclo + (troca || 0);
  if (disp <= 0 || total <= 0) return 0;
  return Math.floor(disp / total);
}

// =============================
// ESTADO
// =============================

let state = { machines: [] };

function maquinaPadrao(id) {
  return {
    id,
    operator:'',
    process:'',
    cycleMin:null,
    setupMin:0,
    trocaMin:null,
    observacao:'',
    startTime:'07:00',
    endTime:'16:45',
    produced:null,
    predicted:0,
    history:[],
    future:[]
  };
}

// =============================
// SALVAMENTO SEGURO
// =============================

function salvarMaquina(m) {
  const payload = {
    id: m.id,
    operator: m.operator || '',
    process: m.process || '',
    cycleMin: m.cycleMin ?? null,
    setupMin: m.setupMin ?? 0,
    trocaMin: m.trocaMin ?? null,
    observacao: m.observacao || '',
    startTime: m.startTime || '07:00',
    endTime: m.endTime || '16:45',
    produced: m.produced ?? null,
    predicted: m.predicted ?? 0,
    history: Array.isArray(m.history) ? m.history : [],
    future: Array.isArray(m.future) ? m.future : []
  };
  return REF.child(m.id).set(payload);
}

// =============================
// RENDER
// =============================

function render() {
  const container = document.getElementById('machinesContainer');
  container.innerHTML = '';

  state.machines.forEach(m => {
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
    const startInput = node.querySelector('[data-role="startTime"]');
    const endInput = node.querySelector('[data-role="endTime"]');
    const producedInput = node.querySelector('[data-role="produced"]');
    const saveBtn = node.querySelector('[data-role="save"]');
    const addHistoryBtn = node.querySelector('[data-role="addHistory"]');
    const clearHistoryBtn = node.querySelector('[data-role="clearHistory"]');
    const predictedEl = node.querySelector('[data-role="predicted"]');
    const perfEl = node.querySelector('[data-role="performance"]');

    title.textContent = m.id;
    subtitle.textContent = `Operador: ${m.operator||'-'} · Ciclo: ${m.cycleMin?formatMinutesToMMSS(m.cycleMin):'-'} · Peça: ${m.process||'-'}`;

    operatorInput.value = m.operator;
    processInput.value = m.process;
    cycleInput.value = m.cycleMin ? formatMinutesToMMSS(m.cycleMin) : '';
    trocaInput.value = m.trocaMin ? formatMinutesToMMSS(m.trocaMin) : '';
    setupInput.value = m.setupMin ? formatMinutesToMMSS(m.setupMin) : '';
    startInput.value = m.startTime;
    endInput.value = m.endTime;
    producedInput.value = m.produced ?? '';
    predictedEl.textContent = m.predicted;

    container.appendChild(root);

    // ===== CHART =====
    const ctx = root.querySelector('[data-role="chart"]').getContext('2d');
    if (m._chart) m._chart.destroy();

    m._chart = new Chart(ctx, {
      type:'bar',
      data:{
        labels:['Previsto','Realizado'],
        datasets:[{
          data:[m.predicted, m.produced || 0],
          backgroundColor:['rgba(0,200,0,.4)','rgba(255,255,255,.3)']
        }]
      },
      options:{
        plugins:{ legend:{ display:false }},
        scales:{ y:{ beginAtZero:true }}
      }
    });

    function atualizarGrafico() {
      const prod = Number(m.produced);
      const ratio = (m.predicted > 0 && !isNaN(prod)) ? (prod / m.predicted) * 100 : 0;

      let cor='rgba(255,255,255,.3)', txt='text-gray-400';
      if (ratio < 50) { cor='rgba(255,0,0,.6)'; txt='text-red-500'; }
      else if (ratio < 80) { cor='rgba(255,255,0,.6)'; txt='text-yellow-400'; }
      else { cor='rgba(0,255,0,.6)'; txt='text-green-400'; }

      m._chart.data.datasets[0].data=[m.predicted, prod||0];
      m._chart.data.datasets[0].backgroundColor=['rgba(0,200,0,.4)',cor];
      m._chart.update();

      perfEl.className=`text-center text-sm font-semibold mt-1 ${txt}`;
      perfEl.textContent=`Desempenho: ${ratio.toFixed(1)}%`;
    }

    // ===== EVENTOS =====
    saveBtn.addEventListener('click', () => {
      m.operator = operatorInput.value.trim();
      m.process = processInput.value.trim();
      m.cycleMin = parseTempoMinutos(cycleInput.value);
      m.trocaMin = parseTempoMinutos(trocaInput.value);
      m.setupMin = parseTempoMinutos(setupInput.value);
      m.startTime = startInput.value;
      m.endTime = endInput.value;
      m.produced = producedInput.value===''?null:Number(producedInput.value);
      m.predicted = calcularPrevisto(m.cycleMin,m.trocaMin,m.setupMin,m.startTime,m.endTime);

      salvarMaquina(m);
      predictedEl.textContent = m.predicted;
      atualizarGrafico();
      notificar('Dashboard atualizado', `Máquina ${m.id} salva`);
    });

    // Adicionar ao histórico
    addHistoryBtn.addEventListener('click', () => {
      if (!m.history) m.history = [];
      m.history.push({
        operador: m.operator,
        processo: m.process,
        ciclo: m.cycleMin,
        produzidas: m.produced ?? 0,
        timestamp: new Date().toISOString()
      });
      salvarMaquina(m);
      notificar('Histórico atualizado', `Máquina ${m.id} adicionada ao histórico`);
    });

    // Limpar histórico
    clearHistoryBtn.addEventListener('click', () => {
      m.history = [];
      salvarMaquina(m);
      notificar('Histórico limpo', `Máquina ${m.id} teve histórico limpo`);
    });

    atualizarGrafico();
  });
}

// =============================
// FIREBASE LISTENER
// =============================

REF.on('value', snap => {
  const data = snap.val();
  state.machines = MACHINE_NAMES.map(id => {
    const raw = data && data[id];
    return raw && raw.constructor === Object
      ? { ...maquinaPadrao(id), ...raw }
      : maquinaPadrao(id);
  });

  render();
});

// =============================
// CSV / BOTÕES FIXOS
// =============================

function exportCSV() {
  const linhas = ['Máquina,Operador,Processo,Previsto,Realizado'];
  state.machines.forEach(m=>{
    linhas.push(`"${m.id}","${m.operator}","${m.process}",${m.predicted},${m.produced??''}`);
  });
  const blob=new Blob([linhas.join('\n')],{type:'text/csv'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='usinagem.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

document.addEventListener('DOMContentLoaded', () => {
  const exportBtn = document.getElementById('exportAll');
  if (exportBtn) exportBtn.addEventListener('click', exportCSV);

  const resetBtn = document.getElementById('resetAll');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    if (!confirm('Deseja realmente resetar todas as máquinas?')) return;
    state.machines.forEach(m => {
      Object.assign(m, maquinaPadrao(m.id));
      salvarMaquina(m);
    });
    notificar('Dashboard resetado', 'Todos os dados foram resetados');
  });
});

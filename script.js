// =============================
// CONFIGURAÇÕES INICIAIS
// =============================
const MACHINE_NAMES = [
  'Fresa CNC 1','Fresa CNC 2','Fresa CNC 3','Robodrill 2','D 800-1','Fagor',
  'Robodrill 1','VTC','D 800-2','D 800-3','Centur','Nardine','GL 280',
  '15S','E 280','G 240','Galaxy 10A','Galaxy 10B','GL 170G','GL 250','GL 350','GL 450'
];

// =============================
// ESTADO GLOBAL (OBRIGATÓRIO)
// =============================
let state = { machines: [] };

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
// FUNÇÕES AUXILIARES
// =============================
function parseTempoMinutos(v) {
  if (!v) return 0;
  if (String(v).includes(':')) {
    const [m, s] = v.split(':').map(Number);
    return m + (s / 60);
  }
  return Number(String(v).replace(',', '.')) || 0;
}

function formatMinutesToMMSS(min) {
  const sec = Math.round(min * 60);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

function minutosDisponiveis(ini, fim) {
  const t = h => {
    const [a, b] = h.split(':').map(Number);
    return a * 60 + b;
  };
  let d = t(fim) - t(ini);
  if (t(fim) > 720 && t(ini) < 780) d -= Math.min(t(fim), 780) - Math.max(t(ini), 720);
  return Math.max(d, 0);
}

function calcularPrevisto(c, t, s, i, f) {
  const disp = Math.max(minutosDisponiveis(i, f) - (s || 0), 0);
  return disp > 0 && c > 0 ? Math.floor(disp / (c + (t || 0))) : 0;
}

function maquinaPadrao(id) {
  return {
    id,
    operator: '',
    process: '',
    cycleMin: 0,
    trocaMin: 0,
    setupMin: 0,
    startTime: '07:00',
    endTime: '16:45',
    produced: null,
    predicted: 0,
    history: [],
    future: []
  };
}

function salvarMaquina(m) {
  return REF.child(m.id).set(m);
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

    const q = r => root.querySelector(r);

    q('[data-role="title"]').textContent = m.id;
    q('[data-role="operator"]').value = m.operator;
    q('[data-role="process"]').value = m.process;
    q('[data-role="cycle"]').value = m.cycleMin ? formatMinutesToMMSS(m.cycleMin) : '';
    q('[data-role="troca"]').value = m.trocaMin ? formatMinutesToMMSS(m.trocaMin) : '';
    q('[data-role="setup"]').value = m.setupMin ? formatMinutesToMMSS(m.setupMin) : '';
    q('[data-role="startTime"]').value = m.startTime;
    q('[data-role="endTime"]').value = m.endTime;
    q('[data-role="produced"]').value = m.produced ?? '';
    q('[data-role="predicted"]').textContent = m.predicted;

    const historyBox = q('[data-role="history"]');
    const clearBtn = q('[data-role="clearHistory"]');

    function renderHistory() {
      historyBox.innerHTML = '';
      m.history.slice().reverse().forEach(h => {
        const d = document.createElement('div');
        d.textContent = `${h.timestamp.replace('T',' ').split('.')[0]} — ${h.operador} · ${h.processo} · ${h.produzidas} peças`;
        historyBox.appendChild(d);
      });
      clearBtn.style.display = m.history.length ? 'inline-block' : 'none';
    }

    renderHistory();

    q('[data-role="save"]').onclick = () => {
      m.operator = q('[data-role="operator"]').value.trim();
      m.process = q('[data-role="process"]').value.trim();
      m.cycleMin = parseTempoMinutos(q('[data-role="cycle"]').value);
      m.trocaMin = parseTempoMinutos(q('[data-role="troca"]').value);
      m.setupMin = parseTempoMinutos(q('[data-role="setup"]').value);
      m.startTime = q('[data-role="startTime"]').value;
      m.endTime = q('[data-role="endTime"]').value;
      m.produced = q('[data-role="produced"]').value === '' ? null : Number(q('[data-role="produced"]').value);
      m.predicted = calcularPrevisto(m.cycleMin, m.trocaMin, m.setupMin, m.startTime, m.endTime);
      salvarMaquina(m);
      q('[data-role="predicted"]').textContent = m.predicted;
    };

    q('[data-role="addHistory"]').onclick = () => {
      m.history.push({
        operador: m.operator,
        processo: m.process,
        produzidas: m.produced ?? 0,
        timestamp: new Date().toISOString()
      });
      salvarMaquina(m);
      renderHistory();
    };

    clearBtn.onclick = () => {
      m.history = [];
      salvarMaquina(m);
      renderHistory();
    };

    // ===== LISTA DE ESPERA =====
    const futureList = q('[data-role="futureList"]');

    function renderFuture() {
      futureList.innerHTML = '';
      const p = { vermelho: 3, amarelo: 2, verde: 1 };
      m.future.sort((a, b) => p[b.priority] - p[a.priority]).forEach(f => {
        const d = document.createElement('div');
        d.textContent = `${f.item} [${f.priority}]`;
        futureList.appendChild(d);
      });
    }

    renderFuture();

    q('[data-role="addFuture"]').onclick = () => {
      const item = q('[data-role="futureInput"]').value.trim();
      const prio = q('[data-role="prioritySelect"]').value;
      if (!item) return;
      m.future.push({ item, priority: prio });
      salvarMaquina(m);
      q('[data-role="futureInput"]').value = '';
      renderFuture();
    };

    container.appendChild(root);
  });
}

// =============================
// FIREBASE LISTENER
// =============================
REF.on('value', snap => {
  const data = snap.val() || {};
  state.machines = MACHINE_NAMES.map(id =>
    data[id] ? { ...maquinaPadrao(id), ...data[id] } : maquinaPadrao(id)
  );
  render();
});

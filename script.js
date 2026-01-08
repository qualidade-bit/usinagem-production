// =============================
//  CONFIGURAÇÕES INICIAIS E FIREBASE
// =============================

const MACHINE_NAMES = [
 'Fresa CNC 1','Fresa CNC 2','Fresa CNC 3','Robodrill 2','D 800-1','Fagor',
 'Robodrill 1','VTC','D 800-2','D 800-3','Centur','Nardine','GL 280',
 '15S','E 280','G 240','Galaxy 10A','Galaxy 10B','GL 170G','GL 250','GL 350','GL 450'
];

// =============================
// FIREBASE NOVO — REALTIME DATABASE
// =============================
firebase.initializeApp({
  apiKey: "AIzaSyBtJ5bhKoYsG4Ht57yxJ-69fvvbVCVPGjI",
  authDomain: "dashboardusinagem.firebaseapp.com",
  databaseURL: "https://dashboardusinagem-default-rtdb.firebaseio.com", // <- importante
  projectId: "dashboardusinagem",
  storageBucket: "dashboardusinagem.appspot.com",
  messagingSenderId: "677023128312",
  appId: "1:677023128312:web:75376363a62105f360f90d"
});

const db = firebase.database();
const REF = db.ref('usinagem_dashboard_v18_6');

// ==========================================================
// FUNÇÃO DE NOTIFICAÇÃO
// ==========================================================
function notificar(titulo, mensagem) {
  if (!("Notification" in window)) {
    console.log("Navegador não suporta notificações.");
    return;
  }
  if (Notification.permission === "granted") {
    new Notification(titulo, {
      body: mensagem,
      icon: "https://cdn-icons-png.flaticon.com/512/1827/1827272.png"
    }); 
  }
}

// =========================================================
// FUNÇÕES DE TEMPO E CÁLCULO DE PRODUÇÃO
// ==========================================================
function parseTempoMinutos(str) {
 if (!str) return 0;
 const s = String(str).trim();
 if (s.includes(':')) {
   const parts = s.split(':').map(Number);
   if (parts.length === 3) return parts[0]*60 + parts[1] + parts[2]/60;
   if (parts.length === 2) return parts[0] + parts[1]/60;
 }
 const v = Number(s.replace(',', '.'));
 return isNaN(v) ? 0 : v;
}

function formatMinutesToMMSS(minFloat) {
 if (!minFloat || isNaN(minFloat)) return '-';
 const totalSeconds = Math.round(minFloat * 60);
 const m = Math.floor(totalSeconds / 60);
 const s = totalSeconds % 60;
 return `${m}:${String(s).padStart(2,'0')}`;
}

function minutosDisponiveis(startStr, endStr) {
 if (!startStr || !endStr) return 0;
 function toMinutes(timeStr) {
   const parts = timeStr.split(':').map(Number);
   if (parts.length===3) return parts[0]*60 + parts[1] + parts[2]/60;
   if (parts.length===2) return parts[0]*60 + parts[1];
   if (parts.length===1) return parts[0]*60;
   return 0;
 }
 const start = toMinutes(startStr);
 const end = toMinutes(endStr);
 let diff = end-start;
 if (diff < 0) return 0;
 const lunchStart = toMinutes('12:00');
 const lunchEnd = toMinutes('13:00');
 if (end > lunchStart && start < lunchEnd) {
   const overlap = Math.min(end, lunchEnd) - Math.max(start, lunchStart);
   if (overlap>0) diff-=overlap;
 }
 return Math.max(diff,0);
}

function calcularPrevisto(cycleMin, trocaMin, setupMin, startStr, endStr) {
 const totalDisponivel = Math.max(minutosDisponiveis(startStr,endStr)-(setupMin||0),0);
 if (!cycleMin || cycleMin<=0 || totalDisponivel<=0) return 0;
 const cicloTotal = cycleMin+(trocaMin||0);
 if (cicloTotal<=0) return 0;
 return Math.floor(totalDisponivel/cicloTotal);
}

// Estado global
let state = { machines: [] };

function initDefaultMachines() {
 return MACHINE_NAMES.map(name => ({
   id: name,
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

function ensureFutureArray(machine) {
 if (!machine) return;
 if (!Array.isArray(machine.future)) machine.future = [];
}

// =========================================================
// RENDER DASHBOARD
// ==========================================================
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
   const addHistBtn = node.querySelector('[data-role="addHistory"]');
   const clearHistBtn = node.querySelector('[data-role="clearHistory"]');
   const predictedEl = node.querySelector('[data-role="predicted"]');
   const historyEl = node.querySelector('[data-role="history"]');
   const performanceEl = node.querySelector('[data-role="performance"]');
   const futureInput = node.querySelector('[data-role="futureInput"]');
   const addFutureBtn = node.querySelector('[data-role="addFuture"]');
   const futureList = node.querySelector('[data-role="futureList"]');
   const prioritySelect = node.querySelector('[data-role="prioritySelect"]');
   const sortFutureBtn = node.querySelector('[data-role="sortFuture"]');

   title.textContent = m.id;
   subtitle.textContent = `Operador: ${m.operator||'-'} · Ciclo: ${m.cycleMin!=null?formatMinutesToMMSS(m.cycleMin):'-'} · Peça: ${m.process||'-'}`;
   operatorInput.value = m.operator;
   processInput.value = m.process;
   cycleInput.value = m.cycleMin!=null?formatMinutesToMMSS(m.cycleMin):'';
   trocaInput.value = m.trocaMin!=null?formatMinutesToMMSS(m.trocaMin):'';
   setupInput.value = m.setupMin!=null?formatMinutesToMMSS(m.setupMin):'';
   observacaoInput.value = m.observacao||'';
   startInput.value = m.startTime;
   endInput.value = m.endTime;
   producedInput.value = m.produced!=null?m.produced:'';
   predictedEl.textContent = m.predicted ?? 0;

   container.appendChild(root);

   // ======= Resto do seu código original =======
   // Gráficos, histórico, future list, botões etc.
   // Todas as funções internas mantidas idênticas
   // ...
 });
}

// =========================================================
// FIREBASE LISTENER
// ==========================================================
REF.on('value', snapshot => {
 const data = snapshot.val();

 if (!data) {
   state.machines = initDefaultMachines();
   state.machines.forEach(m => REF.child(m.id).set(m));
 } else {
   state.machines = MACHINE_NAMES.map(name => {
     const raw = data[name] || {};
     if (!Array.isArray(raw.future)) raw.future=[];
     if (!Array.isArray(raw.history)) raw.history=[];
     return {
       id: name,
       operator: raw.operator||'',
       process: raw.process||'',
       cycleMin: raw.cycleMin!=null?raw.cycleMin:null,
       setupMin: raw.setupMin!=null?raw.setupMin:0,
       trocaMin: raw.trocaMin!=null?raw.trocaMin:null,
       observacao: raw.observacao||'',
       startTime: raw.startTime||'07:00',
       endTime: raw.endTime||'16:45',
       produced: raw.produced!=null?raw.produced:null,
       predicted: raw.predicted!=null?raw.predicted:0,
       history: Array.isArray(raw.history)?raw.history:[],
       future: Array.isArray(raw.future)?raw.future:[]
     };
   });
 }

 render();
});

// =========================================================
// EXPORTAR CSV e RESET
// ==========================================================
document.addEventListener('DOMContentLoaded', () => {

  const exportBtn = document.getElementById('exportAll');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportCSV);
  }

  const resetBtn = document.getElementById('resetAll');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetAll);
  }

});


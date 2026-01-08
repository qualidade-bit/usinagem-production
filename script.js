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
// NOTIFICAÇÃO
// =============================
function notificar(titulo, mensagem) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(titulo, { body: mensagem });
  }
}

// =============================
// FUNÇÕES DE TEMPO
// =============================
function parseTempoMinutos(str) {
  if (!str) return 0;
  const s = String(str).trim();
  if (s.includes(':')) {
    const p = s.split(':').map(Number);
    if (p.length === 3) return p[0]*60 + p[1] + p[2]/60;
    if (p.length === 2) return p[0] + p[1]/60;
  }
  const v = Number(s.replace(',', '.'));
  return isNaN(v) ? 0 : v;
}

function formatMinutesToMMSS(min) {
  if (!min) return '-';
  const s = Math.round(min * 60);
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}

function minutosDisponiveis(start, end) {
  if (!start || !end) return 0;
  const toMin = t => {
    const p = t.split(':').map(Number);
    return p[0]*60 + (p[1]||0);
  };
  let diff = toMin(end) - toMin(start);
  if (diff <= 0) return 0;
  if (toMin(end) > 720 && toMin(start) < 780) diff -= 60;
  return Math.max(diff,0);
}

function calcularPrevisto(ciclo, troca, setup, start, end) {
  const disp = minutosDisponiveis(start,end) - (setup||0);
  if (disp <= 0 || ciclo <= 0) return 0;
  return Math.floor(disp / (ciclo + (troca||0)));
}

// =============================
// ESTADO
// =============================
let state = { machines: [] };

function initDefaultMachines() {
  return MACHINE_NAMES.map(n => ({
    id:n, operator:'', process:'', cycleMin:null, trocaMin:null,
    setupMin:0, observacao:'', startTime:'07:00', endTime:'16:45',
    produced:null, predicted:0, history:[], future:[]
  }));
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

    const $ = r => node.querySelector(r);

    $('[data-role="title"]').textContent = m.id;
    $('[data-role="subtitle"]').textContent =
      `Operador: ${m.operator||'-'} · Ciclo: ${m.cycleMin?formatMinutesToMMSS(m.cycleMin):'-'} · Peça: ${m.process||'-'}`;

    $('[data-role="operator"]').value = m.operator;
    $('[data-role="process"]').value = m.process;
    $('[data-role="cycle"]').value = m.cycleMin?formatMinutesToMMSS(m.cycleMin):'';
    $('[data-role="troca"]').value = m.trocaMin?formatMinutesToMMSS(m.trocaMin):'';
    $('[data-role="setup"]').value = m.setupMin||'';
    $('[data-role="startTime"]').value = m.startTime;
    $('[data-role="endTime"]').value = m.endTime;
    $('[data-role="produced"]').value = m.produced ?? '';
    $('[data-role="observacao"]').value = m.observacao;
    $('[data-role="predicted"]').textContent = m.predicted||0;

    container.appendChild(root);

    const ctx = root.querySelector('[data-role="chart"]').getContext('2d');
    const chart = new Chart(ctx,{
      type:'bar',
      data:{labels:['Previsto','Realizado'],
        datasets:[{data:[m.predicted||0,m.produced||0],
        backgroundColor:['#22c55e','#94a3b8']}]},
      options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}
    });

    function atualizarGrafico() {
      chart.data.datasets[0].data = [m.predicted||0, m.produced||0];
      chart.update();
    }

    // SALVAR
    $('[data-role="save"]').onclick = () => {
      m.operator = $('[data-role="operator"]').value;
      m.process = $('[data-role="process"]').value;
      m.cycleMin = parseTempoMinutos($('[data-role="cycle"]').value);
      m.trocaMin = parseTempoMinutos($('[data-role="troca"]').value);
      m.setupMin = parseTempoMinutos($('[data-role="setup"]').value);
      m.startTime = $('[data-role="startTime"]').value;
      m.endTime = $('[data-role="endTime"]').value;
      m.produced = Number($('[data-role="produced"]').value)||null;
      m.observacao = $('[data-role="observacao"]').value;

      m.predicted = calcularPrevisto(
        m.cycleMin,m.trocaMin,m.setupMin,m.startTime,m.endTime
      );

      REF.child(m.id).set(m);
      atualizarGrafico();
      notificar('Salvo', m.id);
    };
  });
}

// =============================
// FIREBASE LISTENER
// =============================
REF.on('value', snap => {
  const data = snap.val();
  state.machines = data
    ? MACHINE_NAMES.map(n => ({...initDefaultMachines()[0],...data[n],id:n}))
    : initDefaultMachines();
  render();
});

// =============================
// EXPORTAR CSV
// =============================
function exportCSV() {
  const lines = ['Maquina,Operador,Processo,Previsto,Realizado'];
  state.machines.forEach(m=>{
    lines.push(`${m.id},${m.operator},${m.process},${m.predicted||0},${m.produced||''}`);
  });
  const blob = new Blob([lines.join('\n')],{type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'usinagem.csv';
  a.click();
}

// =============================
// RESET
// =============================
function resetAll() {
  if (!confirm('Resetar tudo?')) return;
  state.machines.forEach(m=>REF.child(m.id).set(initDefaultMachines().find(x=>x.id===m.id)));
}

// =============================
// BOTÕES HEADER
// =============================
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('exportAll').onclick = exportCSV;
  document.getElementById('resetAll').onclick = resetAll;
});

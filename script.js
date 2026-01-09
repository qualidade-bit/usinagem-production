document.addEventListener('DOMContentLoaded', () => {

/* =============================
   CONFIGURAÇÕES ORIGINAIS
============================= */
const MACHINE_NAMES = [
 'Fresa CNC 1','Fresa CNC 2','Fresa CNC 3','Robodrill 2','D 800-1','Fagor',
 'Robodrill 1','VTC','D 800-2','D 800-3','Centur','Nardine','GL 280',
 '15S','E 280','G 240','Galaxy 10A','Galaxy 10B','GL 170G','GL 250','GL 350','GL 450'
];

/* =============================
   FIREBASE (ORIGINAL)
============================= */
firebase.initializeApp({
  apiKey: "AIzaSyBtJ5bhKoYsG4Ht57yxJ-69fvvbVCVPGjI",
  authDomain: "dashboardusinagem.firebaseapp.com",
  databaseURL: "https://dashboardusinagem-default-rtdb.firebaseio.com",
  projectId: "dashboardusinagem"
});

const db = firebase.database();
const REF = db.ref('usinagem_dashboard_v18_6');

/* =============================
   ESTADO
============================= */
let state = { machines: [] };

/* =============================
   INIT MÁQUINAS (APENAS +maintenance)
============================= */
function initDefaultMachines(){
  return MACHINE_NAMES.map(id => ({
    id,
    operator:'',
    process:'',
    cycleMin:0,
    produced:0,
    predicted:0,
    maintenance:false   // <<< ADIÇÃO
  }));
}

/* =============================
   RENDER (ORIGINAL + ADIÇÕES)
============================= */
function render(){
  const container = document.getElementById('machinesContainer');
  const tpl = document.getElementById('machine-template');
  container.innerHTML = '';

  state.machines.forEach(m => {
    const node = tpl.content.cloneNode(true);
    const root = node.querySelector('div');

    /* >>> MANUTENÇÃO VISUAL */
    if (m.maintenance) {
      root.classList.add('machine-maintenance');
    }

    root.querySelector('[data-role="title"]').textContent = m.id;
    root.querySelector('[data-role="subtitle"]').textContent =
      `Operador: ${m.operator || '-'}`;

    root.querySelector('[data-role="predicted"]').textContent =
      m.predicted || 0;

    const op = root.querySelector('[data-role="operator"]');
    const proc = root.querySelector('[data-role="process"]');
    const cyc = root.querySelector('[data-role="cycle"]');
    const prod = root.querySelector('[data-role="produced"]');

    op.value = m.operator;
    proc.value = m.process;
    cyc.value = m.cycleMin;
    prod.value = m.produced;

    /* SALVAR (ORIGINAL) */
    root.querySelector('[data-role="save"]').onclick = () => {
      const cycle = Number(cyc.value) || 0;
      const produced = Number(prod.value) || 0;
      const predicted = cycle > 0 ? Math.floor(480 / cycle) : 0;

      REF.child(m.id).update({
        operator: op.value,
        process: proc.value,
        cycleMin: cycle,
        produced,
        predicted
      });
    };

    /* >>> BOTÃO MANUTENÇÃO (ADIÇÃO) */
    root.querySelector('[data-role="maintenance"]').onclick = () => {
      REF.child(m.id).update({
        maintenance: !m.maintenance
      });
    };

    const perf = m.predicted > 0
      ? ((m.produced / m.predicted) * 100).toFixed(1)
      : 0;

    root.querySelector('[data-role="performance"]').textContent =
      `Desempenho: ${perf}%`;

    new Chart(root.querySelector('canvas'), {
      type:'bar',
      data:{
        labels:['Previsto','Realizado'],
        datasets:[{ data:[m.predicted || 0, m.produced || 0] }]
      },
      options:{
        plugins:{ legend:{display:false} },
        scales:{ y:{ beginAtZero:true } }
      }
    });

    container.appendChild(root);
  });
}

/* =============================
   FIREBASE LISTENER (ORIGINAL)
============================= */
REF.on('value', snap => {
  const data = snap.val();
  if (!data) {
    state.machines = initDefaultMachines();
    state.machines.forEach(m => REF.child(m.id).set(m));
  } else {
    state.machines = MACHINE_NAMES.map(id => ({
      ...initDefaultMachines().find(m => m.id === id),
      ...(data[id] || {})
    }));
  }
  render();
});

/* =============================
   RELATÓRIO DIÁRIO (ADIÇÃO)
============================= */
document.getElementById('dailyReport')?.addEventListener('click', () => {
  const today = new Date().toLocaleDateString('pt-BR');
  let csv = 'Data;Máquina;Operador;Peça;Produzido;Previsto;Eficiência\n';

  state.machines.forEach(m => {
    const ef = m.predicted
      ? ((m.produced / m.predicted) * 100).toFixed(1)
      : 0;

    csv += `${today};${m.id};${m.operator};${m.process};${m.produced};${m.predicted};${ef}%\n`;
  });

  const blob = new Blob([csv], { type:'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `relatorio_${today.replace(/\//g,'-')}.csv`;
  a.click();
});

});

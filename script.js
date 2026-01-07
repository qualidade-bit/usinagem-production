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
// UTILIDADES
// =============================
const prioridadePeso = { vermelho: 3, amarelo: 2, verde: 1 };

function parseTempoMinutos(v) {
  if (!v) return 0;
  if (v.includes(':')) {
    const [m, s = 0] = v.split(':').map(Number);
    return m + s / 60;
  }
  return Number(v.replace(',', '.')) || 0;
}

function calcularPrevisto(ciclo, troca, setup, ini, fim) {
  const toMin = t => {
    const [h,m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  let disp = toMin(fim) - toMin(ini) - (setup || 0);
  if (disp <= 0) return 0;
  return Math.floor(disp / (ciclo + (troca || 0)));
}

function eficiencia(real, previsto) {
  if (!previsto) return 0;
  return Math.round((real / previsto) * 100);
}

function corPorEficiencia(p) {
  if (p < 50) return 'red';
  if (p < 75) return 'yellow';
  return 'green';
}

// =============================
// SALVAMENTO SEGURO (🔥 CRÍTICO)
// =============================
function salvar(m) {
  const payload = {
    id: m.id,
    operator: m.operator || "",
    process: m.process || "",
    observacao: m.observacao || "",
    cycleMin: m.cycleMin || 0,
    trocaMin: m.trocaMin || 0,
    setupMin: m.setupMin || 0,
    startTime: m.startTime,
    endTime: m.endTime,
    produced: m.produced || 0,
    predicted: m.predicted || 0,
    history: m.history || [],
    future: m.future || []
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

    const q = r => root.querySelector(r);

    q('[data-role="title"]').textContent = m.id;
    q('[data-role="predicted"]').textContent = m.predicted;

    const producedInput = q('[data-role="produced"]');
    producedInput.value = m.produced || '';

    // =============================
    // GRÁFICO
    // =============================
    const canvas = q('[data-role="chart"]');
    const perfEl = q('[data-role="performance"]');

    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (m._chart) m._chart.destroy();

      const pct = eficiencia(m.produced, m.predicted);
      const cor = corPorEficiencia(pct);

      m._chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Previsto', 'Realizado'],
          datasets: [{
            data: [m.predicted, m.produced || 0],
            backgroundColor: [
              'rgba(0,200,0,.4)',
              cor === 'red' ? 'rgba(255,0,0,.6)' :
              cor === 'yellow' ? 'rgba(255,255,0,.6)' :
              'rgba(0,255,0,.6)'
            ]
          }]
        },
        options: {
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true } }
        }
      });

      perfEl.textContent = `Eficiência: ${pct}%`;
      perfEl.className =
        cor === 'red' ? 'text-red-500 text-center font-semibold' :
        cor === 'yellow' ? 'text-yellow-400 text-center font-semibold' :
        'text-green-400 text-center font-semibold';
    }

    // =============================
    // HISTÓRICO
    // =============================
    const historyBox = q('[data-role="history"]');
    historyBox.innerHTML = '';

    m.history.forEach(h => {
      const div = document.createElement('div');
      div.className = 'border-b border-gray-700 pb-1 mb-1';
      div.innerHTML = `
        <strong>${h.processo}</strong><br>
        Produzido: ${h.produzidas}<br>
        Eficiência: ${h.eficiencia}%<br>
        ${h.observacao || ''}
      `;
      historyBox.prepend(div);
    });

    // =============================
    // LISTA DE ESPERA
    // =============================
    const futureList = q('[data-role="futureList"]');
    futureList.innerHTML = '';

    m.future
      .sort((a,b)=>prioridadePeso[b.priority]-prioridadePeso[a.priority])
      .forEach((f,i)=>{
        const div = document.createElement('div');
        div.className = `flex justify-between items-center p-2 rounded text-sm
          ${f.priority==='vermelho'?'bg-red-700':
            f.priority==='amarelo'?'bg-yellow-600':'bg-green-700'}`;
        div.innerHTML = `
          <span>${i+1}º - ${f.item}</span>
          <button class="text-white font-bold">✖</button>
        `;
        div.querySelector('button').onclick = () => {
          m.future.splice(i,1);
          salvar(m); render();
        };
        futureList.appendChild(div);
      });

    new Sortable(futureList, {
      animation: 150,
      onEnd: () => {
        const novos = [];
        futureList.querySelectorAll('div').forEach(d => {
          const txt = d.innerText.replace(/^\d+º - /,'').replace('✖','').trim();
          const f = m.future.find(x=>x.item===txt);
          if (f) novos.push(f);
        });
        m.future = novos;
        salvar(m);
        render();
      }
    });

    container.appendChild(root);
  });
}

// =============================
// FIREBASE LISTENER
// =============================
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

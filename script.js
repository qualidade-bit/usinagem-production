// =============================
// CONFIGURAÇÕES INICIAIS
// =============================
const MACHINE_NAMES = [
  'Fresa CNC 1','Fresa CNC 2','Fresa CNC 3','Robodrill 2','D 800-1','Fagor',
  'Robodrill 1','VTC','D 800-2','D 800-3','Centur','Nardine','GL 280',
  '15S','E 280','G 240','Galaxy 10A','Galaxy 10B','GL 170G','GL 250','GL 350','GL 450'
];

// =============================
// ESTADO GLOBAL
// =============================
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
// FUNÇÕES AUXILIARES
// =============================
const parseTempoMinutos = v => {
  if (!v) return 0;
  if (v.includes(':')) {
    const [m,s] = v.split(':').map(Number);
    return m + (s/60);
  }
  return Number(v.replace(',','.')) || 0;
};

const formatMMSS = min => {
  const s = Math.round(min * 60);
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
};

function calcularPrevisto(ciclo, troca, setup, ini, fim){
  if(!ciclo) return 0;
  const toMin = t => {
    const [h,m] = t.split(':').map(Number);
    return h*60+m;
  };
  let disp = toMin(fim)-toMin(ini)-(setup||0);
  if(disp<=0) return 0;
  return Math.floor(disp/(ciclo+(troca||0)));
}

function maquinaPadrao(id){
  return {
    id, operator:'', process:'',
    cycleMin:0, trocaMin:0, setupMin:0,
    startTime:'07:00', endTime:'16:45',
    produced:0, predicted:0,
    history:[], future:[]
  };
}

function salvarMaquina(m){
  return REF.child(m.id).set(m);
}

// =============================
// RENDER
// =============================
function render(){
  const container = document.getElementById('machinesContainer');
  container.innerHTML = '';

  state.machines.forEach(m=>{
    const tpl = document.getElementById('machine-template');
    const root = tpl.content.cloneNode(true).firstElementChild;

    const q = r => root.querySelector(r);

    q('h2').textContent = `${m.id} — ${m.operator || '-'} | ${m.process || '-'}`;

    q('[data-role=operator]').value = m.operator;
    q('[data-role=process]').value = m.process;
    q('[data-role=cycle]').value = m.cycleMin?formatMMSS(m.cycleMin):'';
    q('[data-role=troca]').value = m.trocaMin?formatMMSS(m.trocaMin):'';
    q('[data-role=setup]').value = m.setupMin?formatMMSS(m.setupMin):'';
    q('[data-role=startTime]').value = m.startTime;
    q('[data-role=endTime]').value = m.endTime;
    q('[data-role=produced]').value = m.produced||'';
    q('[data-role=predicted]').textContent = m.predicted;

    // ===== HISTÓRICO =====
    const hist = q('[data-role=history]');
    hist.innerHTML='';
    m.history.slice().reverse().forEach(h=>{
      const d=document.createElement('div');
      d.textContent =
        `${h.timestamp.replace('T',' ').slice(0,19)} | `+
        `${h.operador} | ${h.processo} | ${h.produzidas}`;
      hist.appendChild(d);
    });

    // ===== LISTA DE ESPERA =====
    const futureList = q('[data-role=futureList]');
    futureList.innerHTML='';
    m.future.forEach((f,i)=>{
      const d=document.createElement('div');
      d.style.background =
        f.priority==='alta'?'#7f1d1d':
        f.priority==='media'?'#78350f':'#14532d';
      d.style.display='flex';
      d.style.justifyContent='space-between';
      d.textContent=f.item;

      const x=document.createElement('span');
      x.textContent='✖';
      x.onclick=()=>{
        m.future.splice(i,1);
        salvarMaquina(m);
        render();
      };
      d.appendChild(x);
      futureList.appendChild(d);
    });

    Sortable.create(futureList,{
      animation:150,
      onEnd:()=>{
        const nova=[];
        [...futureList.children].forEach(el=>{
          const txt=el.firstChild.textContent;
          const f=m.future.find(x=>x.item===txt);
          if(f) nova.push(f);
        });
        m.future=nova;
        salvarMaquina(m);
      }
    });

    // ===== BOTÕES =====
    q('[data-role=save]').onclick=()=>{
      m.operator=q('[data-role=operator]').value;
      m.process=q('[data-role=process]').value;
      m.cycleMin=parseTempoMinutos(q('[data-role=cycle]').value);
      m.trocaMin=parseTempoMinutos(q('[data-role=troca]').value);
      m.setupMin=parseTempoMinutos(q('[data-role=setup]').value);
      m.startTime=q('[data-role=startTime]').value;
      m.endTime=q('[data-role=endTime]').value;
      m.produced=Number(q('[data-role=produced]').value)||0;
      m.predicted=calcularPrevisto(
        m.cycleMin,m.trocaMin,m.setupMin,m.startTime,m.endTime
      );
      salvarMaquina(m);
      render();
    };

    q('[data-role=addHistory]').onclick=()=>{
      m.history.push({
        operador:m.operator,
        processo:m.process,
        produzidas:m.produced,
        timestamp:new Date().toISOString()
      });
      salvarMaquina(m);
      render();
    };

    q('[data-role=addFuture]').onclick=()=>{
      const v=q('[data-role=futureInput]').value.trim();
      const p=q('[data-role=prioritySelect]').value;
      if(!v) return;
      m.future.push({item:v,priority:p});
      salvarMaquina(m);
      render();
    };

    // ===== GRÁFICO =====
    const canvas=q('canvas');
    const ctx=canvas.getContext('2d');
    const ratio=m.predicted? (m.produced/m.predicted)*100:0;
    let cor='rgba(0,255,0,0.6)';
    if(ratio<50) cor='rgba(255,0,0,0.6)';
    else if(ratio<80) cor='rgba(255,255,0,0.6)';

    new Chart(ctx,{
      type:'bar',
      data:{
        labels:['Previsto','Realizado'],
        datasets:[{
          data:[m.predicted,m.produced],
          backgroundColor:['rgba(0,200,0,0.4)',cor]
        }]
      },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        plugins:{legend:{display:false}},
        scales:{y:{beginAtZero:true}}
      }
    });

    container.appendChild(root);
  });
}

// =============================
// FIREBASE LISTENER
// =============================
REF.on('value',snap=>{
  const data=snap.val()||{};
  state.machines = MACHINE_NAMES.map(id=>{
    return data[id]?{...maquinaPadrao(id),...data[id]}:maquinaPadrao(id);
  });
  render();
});

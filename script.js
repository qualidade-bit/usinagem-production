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
// FUNÇÕES DE TEMPO
// =============================
function parseMin(v){
  if(!v) return 0;
  if(v.includes(':')){
    const [m,s] = v.split(':').map(Number);
    return m + (s/60);
  }
  return Number(v.replace(',','.')) || 0;
}

function formatMMSS(min){
  if(!min) return '-';
  const s = Math.round(min*60);
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}

function minutosDisponiveis(i,f){
  const toM=t=>{const[a,b]=t.split(':').map(Number);return a*60+b};
  let d=toM(f)-toM(i);
  if(d<=0) return 0;
  if(toM(f)>720 && toM(i)<780) d-=Math.min(toM(f),780)-Math.max(toM(i),720);
  return d;
}

function previsto(c,t,s,i,f){
  const disp=minutosDisponiveis(i,f)-s;
  if(disp<=0||c<=0) return 0;
  return Math.floor(disp/(c+(t||0)));
}

function baseMachine(id){
  return {
    id, operator:'', process:'', cycle:0, troca:0, setup:0,
    start:'07:00', end:'16:45', produced:0, predicted:0,
    history:[], future:[]
  };
}

// =============================
// RENDER
// =============================
function render(){
  const cont=document.getElementById('machinesContainer');
  cont.innerHTML='';

  state.machines.forEach(m=>{
    const tpl=document.getElementById('machine-template').content.cloneNode(true);
    const root=tpl.firstElementChild;

    const q=s=>root.querySelector(s);

    const operator=q('[data-role=operator]');
    const process=q('[data-role=process]');
    const cycle=q('[data-role=cycle]');
    const troca=q('[data-role=troca]');
    const setup=q('[data-role=setup]');
    const start=q('[data-role=startTime]');
    const end=q('[data-role=endTime]');
    const prod=q('[data-role=produced]');
    const predictedEl=q('[data-role=predicted]');
    const perf=q('[data-role=performance]');
    const hist=q('[data-role=history]');
    const canvas=q('canvas');

    const save=q('[data-role=save]');
    const addHist=q('[data-role=addHistory]');
    const clearHist=q('[data-role=clearHistory]');

    const futInput=q('[data-role=futureInput]');
    const futPrio=q('[data-role=prioritySelect]');
    const futAdd=q('[data-role=addFuture]');
    const futList=q('[data-role=futureList]');

    operator.value=m.operator;
    process.value=m.process;
    cycle.value=m.cycle?formatMMSS(m.cycle):'';
    troca.value=m.troca?formatMMSS(m.troca):'';
    setup.value=m.setup?formatMMSS(m.setup):'';
    start.value=m.start;
    end.value=m.end;
    prod.value=m.produced||'';
    predictedEl.textContent=m.predicted;

    cont.appendChild(root);

    // ===== HISTÓRICO =====
    function renderHistory(){
      hist.innerHTML='';
      m.history.slice().reverse().forEach(h=>{
        const d=document.createElement('div');
        d.textContent=
          `${h.ts.slice(0,19).replace('T',' ')} | ${h.op} | ${h.proc} | ${h.qtd}`;
        hist.appendChild(d);
      });
    }
    renderHistory();

    // ===== LISTA DE ESPERA =====
    function renderFuture(){
      futList.innerHTML='';
      m.future.forEach((f,i)=>{
        const d=document.createElement('div');
        d.style.display='flex';
        d.style.justifyContent='space-between';
        d.style.padding='4px 6px';
        d.style.background=
          f.p==='vermelho'?'#7f1d1d':
          f.p==='amarelo'?'#78350f':'#14532d';
        d.textContent=f.t;

        const x=document.createElement('span');
        x.textContent='✖';
        x.style.cursor='pointer';
        x.onclick=()=>{
          m.future.splice(i,1);
          salvar(m);
        };
        d.appendChild(x);
        futList.appendChild(d);
      });

      Sortable.create(futList,{
        animation:150,
        onEnd:e=>{
          const arr=[];
          [...futList.children].forEach(el=>{
            const txt=el.firstChild.textContent;
            const f=m.future.find(x=>x.t===txt);
            if(f) arr.push(f);
          });
          m.future=arr;
          salvar(m);
        }
      });
    }
    renderFuture();

    // ===== GRÁFICO =====
    let chart;
    function draw(){
      if(chart) chart.destroy();
      const r=m.predicted?m.produced/m.predicted*100:0;
      let cor='rgba(0,255,0,.6)';
      if(r<50) cor='rgba(255,0,0,.6)';
      else if(r<80) cor='rgba(255,255,0,.6)';

      chart=new Chart(canvas,{
        type:'bar',
        data:{
          labels:['Previsto','Realizado'],
          datasets:[{
            data:[m.predicted,m.produced],
            backgroundColor:['rgba(0,200,0,.4)',cor]
          }]
        },
        options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}
      });

      perf.textContent=`Desempenho: ${r.toFixed(1)}%`;
    }
    draw();

    // ===== EVENTOS =====
    save.onclick=()=>{
      m.operator=operator.value;
      m.process=process.value;
      m.cycle=parseMin(cycle.value);
      m.troca=parseMin(troca.value);
      m.setup=parseMin(setup.value);
      m.start=start.value;
      m.end=end.value;
      m.produced=Number(prod.value)||0;
      m.predicted=previsto(m.cycle,m.troca,m.setup,m.start,m.end);
      salvar(m);
    };

    addHist.onclick=()=>{
      m.history.push({
        ts:new Date().toISOString(),
        op:m.operator,
        proc:m.process,
        qtd:m.produced
      });
      salvar(m);
    };

    clearHist.onclick=()=>{
      if(m.history.length){
        m.history=[];
        salvar(m);
      }
    };

    futAdd.onclick=()=>{
      if(!futInput.value) return;
      m.future.push({t:futInput.value,p:futPrio.value});
      futInput.value='';
      salvar(m);
    };
  });
}

// =============================
function salvar(m){
  REF.child(m.id).set(m);
}

// =============================
REF.on('value',snap=>{
  const d=snap.val()||{};
  state.machines=MACHINE_NAMES.map(id=>({...baseMachine(id),...(d[id]||{})}));
  render();
});

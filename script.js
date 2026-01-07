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
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const REF = db.ref('usinagem_dashboard_v18_6');

// =============================
// UTILIDADES
// =============================
const q = (r, p=document)=>p.querySelector(r);

function parseTempoMinutos(v){
  if(!v) return 0;
  if(v.includes(':')){
    const [m,s]=v.split(':').map(Number);
    return m + (s||0)/60;
  }
  return Number(v.replace(',','.'))||0;
}

function formatMMSS(min){
  if(!min) return '-';
  const s=Math.round(min*60);
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}

function minutosDisponiveis(i,f){
  const t=x=>{const[a,b]=x.split(':').map(Number);return a*60+b};
  let d=t(f)-t(i);
  if(d<=0) return 0;
  if(t(f)>720 && t(i)<780) d-=Math.min(t(f),780)-Math.max(t(i),720);
  return d;
}

function calcularPrevisto(c,t,s,i,f){
  const disp=minutosDisponiveis(i,f)-(s||0);
  if(disp<=0 || c<=0) return 0;
  return Math.floor(disp/(c+(t||0)));
}

function maquinaPadrao(id){
  return {
    id, operator:'', process:'',
    cycleMin:null, trocaMin:null, setupMin:0,
    startTime:'07:00', endTime:'16:45',
    produced:null, predicted:0,
    history:[], future:[]
  };
}

// =============================
// RENDER
// =============================
function render(){
  const container = document.getElementById('machinesContainer');
  if(!container) return;
  container.innerHTML='';

  state.machines.forEach(m=>{
    const tpl=document.getElementById('machine-template');
    if(!tpl) return;
    const node=tpl.content.cloneNode(true);
    const root=node.querySelector('div');
    container.appendChild(root);

    // ===== ELEMENTOS (SEGUROS) =====
    const title=q('[data-role=title]',root);
    const subtitle=q('[data-role=subtitle]',root);
    const op=q('[data-role=operator]',root);
    const proc=q('[data-role=process]',root);
    const cycle=q('[data-role=cycle]',root);
    const troca=q('[data-role=troca]',root);
    const setup=q('[data-role=setup]',root);
    const start=q('[data-role=startTime]',root);
    const end=q('[data-role=endTime]',root);
    const prod=q('[data-role=produced]',root);
    const save=q('[data-role=save]',root);
    const histBtn=q('[data-role=addHistory]',root);
    const histBox=q('[data-role=history]',root);
    const futInput=q('[data-role=futureInput]',root);
    const prioSel=q('[data-role=prioritySelect]',root);
    const futBtn=q('[data-role=addFuture]',root);
    const futList=q('[data-role=futureList]',root);
    const perf=q('[data-role=performance]',root);
    const canvas=q('[data-role=chart]',root);

    // ===== DADOS =====
    if(title) title.textContent=m.id;
    if(subtitle) subtitle.textContent=
      `Operador: ${m.operator||'-'} · Peça: ${m.process||'-'} · Ciclo: ${formatMMSS(m.cycleMin)}`;

    if(op) op.value=m.operator;
    if(proc) proc.value=m.process;
    if(cycle) cycle.value=m.cycleMin?formatMMSS(m.cycleMin):'';
    if(troca) troca.value=m.trocaMin?formatMMSS(m.trocaMin):'';
    if(setup) setup.value=m.setupMin?formatMMSS(m.setupMin):'';
    if(start) start.value=m.startTime;
    if(end) end.value=m.endTime;
    if(prod) prod.value=m.produced??'';

    // ===== GRÁFICO =====
    function atualizarGrafico(){
      if(!canvas) return;
      if(m._chart) m._chart.destroy();
      const ctx=canvas.getContext('2d');
      m._chart=new Chart(ctx,{
        type:'bar',
        data:{
          labels:['Previsto','Realizado'],
          datasets:[{
            data:[m.predicted,m.produced||0],
            backgroundColor:['rgba(0,200,0,.4)','rgba(255,255,255,.3)']
          }]
        },
        options:{
          plugins:{legend:{display:false}},
          scales:{y:{beginAtZero:true}}
        }
      });

      const r=m.predicted?((m.produced||0)/m.predicted)*100:0;
      let cor='text-gray-400';
      if(r<50) cor='text-red-500';
      else if(r<80) cor='text-yellow-400';
      else cor='text-green-400';
      if(perf){
        perf.className=`text-center text-sm font-bold ${cor}`;
        perf.textContent=`Desempenho: ${r.toFixed(1)}%`;
      }
    }

    atualizarGrafico();

    // ===== SALVAR =====
    if(save) save.onclick=()=>{
      m.operator=op.value.trim();
      m.process=proc.value.trim();
      m.cycleMin=parseTempoMinutos(cycle.value);
      m.trocaMin=parseTempoMinutos(troca.value);
      m.setupMin=parseTempoMinutos(setup.value);
      m.startTime=start.value;
      m.endTime=end.value;
      m.produced=prod.value===''?null:Number(prod.value);
      m.predicted=calcularPrevisto(m.cycleMin,m.trocaMin,m.setupMin,m.startTime,m.endTime);
      REF.child(m.id).set(m);
      atualizarGrafico();
      render();
    };

    // ===== HISTÓRICO =====
    if(histBox){
      histBox.innerHTML='';
      m.history.slice().reverse().forEach(h=>{
        const d=document.createElement('div');
        d.className='text-xs border-b border-gray-600 py-1';
        d.textContent=
          `${new Date(h.timestamp).toLocaleString()} — ${h.operador} · ${h.processo} · ${h.produzidas}`;
        histBox.appendChild(d);
      });
    }

    if(histBtn) histBtn.onclick=()=>{
      m.history.push({
        operador:m.operator,
        processo:m.process,
        produzidas:m.produced||0,
        timestamp:new Date().toISOString()
      });
      REF.child(m.id).set(m);
      render();
    };

    // ===== LISTA DE ESPERA =====
    function renderFuture(){
      if(!futList) return;
      futList.innerHTML='';
      m.future.forEach((f,i)=>{
        const d=document.createElement('div');
        d.draggable=true;
        d.className=`flex justify-between items-center p-1 text-xs rounded mb-1 ${
          f.priority==='vermelho'?'bg-red-600':
          f.priority==='amarelo'?'bg-yellow-500':'bg-green-600'
        }`;
        d.innerHTML=`<span>${f.item}</span><button>✖</button>`;
        d.querySelector('button').onclick=()=>{
          m.future.splice(i,1);
          REF.child(m.id).set(m);
          render();
        };
        futList.appendChild(d);
      });
    }
    renderFuture();

    if(futBtn) futBtn.onclick=()=>{
      if(!futInput.value) return;
      m.future.push({item:futInput.value,priority:prioSel.value});
      futInput.value='';
      REF.child(m.id).set(m);
      renderFuture();
    };
  });
}

// =============================
// FIREBASE LISTENER
// =============================
REF.on('value',snap=>{
  const d=snap.val();
  state.machines=MACHINE_NAMES.map(id=>{
    const r=d&&d[id];
    return r?{...maquinaPadrao(id),...r}:maquinaPadrao(id);
  });
  render();
});

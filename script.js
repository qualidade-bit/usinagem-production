// =============================
// ESTADO GLOBAL (NÃO REMOVER)
// =============================
window.state = window.state || { machines: [] };
const state = window.state;

// =============================
// CONFIGURAÇÕES
// =============================
const MACHINE_NAMES = [
 'Fresa CNC 1','Fresa CNC 2','Fresa CNC 3','Robodrill 2','D 800-1','Fagor',
 'Robodrill 1','VTC','D 800-2','D 800-3','Centur','Nardine','GL 280',
 '15S','E 280','G 240','Galaxy 10A','Galaxy 10B','GL 170G','GL 250','GL 350','GL 450'
];

// =============================
// FIREBASE
// =============================
if (!firebase.apps.length) {
  firebase.initializeApp({
    apiKey: "AIzaSyBtJ5bhKoYsG4Ht57yxJ-69fvvbVCVPGjI",
    authDomain: "dashboardusinagem.firebaseapp.com",
    projectId: "dashboardusinagem",
    storageBucket: "dashboardusinagem.appspot.com",
    messagingSenderId: "677023128312",
    appId: "1:677023128312:web:75376363a62105f360f90d"
  });
}

const db = firebase.database();
const REF = db.ref('usinagem_dashboard_v18_6');

// =============================
// FUNÇÕES ORIGINAIS (MANTIDAS)
// =============================
function parseTempoMinutos(str){
  if(!str) return 0;
  if(str.includes(':')){
    const [m,s]=str.split(':').map(Number);
    return m + (s/60);
  }
  return Number(str.replace(',','.')) || 0;
}

function formatMinutesToMMSS(min){
  if(!min) return '-';
  const sec=Math.round(min*60);
  return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;
}

function minutosDisponiveis(i,f){
  const t=x=>{const[a,b]=x.split(':').map(Number);return a*60+b;}
  let d=t(f)-t(i);
  if(d<=0) return 0;
  if(t(f)>720 && t(i)<780)
    d-=Math.min(t(f),780)-Math.max(t(i),720);
  return d;
}

function calcularPrevisto(ciclo,troca,setup,i,f){
  const disp=Math.max(minutosDisponiveis(i,f)-(setup||0),0);
  const total=ciclo+(troca||0);
  if(!disp||!total) return 0;
  return Math.floor(disp/total);
}

function maquinaPadrao(id){
  return {
    id,
    operator:'',
    process:'',
    cycleMin:null,
    trocaMin:null,
    setupMin:0,
    startTime:'07:00',
    endTime:'16:45',
    produced:null,
    predicted:0,
    history:[],
    future:[]
  };
}

function salvarMaquina(m){
  return REF.child(m.id).set({
    ...m,
    history:m.history||[],
    future:m.future||[]
  });
}

// =============================
// RENDER
// =============================
function render(){
  const container=document.getElementById('machinesContainer');
  container.innerHTML='';

  state.machines.forEach(m=>{
    const tpl=document.getElementById('machine-template');
    const node=tpl.content.cloneNode(true);
    const root=node.firstElementChild;
    const q=s=>root.querySelector(s);

    // inputs
    q('[data-role="operator"]').value=m.operator;
    q('[data-role="process"]').value=m.process;
    q('[data-role="cycle"]').value=m.cycleMin?formatMinutesToMMSS(m.cycleMin):'';
    q('[data-role="troca"]').value=m.trocaMin?formatMinutesToMMSS(m.trocaMin):'';
    q('[data-role="setup"]').value=m.setupMin?formatMinutesToMMSS(m.setupMin):'';
    q('[data-role="startTime"]').value=m.startTime;
    q('[data-role="endTime"]').value=m.endTime;
    q('[data-role="produced"]').value=m.produced??'';
    q('[data-role="predicted"]').textContent=m.predicted;

    // =============================
    // GRÁFICO (COMPARATIVO REAL)
    // =============================
    const canvas=q('[data-role="chart"]');
    let chart;

    function atualizarGrafico(){
      if(!canvas) return;
      const ctx=canvas.getContext('2d');
      if(chart) chart.destroy();

      chart=new Chart(ctx,{
        type:'bar',
        data:{
          labels:['Previsto','Realizado'],
          datasets:[{
            data:[m.predicted,m.produced||0],
            backgroundColor:[
              'rgba(0,200,0,.5)',
              'rgba(255,255,255,.4)'
            ]
          }]
        },
        options:{
          responsive:true,
          maintainAspectRatio:false,
          plugins:{legend:{display:false}},
          scales:{y:{beginAtZero:true}}
        }
      });
    }

    setTimeout(atualizarGrafico,50);

    // =============================
    // SALVAR
    // =============================
    q('[data-role="save"]').onclick=()=>{
      m.operator=q('[data-role="operator"]').value.trim();
      m.process=q('[data-role="process"]').value.trim();
      m.cycleMin=parseTempoMinutos(q('[data-role="cycle"]').value);
      m.trocaMin=parseTempoMinutos(q('[data-role="troca"]').value);
      m.setupMin=parseTempoMinutos(q('[data-role="setup"]').value);
      m.startTime=q('[data-role="startTime"]').value;
      m.endTime=q('[data-role="endTime"]').value;
      m.produced=Number(q('[data-role="produced"]').value)||0;

      m.predicted=calcularPrevisto(
        m.cycleMin,
        m.trocaMin,
        m.setupMin,
        m.startTime,
        m.endTime
      );

      salvarMaquina(m);
      q('[data-role="predicted"]').textContent=m.predicted;
      atualizarGrafico();
    };

    // =============================
    // HISTÓRICO (ABAIXO DO GRÁFICO)
    // =============================
    const histBox=q('[data-role="history"]');

    function renderHistory(){
      histBox.innerHTML='';
      m.history.slice().reverse().forEach(h=>{
        const d=document.createElement('div');
        d.textContent=`${h.timestamp.replace('T',' ').split('.')[0]} — ${h.operador} · ${h.processo} · ${h.produzidas}`;
        histBox.appendChild(d);
      });
    }

    renderHistory();

    q('[data-role="addHistory"]').onclick=()=>{
      m.history.push({
        operador:m.operator,
        processo:m.process,
        produzidas:m.produced,
        timestamp:new Date().toISOString()
      });
      salvarMaquina(m);
      renderHistory();
    };

    q('[data-role="clearHistory"]').onclick=()=>{
      if(!m.history.length) return;
      m.history=[];
      salvarMaquina(m);
      renderHistory();
    };

    // =============================
    // LISTA DE ESPERA (POR PRIORIDADE)
    // =============================
    const prioridade={vermelho:3,amarelo:2,verde:1};
    const futureList=q('[data-role="futureList"]');

    function renderFuture(){
      futureList.innerHTML='';
      m.future
        .slice()
        .sort((a,b)=>prioridade[b.priority]-prioridade[a.priority])
        .forEach(f=>{
          const d=document.createElement('div');
          d.textContent=f.item;
          futureList.appendChild(d);
        });
    }

    renderFuture();

    q('[data-role="addFuture"]').onclick=()=>{
      const v=q('[data-role="futureInput"]').value.trim();
      const p=q('[data-role="prioritySelect"]').value;
      if(!v) return;
      m.future.push({item:v,priority:p});
      salvarMaquina(m);
      q('[data-role="futureInput"]').value='';
      renderFuture();
    };

    container.appendChild(root);
  });
}

// =============================
// FIREBASE LISTENER
// =============================
REF.on('value',snap=>{
  const data=snap.val()||{};
  state.machines=MACHINE_NAMES.map(id=>
    data[id]?{...maquinaPadrao(id),...data[id]}:maquinaPadrao(id)
  );
  render();
});

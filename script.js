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
function parseMin(v){
  if(!v) return 0;
  if(String(v).includes(':')){
    const [m,s=0]=v.split(':').map(Number);
    return m+(s/60);
  }
  return Number(String(v).replace(',','.'))||0;
}

function formatMMSS(min){
  if(!min) return '-';
  const sec=Math.round(min*60);
  return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;
}

function minutosDisponiveis(i,f){
  const toM=t=>{const[a,b]=t.split(':').map(Number);return a*60+b};
  let d=toM(f)-toM(i);
  if(d<=0) return 0;
  if(toM(f)>720&&toM(i)<780) d-=Math.min(toM(f),780)-Math.max(toM(i),720);
  return Math.max(d,0);
}

function previsto(c,t,s,i,f){
  const disp=Math.max(minutosDisponiveis(i,f)-s,0);
  const total=c+t;
  return disp>0&&total>0?Math.floor(disp/total):0;
}

function maquinaBase(id){
  return {
    id,operator:'',process:'',cycle:0,troca:0,setup:0,
    start:'07:00',end:'16:45',produced:0,predicted:0,
    history:[],future:[]
  };
}

function salvar(m){ return REF.child(m.id).set(m); }

// =============================
// RENDER
// =============================
function render(){
  const cont=document.getElementById('machinesContainer');
  if(!cont) return;
  cont.innerHTML='';

  state.machines.forEach(m=>{
    const tpl=document.getElementById('machine-template');
    if(!tpl) return;
    const node=tpl.content.cloneNode(true);
    const card=node.firstElementChild;

    const $=r=>card.querySelector(r);

    const title=$('[data-role="title"]');
    if(title) title.textContent=m.id;

    const inputs={
      op:$('[data-role="operator"]'),
      pr:$('[data-role="process"]'),
      cy:$('[data-role="cycle"]'),
      tr:$('[data-role="troca"]'),
      se:$('[data-role="setup"]'),
      st:$('[data-role="startTime"]'),
      en:$('[data-role="endTime"]'),
      pd:$('[data-role="produced"]')
    };

    if(inputs.op) inputs.op.value=m.operator;
    if(inputs.pr) inputs.pr.value=m.process;
    if(inputs.cy) inputs.cy.value=formatMMSS(m.cycle);
    if(inputs.tr) inputs.tr.value=formatMMSS(m.troca);
    if(inputs.se) inputs.se.value=formatMMSS(m.setup);
    if(inputs.st) inputs.st.value=m.start;
    if(inputs.en) inputs.en.value=m.end;
    if(inputs.pd) inputs.pd.value=m.produced||'';

    const pred=$('[data-role="predicted"]');
    if(pred) pred.textContent=m.predicted;

    // ===== HISTÓRICO
    const hist=$('[data-role="history"]');
    if(hist){
      hist.innerHTML='';
      (m.history||[]).slice().reverse().forEach(h=>{
        const d=document.createElement('div');
        d.textContent=`${h.time} — ${h.operator} · ${h.process} · ${h.qty}`;
        hist.appendChild(d);
      });
    }

    // ===== BOTÕES
    const saveBtn=$('[data-role="save"]');
    if(saveBtn){
      saveBtn.onclick=()=>{
        m.operator=inputs.op?.value||'';
        m.process=inputs.pr?.value||'';
        m.cycle=parseMin(inputs.cy?.value);
        m.troca=parseMin(inputs.tr?.value);
        m.setup=parseMin(inputs.se?.value);
        m.start=inputs.st?.value||'07:00';
        m.end=inputs.en?.value||'16:45';
        m.produced=Number(inputs.pd?.value)||0;
        m.predicted=previsto(m.cycle,m.troca,m.setup,m.start,m.end);
        salvar(m);
        if(pred) pred.textContent=m.predicted;
        drawChart();
      };
    }

    const addHist=$('[data-role="addHistory"]');
    if(addHist){
      addHist.onclick=()=>{
        if(!m.history) m.history=[];
        m.history.push({
          time:new Date().toLocaleTimeString(),
          operator:m.operator,
          process:m.process,
          qty:m.produced
        });
        salvar(m);
      };
    }

    const clearHist=$('[data-role="clearHistory"]');
    if(clearHist){
      clearHist.onclick=()=>{
        if(m.history?.length){
          m.history=[];
          salvar(m);
        }
      };
    }

    // ===== GRÁFICO
    const canvas=$('[data-role="chart"]');
    let chart;
    function drawChart(){
      if(!canvas) return;
      const ctx=canvas.getContext('2d');
      if(chart) chart.destroy();
      chart=new Chart(ctx,{
        type:'bar',
        data:{
          labels:['Previsto','Realizado'],
          datasets:[{
            data:[m.predicted,m.produced],
            backgroundColor:[
              'rgba(0,255,0,.4)',
              m.produced<m.predicted*0.5?'rgba(255,0,0,.6)':
              m.produced<m.predicted*0.8?'rgba(255,255,0,.6)':
              'rgba(0,255,0,.6)'
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

    setTimeout(drawChart,50);
    cont.appendChild(card);
  });
}

// =============================
// FIREBASE LISTENER
// =============================
REF.on('value',snap=>{
  const d=snap.val()||{};
  state.machines=MACHINE_NAMES.map(id=>{
    const r=d[id];
    return r?{...maquinaBase(id),...r}:maquinaBase(id);
  });
  render();
});

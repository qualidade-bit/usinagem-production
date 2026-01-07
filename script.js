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
// FUNÇÕES AUXILIARES
// =============================
function parseMin(v){
  if(!v) return 0;
  if(String(v).includes(':')){
    const p=v.split(':').map(Number);
    return p[0] + (p[1]||0)/60;
  }
  return Number(String(v).replace(',','.'))||0;
}

function formatMMSS(m){
  if(!m) return '-';
  const s=Math.round(m*60);
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}

function minutosDisponiveis(i,f){
  const t=x=>{const[a,b]=x.split(':').map(Number);return a*60+b};
  let d=t(f)-t(i);
  if(d<=0) return 0;
  if(t(f)>720&&t(i)<780) d-=Math.min(t(f),780)-Math.max(t(i),720);
  return Math.max(d,0);
}

function calcularPrevisto(c,t,s,i,f){
  const disp=Math.max(minutosDisponiveis(i,f)-s,0);
  return disp>0&&(c+t)>0?Math.floor(disp/(c+t)):0;
}

function baseMachine(id){
  return {
    id,operator:'',process:'',cycle:0,troca:0,setup:0,
    start:'07:00',end:'16:45',produced:0,predicted:0,
    observation:'',history:[],future:[]
  };
}

function salvar(m){
  REF.child(m.id).set(m);
}

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

    const card=tpl.content.cloneNode(true).firstElementChild;
    const $=q=>card.querySelector(q);

    const title=$('[data-role="title"]');
    if(title) title.textContent=m.id;

    const operator=$('[data-role="operator"]');
    const process=$('[data-role="process"]');
    const cycle=$('[data-role="cycle"]');
    const troca=$('[data-role="troca"]');
    const setup=$('[data-role="setup"]');
    const start=$('[data-role="startTime"]');
    const end=$('[data-role="endTime"]');
    const produced=$('[data-role="produced"]');
    const obs=$('[data-role="observation"]');

    if(operator) operator.value=m.operator;
    if(process) process.value=m.process;
    if(cycle) cycle.value=formatMMSS(m.cycle);
    if(troca) troca.value=formatMMSS(m.troca);
    if(setup) setup.value=formatMMSS(m.setup);
    if(start) start.value=m.start;
    if(end) end.value=m.end;
    if(produced) produced.value=m.produced||'';
    if(obs) obs.value=m.observation||'';

    const predictedEl=$('[data-role="predicted"]');
    if(predictedEl) predictedEl.textContent=m.predicted;

    // ===== HISTÓRICO
    const hist=$('[data-role="history"]');
    if(hist){
      hist.innerHTML='';
      m.history.slice().reverse().forEach(h=>{
        const d=document.createElement('div');
        d.textContent=
          `Eficiência: ${h.eff}% | Qtd: ${h.qty} | Processo: ${h.process}`+
          (h.obs?` | Obs: ${h.obs}`:'');
        hist.appendChild(d);
      });
    }

    // ===== BOTÕES
    const saveBtn=$('[data-role="save"]');
    if(saveBtn){
      saveBtn.onclick=()=>{
        m.operator=operator?operator.value:'';
        m.process=process?process.value:'';
        m.cycle=parseMin(cycle?cycle.value:0);
        m.troca=parseMin(troca?troca.value:0);
        m.setup=parseMin(setup?setup.value:0);
        m.start=start?start.value:'07:00';
        m.end=end?end.value:'16:45';
        m.produced=produced?Number(produced.value)||0:0;
        m.observation=obs?obs.value:'';
        m.predicted=calcularPrevisto(m.cycle,m.troca,m.setup,m.start,m.end);
        salvar(m);
        if(predictedEl) predictedEl.textContent=m.predicted;
        drawChart();
      };
    }

    const addHist=$('[data-role="addHistory"]');
    if(addHist){
      addHist.onclick=()=>{
        const eff=m.predicted>0?((m.produced/m.predicted)*100).toFixed(1):0;
        m.history.push({
          qty:m.produced,
          process:m.process,
          eff,
          obs:m.observation||''
        });
        salvar(m);
      };
    }

    const clearHist=$('[data-role="clearHistory"]');
    if(clearHist){
      clearHist.onclick=()=>{
        if(m.history.length){
          m.history=[];
          salvar(m);
        }
      };
    }

    // ===== LISTA DE ESPERA
    const fInput=$('[data-role="futureInput"]');
    const fPrio=$('[data-role="prioritySelect"]');
    const fBtn=$('[data-role="addFuture"]');
    const fList=$('[data-role="futureList"]');

    function renderFuture(){
      if(!fList) return;
      fList.innerHTML='';
      m.future.sort((a,b)=>b.p-a.p).forEach((f,i)=>{
        const li=document.createElement('div');
        li.style.background=f.p===3?'#7f1d1d':f.p===2?'#78350f':'#14532d';
        li.style.color='#fff';
        li.style.padding='4px';
        li.style.display='flex';
        li.style.justifyContent='space-between';
        li.textContent=f.t;

        const x=document.createElement('span');
        x.textContent='✕';
        x.style.cursor='pointer';
        x.onclick=()=>{m.future.splice(i,1);salvar(m);};

        li.appendChild(x);
        fList.appendChild(li);
      });
    }

    if(fBtn){
      fBtn.onclick=()=>{
        if(!fInput||!fInput.value) return;
        m.future.push({
          t:fInput.value,
          p:{vermelho:3,amarelo:2,verde:1}[fPrio.value]||1
        });
        fInput.value='';
        salvar(m);
      };
    }

    // ===== GRÁFICO
    const canvas=$('[data-role="chart"]');
    let chart;
    function drawChart(){
      if(!canvas) return;
      if(chart) chart.destroy();
      chart=new Chart(canvas,{
        type:'bar',
        data:{
          labels:['Previsto','Realizado'],
          datasets:[{
            data:[m.predicted,m.produced],
            backgroundColor:[
              'rgba(0,255,0,.4)',
              m.produced<m.predicted*0.5?'rgba(255,0,0,.6)'
              :m.produced<m.predicted*0.8?'rgba(255,255,0,.6)'
              :'rgba(0,255,0,.6)'
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
    renderFuture();
  });
}

// =============================
// FIREBASE LISTENER
// =============================
REF.on('value',snap=>{
  const d=snap.val()||{};
  state.machines=MACHINE_NAMES.map(id=>{
    return d[id]?{...baseMachine(id),...d[id]}:baseMachine(id);
  });
  render();
});

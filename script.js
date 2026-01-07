// =============================
// ESCOPO GLOBAL SEGURO
// =============================
if (!window.state) window.state = { machines: [] };
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
// MODELOS
// =============================
function maquinaPadrao(id){
  return {
    id,
    operator:'',
    process:'',
    produced:0,
    predicted:0,
    history:[],
    future:[]
  };
}

function salvarMaquina(m){
  const payload = {
    id:m.id,
    operator:m.operator,
    process:m.process,
    produced:m.produced,
    predicted:m.predicted,
    history:m.history || [],
    future:m.future || []
  };
  return REF.child(m.id).set(payload);
}

// =============================
// RENDER
// =============================
function render(){
  const container=document.getElementById('machinesContainer');
  if(!container) return;
  container.innerHTML='';

  state.machines.forEach(m=>{
    const tpl=document.getElementById('machine-template');
    const root=tpl.content.cloneNode(true).firstElementChild;
    const q=s=>root.querySelector(s);

    q('[data-role="title"]').textContent=m.id;
    q('[data-role="operator"]').value=m.operator;
    q('[data-role="process"]').value=m.process;
    q('[data-role="produced"]').value=m.produced;
    q('[data-role="predicted"]').textContent=m.predicted;

    // =============================
    // GRÁFICO
    // =============================
    const canvas=q('[data-role="chart"]');
    let chart=null;

    function renderChart(){
      if(!canvas) return;
      const ctx=canvas.getContext('2d');
      if(chart) chart.destroy();

      chart=new Chart(ctx,{
        type:'bar',
        data:{
          labels:['Previsto','Realizado'],
          datasets:[{
            data:[m.predicted, m.produced],
            backgroundColor:[
              'rgba(0,200,0,0.5)',
              'rgba(255,255,255,0.5)'
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

    setTimeout(renderChart,50);

    // =============================
    // SALVAR
    // =============================
    q('[data-role="save"]').onclick=()=>{
      m.operator=q('[data-role="operator"]').value.trim();
      m.process=q('[data-role="process"]').value.trim();
      m.produced=Number(q('[data-role="produced"]').value)||0;

      // cálculo simples mantido
      if(m.predicted===0) m.predicted=m.produced;

      salvarMaquina(m);
      q('[data-role="predicted"]').textContent=m.predicted;
      renderChart();
    };

    // =============================
    // HISTÓRICO
    // =============================
    const historyBox=q('[data-role="history"]');
    const clearBtn=q('[data-role="clearHistory"]');

    function renderHistory(){
      historyBox.innerHTML='';
      m.history.slice().reverse().forEach(h=>{
        const d=document.createElement('div');
        d.textContent=`${h.timestamp.replace('T',' ').split('.')[0]} — ${h.operador} · ${h.processo} · ${h.produzidas} peças`;
        historyBox.appendChild(d);
      });
      clearBtn.style.display=m.history.length?'inline-block':'none';
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

    clearBtn.onclick=()=>{
      if(!m.history.length) return;
      m.history=[];
      salvarMaquina(m);
      renderHistory();
    };

    // =============================
    // LISTA DE ESPERA
    // =============================
    const futureList=q('[data-role="futureList"]');
    const prioridade={vermelho:3,amarelo:2,verde:1};

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
      const val=q('[data-role="futureInput"]').value.trim();
      const prio=q('[data-role="prioritySelect"]').value;
      if(!val) return;
      m.future.push({item:val,priority:prio});
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


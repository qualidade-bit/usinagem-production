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
  databaseURL: "https://dashboardusinagem-default-rtdb.firebaseio.com",
  projectId: "dashboardusinagem",
  storageBucket: "dashboardusinagem.appspot.com",
  messagingSenderId: "677023128312",
  appId: "1:677023128312:web:75376363a62105f360f90d"
});

const db = firebase.database();
const REF = db.ref("usinagem_dashboard_v18_6");

// =============================
// FUNÇÕES
// =============================
const prioridadePeso = { vermelho: 3, amarelo: 2, verde: 1 };

function parseMin(v){
  if(!v) return 0;
  if(v.includes(":")){
    const [m,s=0] = v.split(":").map(Number);
    return m + s/60;
  }
  return Number(v.replace(",", ".")) || 0;
}

function calcularPrevisto(ciclo, troca, setup, ini, fim){
  const toMin = t => {
    const [h,m]=t.split(":").map(Number);
    return h*60+m;
  };
  let disp = toMin(fim)-toMin(ini) - (setup||0);
  if(disp<=0) return 0;
  return Math.floor(disp/(ciclo+(troca||0)));
}

function corPorEficiencia(p){
  if(p < 50) return "red";
  if(p < 75) return "yellow";
  return "green";
}

function maquinaPadrao(id){
  return {
    id, operator:"", process:"", observacao:"",
    cycleMin:0, trocaMin:0, setupMin:0,
    startTime:"07:00", endTime:"16:45",
    produced:0, predicted:0,
    history:[], future:[]
  };
}

function salvar(m){ return REF.child(m.id).set(m); }

// =============================
// RENDER
// =============================
function render(){
  const container = document.getElementById("machinesContainer");
  container.innerHTML="";

  state.machines.forEach(m=>{
    const tpl = document.getElementById("machine-template");
    const root = tpl.content.cloneNode(true).children[0];

    const q = r=>root.querySelector(r);

    q('[data-role="title"]').textContent = m.id;
    q('[data-role="subtitle"]').textContent =
      `Operador: ${m.operator||"-"} · Ciclo: ${m.cycleMin||"-"} · Peça: ${m.process||"-"}`;

    q('[data-role="operator"]').value = m.operator;
    q('[data-role="process"]').value = m.process;
    q('[data-role="cycle"]').value = m.cycleMin||"";
    q('[data-role="troca"]').value = m.trocaMin||"";
    q('[data-role="setup"]').value = m.setupMin||"";
    q('[data-role="startTime"]').value = m.startTime;
    q('[data-role="endTime"]').value = m.endTime;
    q('[data-role="produced"]').value = m.produced||"";
    q('[data-role="observacao"]').value = m.observacao||"";
    q('[data-role="predicted"]').textContent = m.predicted||0;

    // ================= HISTÓRICO =================
    const hist = q('[data-role="history"]');
    hist.innerHTML="";
    m.history.forEach(h=>{
      const d=document.createElement("div");
      d.className="border-b border-gray-700 pb-1 mb-1";
      d.innerHTML=`
        <div class="font-semibold">${h.processo}</div>
        <div>Produzidas: ${h.produzidas}</div>
        <div class="text-${corPorEficiencia(h.eficiencia)}-400">
          Eficiência: ${h.eficiencia.toFixed(1)}%
        </div>
        ${h.observacao?`<div>Obs: ${h.observacao}</div>`:""}
      `;
      hist.prepend(d);
    });

    // ================= LISTA DE ESPERA =================
    const futureList = q('[data-role="futureList"]');
    futureList.innerHTML="";

    m.future.forEach((f,i)=>{
      const div=document.createElement("div");
      div.className=`flex items-center justify-between p-2 rounded bg-${f.priority}-600`;
      div.innerHTML=`
        <span>${i+1}° - ${f.item}</span>
        <div class="flex gap-2">
          <select class="bg-gray-800 text-sm">
            <option value="vermelho">Urgente</option>
            <option value="amarelo">Alta</option>
            <option value="verde">Normal</option>
          </select>
          <button class="text-white">❌</button>
        </div>
      `;
      const sel = div.querySelector("select");
      sel.value = f.priority;
      sel.onchange=()=>{
        f.priority=sel.value;
        salvar(m);
        render();
      };
      div.querySelector("button").onclick=()=>{
        m.future.splice(i,1);
        salvar(m);
        render();
      };
      futureList.appendChild(div);
    });

    Sortable.create(futureList,{
      animation:150,
      onEnd:e=>{
        const it = m.future.splice(e.oldIndex,1)[0];
        m.future.splice(e.newIndex,0,it);
        salvar(m);
        render();
      }
    });

    q('[data-role="sortFuture"]').onclick=()=>{
      m.future.sort((a,b)=>prioridadePeso[b.priority]-prioridadePeso[a.priority]);
      salvar(m);
      render();
    };

    q('[data-role="addFuture"]').onclick=()=>{
      const val=q('[data-role="futureInput"]').value.trim();
      const pr=q('[data-role="prioritySelect"]').value;
      if(!val) return;
      m.future.push({item:val,priority:pr});
      salvar(m);
      render();
    };

    // ================= BOTÕES =================
    q('[data-role="save"]').onclick=()=>{
      m.operator=q('[data-role="operator"]').value;
      m.process=q('[data-role="process"]').value;
      m.observacao=q('[data-role="observacao"]').value;
      m.cycleMin=parseMin(q('[data-role="cycle"]').value);
      m.trocaMin=parseMin(q('[data-role="troca"]').value);
      m.setupMin=parseMin(q('[data-role="setup"]').value);
      m.startTime=q('[data-role="startTime"]').value;
      m.endTime=q('[data-role="endTime"]').value;
      m.produced=Number(q('[data-role="produced"]').value)||0;
      m.predicted=calcularPrevisto(
        m.cycleMin,m.trocaMin,m.setupMin,m.startTime,m.endTime
      );
      salvar(m);
      render();
    };

    q('[data-role="addHistory"]').onclick=()=>{
      if(!m.predicted) return;
      const ef=(m.produced/m.predicted)*100;
      m.history.push({
        processo:m.process,
        produzidas:m.produced,
        eficiencia:ef,
        observacao:m.observacao||""
      });
      salvar(m);
      render();
    };

    // ================= GRÁFICO =================
    setTimeout(()=>{
      const canvas=q('[data-role="chart"]');
      if(!canvas) return;
      const ctx=canvas.getContext("2d");
      if(m._chart) m._chart.destroy();

      const ef = m.predicted? (m.produced/m.predicted)*100 : 0;
      const cor = ef<50?"red":ef<75?"yellow":"green";

      m._chart=new Chart(ctx,{
        type:"bar",
        data:{
          labels:["Previsto","Realizado"],
          datasets:[{
            data:[m.predicted,m.produced],
            backgroundColor:["gray",cor]
          }]
        },
        options:{plugins:{legend:{display:false}}}
      });

      q('[data-role="performance"]').innerHTML =
        `<span class="text-${cor}-400">Eficiência: ${ef.toFixed(1)}%</span>`;
    },0);

    container.appendChild(root);
  });
}

// =============================
// FIREBASE LISTENER
// =============================
REF.on("value",snap=>{
  const d=snap.val()||{};
  state.machines = MACHINE_NAMES.map(id=>({...maquinaPadrao(id),...(d[id]||{})}));
  render();
});

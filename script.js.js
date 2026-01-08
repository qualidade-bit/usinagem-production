document.addEventListener('DOMContentLoaded', () => {

// =============================
// CONFIGURAÇÕES INICIAIS
// =============================
const MACHINE_NAMES = [
 'Fresa CNC 1','Fresa CNC 2','Fresa CNC 3','Robodrill 2','D 800-1','Fagor',
 'Robodrill 1','VTC','D 800-2','D 800-3','Centur','Nardine','GL 280',
 '15S','E 280','G 240','Galaxy 10A','Galaxy 10B','GL 170G','GL 250','GL 350','GL 450'
];

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
function parseTempoMinutos(str) {
 if (!str) return 0;
 const s = String(str).trim();
 if (s.includes(':')) {
   const p = s.split(':').map(Number);
   if (p.length === 3) return p[0]*60 + p[1] + p[2]/60;
   if (p.length === 2) return p[0] + p[1]/60;
 }
 const v = Number(s.replace(',', '.'));
 return isNaN(v) ? 0 : v;
}

function formatMinutesToMMSS(min) {
 if (!min && min !== 0) return '-';
 const s = Math.round(min * 60);
 return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}

function minutosDisponiveis(i,f){
 if(!i||!f) return 0;
 const t=x=>{const p=x.split(':').map(Number);return p[0]*60+p[1]};
 let d=t(f)-t(i);
 if(d<0) return 0;
 if(t(f)>720 && t(i)<780) d-=60;
 return Math.max(d,0);
}

function calcularPrevisto(c,t,s,i,f){
 const disp=minutosDisponiveis(i,f)-(s||0);
 if(!c||disp<=0) return 0;
 return Math.floor(disp/(c+(t||0)));
}

let state={machines:[]};

function initDefaultMachines(){
 return MACHINE_NAMES.map(id=>({
  id,operator:'',process:'',cycleMin:null,setupMin:0,trocaMin:null,
  observacao:'',startTime:'07:00',endTime:'16:45',
  produced:null,predicted:0,history:[],future:[]
 }));
}

// =============================
// RENDER
// =============================
function render(){
 const container=document.getElementById('machinesContainer');
 const tpl=document.getElementById('machine-template');
 if(!container||!tpl) return;

 container.innerHTML='';

 state.machines.forEach(m=>{
  const node=tpl.content.cloneNode(true);
  const root=node.querySelector('div');
  if(!root) return;

  const q=r=>node.querySelector(r);

  const title=q('[data-role="title"]');
  const subtitle=q('[data-role="subtitle"]');
  const predictedEl=q('[data-role="predicted"]');
  const historyEl=q('[data-role="history"]');
  const performanceEl=q('[data-role="performance"]');

  if(title) title.textContent=m.id;
  if(subtitle) subtitle.textContent=
   `Operador: ${m.operator||'-'} · Ciclo: ${m.cycleMin!=null?formatMinutesToMMSS(m.cycleMin):'-'} · Peça: ${m.process||'-'}`;
  if(predictedEl) predictedEl.textContent=m.predicted||0;

  container.appendChild(root);

  const canvas=root.querySelector('[data-role="chart"]');
  if(!canvas) return;
  const ctx=canvas.getContext('2d');
  if(!ctx) return;

  const chart=new Chart(ctx,{
   type:'bar',
   data:{labels:['Previsto','Realizado'],
    datasets:[{data:[m.predicted||0,m.produced||0]}]},
   options:{scales:{y:{beginAtZero:true}},plugins:{legend:{display:false}}}
  });

  if(historyEl){
   historyEl.innerHTML=m.history.length
    ? m.history.map(h=>`<div>${new Date(h.ts).toLocaleString()}</div>`).join('')
    : '<div class="text-gray-400">Histórico vazio</div>';
  }

  if(performanceEl){
   const r=m.predicted>0?(m.produced/m.predicted*100):0;
   performanceEl.textContent=`Desempenho: ${r.toFixed(1)}%`;
  }
 });
}

// =============================
// FIREBASE LISTENER
// =============================
REF.on('value',snap=>{
 const data=snap.val();
 if(!data){
  state.machines=initDefaultMachines();
  state.machines.forEach(m=>REF.child(m.id).set(m));
 }else{
  state.machines=MACHINE_NAMES.map(id=>({
   id,
   ...(data[id]||{}),
   history:Array.isArray(data[id]?.history)?data[id].history:[],
   future:Array.isArray(data[id]?.future)?data[id].future:[]
  }));
 }
 render();
});

// =============================
// EXPORT / RESET (com proteção)
// =============================
const exportBtn=document.getElementById('exportAll');
if(exportBtn) exportBtn.onclick=()=>alert('Export OK');

const resetBtn=document.getElementById('resetAll');
if(resetBtn) resetBtn.onclick=()=>alert('Reset OK');

});

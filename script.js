// =============================
// FIREBASE INIT
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
// CONFIG
// =============================
const MACHINE_NAMES = [
  "Fresa CNC 1","Fresa CNC 2","Fresa CNC 3",
  "Robodrill 1","Robodrill 2","Torno CNC 1",
  "Torno CNC 2","Centro Usinagem 1"
];

// =============================
// STATE
// =============================
let machines = {};

// =============================
// UTILS
// =============================
function parseMinutes(v) {
  if (!v) return 0;
  if (v.includes(":")) {
    const p = v.split(":").map(Number);
    return p.length === 3 ? p[0]*60 + p[1] + p[2]/60 : 0;
  }
  return parseFloat(v) || 0;
}

// =============================
// RENDER
// =============================
function render() {
  const container = document.getElementById("machinesContainer");
  if (!container) return;
  container.innerHTML = "";

  MACHINE_NAMES.forEach(name => {
    const data = machines[name] || { history: [], future: [] };
    const tpl = document.getElementById("machine-template");
    const card = tpl.content.cloneNode(true);

    const root = card.firstElementChild;

    const $ = r => root.querySelector(`[data-role="${r}"]`);

    $("title").textContent = name;
    $("predicted").textContent = data.predicted || 0;

    $("history").innerHTML = (data.history || []).map(h => `<div>${h}</div>`).join("");

    // ===== BOTÕES =====
    $("save").onclick = () => {
      const cycle = parseMinutes($("cycle").value);
      const troca = parseMinutes($("troca").value);
      const setup = parseMinutes($("setup").value);
      const produced = parseInt($("produced").value || 0);

      const available = Math.max(0, 480 - setup - troca);
      const predicted = cycle > 0 ? Math.floor(available / cycle) : 0;
      const efficiency = predicted ? Math.round((produced / predicted) * 100) : 0;

      machines[name] = {
        ...data,
        predicted,
        efficiency
      };

      REF.child(name).set(machines[name]);
    };

    $("addHistory").onclick = () => {
      const now = new Date().toLocaleString("pt-BR");
      const text =
        `${now} | Operador: ${$("operator").value} | Peça: ${$("process").value} | ` +
        `Previsto: ${data.predicted || 0} | Realizado: ${$("produced").value} | ` +
        `Eficiência: ${data.efficiency || 0}% | Obs.: ${$("observacao").value}`;

      data.history = data.history || [];
      data.history.push(text);

      REF.child(name).child("history").set(data.history);
    };

    $("clearHistory").onclick = () => {
      if (!confirm("Limpar histórico?")) return;
      data.history = [];
      REF.child(name).child("history").set([]);
    };

    // ===== FUTURO =====
    $("addFuture").onclick = () => {
      const txt = $("futureInput").value.trim();
      if (!txt) return;

      data.future = data.future || [];
      data.future.push({
        text: txt,
        priority: $("prioritySelect").value
      });

      $("futureInput").value = "";
      REF.child(name).child("future").set(data.future);
    };

    $("sortFuture").onclick = () => {
      const order = { vermelho: 0, amarelo: 1, verde: 2 };
      data.future.sort((a, b) => order[a.priority] - order[b.priority]);
      REF.child(name).child("future").set(data.future);
    };

    const futureList = $("futureList");
    futureList.innerHTML = "";
    (data.future || []).forEach(f => {
      const div = document.createElement("div");
      div.textContent = f.text;
      div.className = "px-2 py-1 rounded bg-gray-700 text-sm";
      futureList.appendChild(div);
    });

    container.appendChild(card);
  });
}

// =============================
// FIREBASE LISTENER
// =============================
REF.on("value", snap => {
  machines = snap.val() || {};
  render();
});

// =============================
// HEADER BUTTONS (SAFE)
// =============================
document.addEventListener("DOMContentLoaded", () => {
  const exportBtn = document.getElementById("exportAll");
  const resetBtn = document.getElementById("resetAll");

  if (exportBtn) {
    exportBtn.onclick = () => {
      let csv = "Máquina,Histórico\n";
      Object.entries(machines).forEach(([k, v]) => {
        (v.history || []).forEach(h => csv += `"${k}","${h}"\n`);
      });

      const blob = new Blob([csv], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "historico_usinagem.csv";
      a.click();
    };
  }

  if (resetBtn) {
    resetBtn.onclick = () => {
      if (confirm("Resetar tudo?")) REF.remove();
    };
  }
});

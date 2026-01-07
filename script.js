// =============================
// FIREBASE
// =============================
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_DOMINIO",
  databaseURL: "SUA_DATABASE_URL",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_BUCKET",
  messagingSenderId: "SEU_SENDER",
  appId: "SEU_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// =============================
// UTIL
// =============================
const $ = (id) => document.getElementById(id);

// =============================
// ESTADO GLOBAL (CORRIGE ERRO `state is not defined`)
// =============================
const state = {
  historico: [],
  espera: []
};

// =============================
// GRÁFICO
// =============================
let chart = null;

function renderChart(real = 0, previsto = 0) {
  const canvas = $("comparativoChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Real", "Previsto"],
      datasets: [{
        data: [real, previsto],
        backgroundColor: [
          "rgba(59,130,246,0.8)",   // azul (real)
          "rgba(16,185,129,0.8)"    // verde (previsto)
        ]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// =============================
// RENDER HISTÓRICO
// =============================
function renderHistorico() {
  const container = $("historico");
  if (!container) return;

  container.innerHTML = "";

  state.historico.forEach(item => {
    const div = document.createElement("div");
    div.className = "mb-2 p-2 border rounded text-sm";
    div.textContent = `${item.maquina} | ${item.pecas} peças | ${item.horas}h`;
    container.appendChild(div);
  });
}

// =============================
// RENDER LISTA DE ESPERA
// =============================
function renderEspera() {
  const container = $("lista-espera");
  if (!container) return;

  container.innerHTML = "";

  state.espera
    .sort((a, b) => a.prioridade - b.prioridade)
    .forEach((item, index) => {
      const div = document.createElement("div");
      div.className = "flex justify-between items-center p-2 mb-2 rounded cursor-move";

      // cor por prioridade
      if (item.prioridade === 1) div.style.background = "#dc2626";
      if (item.prioridade === 2) div.style.background = "#f59e0b";
      if (item.prioridade === 3) div.style.background = "#16a34a";

      div.draggable = true;

      div.innerHTML = `
        <span>${item.texto}</span>
        <button data-i="${index}" style="font-weight:bold">X</button>
      `;

      div.querySelector("button").onclick = () => {
        state.espera.splice(index, 1);
        renderEspera();
      };

      container.appendChild(div);
    });
}

// =============================
// BOTÕES
// =============================
const btnSalvar = $("btnSalvar");
if (btnSalvar) {
  btnSalvar.onclick = () => {
    alert("Informações fixadas (não enviadas ao histórico)");
  };
}

const btnAddHistorico = $("btnAddHistorico");
if (btnAddHistorico) {
  btnAddHistorico.onclick = () => {
    const maquina = $("maquina")?.value || "";
    const pecas = Number($("pecas")?.value || 0);
    const horas = Number($("horas")?.value || 0);

    state.historico.push({ maquina, pecas, horas });
    renderHistorico();
    renderChart(pecas, horas * 10);
  };
}

const btnLimparHistorico = $("btnLimparHistorico");
if (btnLimparHistorico) {
  btnLimparHistorico.onclick = () => {
    if (state.historico.length === 0) return;
    state.historico = [];
    renderHistorico();
  };
}

const btnAddEspera = $("btnAddEspera");
if (btnAddEspera) {
  btnAddEspera.onclick = () => {
    const texto = $("espera-texto")?.value || "";
    const prioridade = Number($("espera-prioridade")?.value || 3);

    if (!texto) return;

    state.espera.push({ texto, prioridade });
    renderEspera();
  };
}

// =============================
// FIREBASE (LEITURA SEGURA)
// =============================
firebase.database().ref("dados").on("value", snap => {
  const data = snap.val();
  if (!data) return;

  if (Array.isArray(data.historico)) {
    state.historico = data.historico;
    renderHistorico();
  }

  if (Array.isArray(data.espera)) {
    state.espera = data.espera;
    renderEspera();
  }
});

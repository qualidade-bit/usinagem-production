/*************************************************
 * ESTADO GLOBAL (SEM DEPENDER DO HTML)
 *************************************************/
const state = {
  cards: {},
  historico: [],
  espera: []
};

/*************************************************
 * UTILIDADES
 *************************************************/
function $(id) {
  return document.getElementById(id);
}

function corPorEficiencia(ef) {
  if (ef < 50) return '#dc2626';   // vermelho
  if (ef < 75) return '#facc15';   // amarelo
  return '#16a34a';                // verde
}

function prioridadeCor(p) {
  if (p === 'alta') return '#dc2626';
  if (p === 'media') return '#facc15';
  return '#16a34a';
}

/*************************************************
 * GRÁFICO
 *************************************************/
let chart;

function renderGrafico() {
  const canvas = $('graficoComparativo');
  if (!canvas) return;

  const labels = [];
  const dados = [];
  const cores = [];

  state.historico.forEach(h => {
    labels.push(h.maquina);
    dados.push(h.eficiencia);
    cores.push(corPorEficiencia(h.eficiencia));
  });

  if (chart) chart.destroy();

  chart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Eficiência (%)',
        data: dados,
        backgroundColor: cores
      }]
    },
    options: {
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.raw.toFixed(1)}%`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: v => `${v}%`
          }
        }
      }
    }
  });
}

/*************************************************
 * HISTÓRICO
 *************************************************/
function renderHistorico() {
  const container = $('historico');
  if (!container) return;

  container.innerHTML = '';

  state.historico.forEach(h => {
    const div = document.createElement('div');
    div.className = 'p-2 border-b text-sm';

    div.innerHTML = `
      <strong>${h.maquina}</strong><br>
      Processo: ${h.processo}<br>
      Realizado: ${h.realizado}<br>
      Eficiência: 
      <span style="color:${corPorEficiencia(h.eficiencia)}">
        ${h.eficiencia.toFixed(1)}%
      </span>
      ${h.obs ? `<br>Obs: ${h.obs}` : ''}
    `;

    container.appendChild(div);
  });

  renderGrafico();
}

/*************************************************
 * LISTA DE ESPERA
 *************************************************/
function renderEspera() {
  const ul = $('listaEspera');
  if (!ul) return;

  ul.innerHTML = '';

  state.espera
    .sort((a, b) => a.prioridadeNum - b.prioridadeNum)
    .forEach((item, index) => {
      const li = document.createElement('li');
      li.draggable = true;
      li.className = 'p-2 mb-1 flex justify-between items-center text-white';
      li.style.background = prioridadeCor(item.prioridade);

      li.innerHTML = `
        <span>${item.texto}</span>
        <button data-i="${index}" class="excluir">✖</button>
      `;

      li.addEventListener('dragstart', e => {
        e.dataTransfer.setData('i', index);
      });

      li.addEventListener('drop', e => {
        e.preventDefault();
        const from = e.dataTransfer.getData('i');
        const to = index;
        state.espera.splice(to, 0, state.espera.splice(from, 1)[0]);
        renderEspera();
      });

      li.addEventListener('dragover', e => e.preventDefault());

      ul.appendChild(li);
    });

  ul.querySelectorAll('.excluir').forEach(btn => {
    btn.onclick = () => {
      state.espera.splice(btn.dataset.i, 1);
      renderEspera();
    };
  });
}

/*************************************************
 * BOTÕES
 *************************************************/
$('btnAdicionarHistorico')?.addEventListener('click', () => {
  const previsto = Number($('previsto')?.textContent || 0);
  const realizado = Number($('realizado')?.value || 0);

  const eficiencia = previsto > 0 ? (realizado / previsto) * 100 : 0;

  state.historico.push({
    maquina: $('nomeMaquina')?.textContent || 'Máquina',
    processo: $('processo')?.value || '',
    realizado,
    eficiencia,
    obs: $('observacao')?.value || ''
  });

  renderHistorico();
});

$('btnAdicionarEspera')?.addEventListener('click', () => {
  const texto = $('textoEspera')?.value;
  const prioridade = $('prioridade')?.value;

  if (!texto || !prioridade) return;

  state.espera.push({
    texto,
    prioridade,
    prioridadeNum: prioridade === 'alta' ? 0 : prioridade === 'media' ? 1 : 2
  });

  renderEspera();
});

/*************************************************
 * INICIAL
 *************************************************/
renderHistorico();
renderEspera();

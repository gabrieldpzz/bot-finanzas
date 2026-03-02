const telegramToken = process.env.TELEGRAM_TOKEN;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabaseHeaders = {
  'apikey': supabaseKey,
  'Authorization': `Bearer ${supabaseKey}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

// Obtiene la fecha exacta en El Salvador
export function obtenerFechaSV() {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: 'America/El_Salvador', month: 'numeric', day: 'numeric', year: 'numeric' });
  const partes = dtf.formatToParts(new Date());
  const mes = parseInt(partes.find(p => p.type === 'month').value);
  const dia = parseInt(partes.find(p => p.type === 'day').value);
  const horaSV = new Date(new Date().toLocaleString("en-US", {timeZone: "America/El_Salvador"}));
  return { mes, quincena: dia <= 15 ? 1 : 2, horaFormat: horaSV.getHours() + ":" + horaSV.getMinutes() };
}

// Función para enviar mensajes de texto normales o con botones
export async function enviarMensaje(chatId, text, replyMarkup = null) {
  const payload = { chat_id: chatId, text: text, parse_mode: 'Markdown' };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
}

// NUEVO: Función para enviar una imagen por URL a Telegram
export async function enviarImagen(chatId, imageUrl, caption = "") {
  await fetch(`https://api.telegram.org/bot${telegramToken}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      photo: imageUrl,
      caption: caption,
      parse_mode: 'Markdown'
    })
  });
}

// FUNCIONES DE SUPABASE
export async function guardarIngreso(chatId, monto, distribucion, mes, quincena) {
  await fetch(`${supabaseUrl}/rest/v1/ingresos_historial`, {
    method: 'POST', headers: supabaseHeaders,
    body: JSON.stringify({ telegram_id: chatId, monto_ingreso: monto, distribucion_json: distribucion, mes: mes, quincena: quincena })
  });
}

export async function obtenerUltimoIngreso(chatId, mes, quincena) {
  const res = await fetch(`${supabaseUrl}/rest/v1/ingresos_historial?telegram_id=eq.${chatId}&mes=eq.${mes}&quincena=eq.${quincena}&order=fecha.desc&limit=1`, { headers: supabaseHeaders });
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function obtenerGastosFijosTodos(chatId) {
  const res = await fetch(`${supabaseUrl}/rest/v1/gastos_fijos?telegram_id=eq.${chatId}`, { headers: supabaseHeaders });
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function obtenerGastosFijosQuincena(chatId, quincena) {
  const res = await fetch(`${supabaseUrl}/rest/v1/gastos_fijos?telegram_id=eq.${chatId}&quincena=eq.${quincena}`, { headers: supabaseHeaders });
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function guardarGastoFijo(chatId, nombre, costo, quincena) {
  await fetch(`${supabaseUrl}/rest/v1/gastos_fijos`, {
    method: 'POST', headers: supabaseHeaders,
    body: JSON.stringify({ telegram_id: chatId, nombre_gasto: nombre, monto: costo, quincena: quincena })
  });
}

export async function guardarGastoVariable(chatId, monto, categoria, mes, quincena) {
  await fetch(`${supabaseUrl}/rest/v1/gastos_variables`, {
    method: 'POST', headers: supabaseHeaders,
    body: JSON.stringify({ telegram_id: chatId, monto: monto, categoria: categoria, mes: mes, quincena: quincena })
  });
}

export async function obtenerGastosVariables(chatId, mes, quincena) {
  const res = await fetch(`${supabaseUrl}/rest/v1/gastos_variables?telegram_id=eq.${chatId}&mes=eq.${mes}&quincena=eq.${quincena}`, { headers: supabaseHeaders });
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function borrarHistorial(chatId) {
  await fetch(`${supabaseUrl}/rest/v1/ingresos_historial?telegram_id=eq.${chatId}`, { method: 'DELETE', headers: supabaseHeaders });
  await fetch(`${supabaseUrl}/rest/v1/gastos_fijos?telegram_id=eq.${chatId}`, { method: 'DELETE', headers: supabaseHeaders });
  await fetch(`${supabaseUrl}/rest/v1/gastos_variables?telegram_id=eq.${chatId}`, { method: 'DELETE', headers: supabaseHeaders });
}

// -----------------------------------------------------
// MAGIA: Generar URL del gráfico con QuickChart.io
// -----------------------------------------------------
export function generarUrlGrafico(necesidades, deseos, ahorro) {
  // Configuración del gráfico en formato JSON para la API
  const chartConfig = {
    type: 'pie', // Gráfico circular
    data: {
      labels: [`Nec ($${necesidades})`, `Des ($${deseos})`, `Aho ($${ahorro})`],
      datasets: [{
        data: [necesidades, deseos, ahorro],
        backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56'], // Colores fresas
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      legend: { position: 'bottom', labels: { fontSize: 16, fontStyle: 'bold' } },
      title: { display: true, text: 'Distribución Quincenal', fontSize: 22 },
      // Plugins para mostrar el porcentaje adentro
      plugins: {
        datalabels: {
          display: true,
          color: 'white',
          font: { weight: 'bold', size: 16 },
          formatter: (value, ctx) => {
            let sum = 0;
            let dataArr = ctx.chart.data.datasets[0].data;
            dataArr.map(data => { sum += data; });
            let percentage = (value * 100 / sum).toFixed(0) + "%";
            return percentage;
          }
        }
      }
    }
  };

  // Convertimos el JSON a una cadena segura para URL y armamos el enlace final
  const encodedConfig = encodeURIComponent(JSON.stringify(chartConfig));
  return `https://quickchart.io/chart?c=${encodedConfig}&bg=white&w=500&h=400`;
}

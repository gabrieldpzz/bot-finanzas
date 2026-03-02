const telegramToken = process.env.TELEGRAM_TOKEN;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabaseHeaders = {
  'apikey': supabaseKey,
  'Authorization': `Bearer ${supabaseKey}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

export function obtenerFechaSV() {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: 'America/El_Salvador', month: 'numeric', day: 'numeric', year: 'numeric' });
  const partes = dtf.formatToParts(new Date());
  const mes = parseInt(partes.find(p => p.type === 'month').value);
  const dia = parseInt(partes.find(p => p.type === 'day').value);
  const horaSV = new Date(new Date().toLocaleString("en-US", {timeZone: "America/El_Salvador"}));
  return { mes, quincena: dia <= 15 ? 1 : 2, horaFormat: horaSV.getHours() + ":" + horaSV.getMinutes() };
}

export async function enviarMensaje(chatId, text, replyMarkup = null) {
  const payload = { chat_id: chatId, text: text, parse_mode: 'Markdown' };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
}

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
// GRÁFICO DE BARRAS DE PROGRESO (Chuchuruxo Style)
// -----------------------------------------------------
export function generarUrlGrafico(gastadoNec, dispNec, gastadoDes, dispDes, gastadoAho, dispAho) {
  const chartConfig = {
    type: 'horizontalBar',
    data: {
      labels: ['Necesidades', 'Deseos', 'Ahorro'],
      datasets: [
        {
          label: 'Gastado',
          data: [gastadoNec, gastadoDes, gastadoAho],
          backgroundColor: '#FF4D4D', // Rojo (peligro)
        },
        {
          label: 'Disponible',
          data: [dispNec, dispDes, dispAho],
          backgroundColor: '#4CAF50', // Verde (billete)
        }
      ]
    },
    options: {
      title: { display: true, text: 'Progreso del Presupuesto ($)', fontSize: 20 },
      scales: {
        xAxes: [{ stacked: true }],
        yAxes: [{ stacked: true }]
      },
      plugins: {
        datalabels: {
          color: '#ffffff',
          font: { weight: 'bold', size: 14 },
          // Solo muestra el número si es mayor a cero para que no se vea amontonado
          formatter: (value) => value > 0 ? '$' + value.toFixed(0) : ''
        }
      }
    }
  };

  const encodedConfig = encodeURIComponent(JSON.stringify(chartConfig));
  return `https://quickchart.io/chart?c=${encodedConfig}&bg=white&w=600&h=350`;
}

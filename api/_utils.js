const telegramToken = process.env.TELEGRAM_TOKEN;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabaseHeaders = {
  'apikey': supabaseKey,
  'Authorization': `Bearer ${supabaseKey}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

// Obtiene la fecha exacta en El Salvador para no fallar con los cambios de servidor
export function obtenerFechaSV() {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: 'America/El_Salvador', month: 'numeric', day: 'numeric', year: 'numeric' });
  const partes = dtf.formatToParts(new Date());
  const mes = parseInt(partes.find(p => p.type === 'month').value);
  const dia = parseInt(partes.find(p => p.type === 'day').value);
  return { mes, quincena: dia <= 15 ? 1 : 2 };
}

export async function enviarMensaje(chatId, text, replyMarkup = null) {
  const payload = { chat_id: chatId, text: text };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
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

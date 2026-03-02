const telegramToken = process.env.TELEGRAM_TOKEN;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabaseHeaders = {
  'apikey': supabaseKey,
  'Authorization': `Bearer ${supabaseKey}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

export async function enviarMensaje(chatId, text, replyMarkup = null) {
  const payload = { chat_id: chatId, text: text };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  
  await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function guardarIngreso(chatId, monto, distribucion) {
  await fetch(`${supabaseUrl}/rest/v1/ingresos_historial`, {
    method: 'POST',
    headers: supabaseHeaders,
    body: JSON.stringify({
      telegram_id: chatId,
      monto_ingreso: monto,
      distribucion_json: distribucion
    })
  });
}

// NUEVO: Consultar si el usuario ya tiene gastos fijos
export async function obtenerGastos(chatId) {
  const res = await fetch(`${supabaseUrl}/rest/v1/gastos_fijos?telegram_id=eq.${chatId}&select=*`, {
    method: 'GET',
    headers: supabaseHeaders
  });
  const data = await res.json();
  return data; // Retorna un array con los gastos
}

// NUEVO: Guardar un gasto fijo nuevo
export async function guardarGastoFijo(chatId, nombre, costo, fecha) {
  await fetch(`${supabaseUrl}/rest/v1/gastos_fijos`, {
    method: 'POST',
    headers: supabaseHeaders,
    body: JSON.stringify({
      telegram_id: chatId,
      nombre_gasto: nombre,
      monto: costo,
      fecha_renovacion: fecha
    })
  });
}

export async function borrarHistorial(chatId) {
  await fetch(`${supabaseUrl}/rest/v1/ingresos_historial?telegram_id=eq.${chatId}`, {
    method: 'DELETE',
    headers: supabaseHeaders
  });
  await fetch(`${supabaseUrl}/rest/v1/gastos_fijos?telegram_id=eq.${chatId}`, {
    method: 'DELETE',
    headers: supabaseHeaders
  });
}

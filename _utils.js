const telegramToken = process.env.TELEGRAM_TOKEN;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabaseHeaders = {
  'apikey': supabaseKey,
  'Authorization': `Bearer ${supabaseKey}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

// Función para enviar mensajes a Telegram
export async function enviarMensaje(chatId, text, replyMarkup = null) {
  const payload = { chat_id: chatId, text: text };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  
  await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

// Función para insertar en Supabase
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

// Función para borrar el historial del usuario
export async function borrarHistorial(chatId) {
  await fetch(`${supabaseUrl}/rest/v1/ingresos_historial?telegram_id=eq.${chatId}`, {
    method: 'DELETE',
    headers: supabaseHeaders
  });
}

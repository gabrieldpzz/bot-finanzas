export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('Bot vivo y coleando.');

  const body = req.body;
  const telegramToken = process.env.TELEGRAM_TOKEN;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  // Cabeceras obligatorias para hablar con Supabase vía REST API
  const supabaseHeaders = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
  };

  // Función de apoyo para mandar mensajes a Telegram fácilmente
  const enviarMensaje = async (chatId, text, replyMarkup = null) => {
    const payload = { chat_id: chatId, text: text };
    if (replyMarkup) payload.reply_markup = replyMarkup;
    
    await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  };

  // -----------------------------------------------------
  // 1. MANEJO DE BOTONES (Callback Queries)
  // -----------------------------------------------------
  if (body.callback_query) {
    const chatId = body.callback_query.message.chat.id;
    const data = body.callback_query.data;

    if (data === 'btn_ingreso') {
      await enviarMensaje(chatId, "Escribe la palabra 'ingreso' seguido del monto, maje. Ejemplo: ingreso 500");
    } 
    else if (data === 'btn_borrar_todo') {
      // Borrar registros de ESTE usuario en ambas tablas
      await fetch(`${supabaseUrl}/rest/v1/ingresos_historial?telegram_id=eq.${chatId}`, {
        method: 'DELETE',
        headers: supabaseHeaders
      });
      await fetch(`${supabaseUrl}/rest/v1/gastos_fijos?telegram_id=eq.${chatId}`, {
        method: 'DELETE',
        headers: supabaseHeaders
      });
      // También podrías borrarlo de la tabla 'usuarios' si quisieras.
      
      await enviarMensaje(chatId, "🧹 ¡Hecho! Todo tu historial de ingresos y gastos ha sido eliminado. Tu bóveda está limpia.");
    }

    // Le respondemos a Telegram para quitar el "relojito" de carga del botón
    await fetch(`https://api.telegram.org/bot${telegramToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: body.callback_query.id })
    });

    return res.status(200).send('OK');
  }

  // -----------------------------------------------------
  // 2. MANEJO DE MENSAJES DE TEXTO
  // -----------------------------------------------------
  if (body.message && body.message.text) {
    const chatId = body.message.chat.id;
    const texto = body.message.text.trim();

    if (texto.startsWith('/start') || texto.startsWith('/menu')) {
      // Registrar al usuario en Supabase en silencio (Si ya existe, falla silenciosamente y sigue)
      await fetch(`${supabaseUrl}/rest/v1/usuarios`, {
        method: 'POST',
        headers: { ...supabaseHeaders, 'Prefer': 'resolution=ignore-duplicates' },
        body: JSON.stringify({ telegram_id: chatId })
      });

      // Crear el menú de botones
      const menuBotones = {
        inline_keyboard: [
          [{ text: '💰 Registrar Ingreso', callback_data: 'btn_ingreso' }],
          [{ text: '🗑️ Borrar Todo mi Historial', callback_data: 'btn_borrar_todo' }]
        ]
      };
      await enviarMensaje(chatId, "¡Qué onda! Bienvenido a tu Gestor Financiero. ¿Qué hacemos hoy?", menuBotones);
    } 
    else if (texto.toLowerCase().startsWith('ingreso ')) {
      // Capturar el número que mandó el usuario
      const monto = parseFloat(texto.split(' ')[1]);
      
      if (!isNaN(monto)) {
        // Aquí simulamos el cálculo del 50-30-20. 
        // Más adelante cruzaremos esto con los gastos fijos de la base de datos.
        const distribucion = {
          necesidades_50: monto * 0.5,
          deseos_30: monto * 0.3,
          ahorro_20: monto * 0.2
        };

        // Guardar el registro en la tabla de Supabase
        await fetch(`${supabaseUrl}/rest/v1/ingresos_historial`, {
          method: 'POST',
          headers: supabaseHeaders,
          body: JSON.stringify({
            telegram_id: chatId,
            monto_ingreso: monto,
            distribucion_json: distribucion
          })
        });

        const resumen = `¡Nítido! Ingreso de $${monto} guardado en la base de datos.\n\n` +
                        `📊 *Distribución 50-30-20 base:*\n` +
                        `Gastos y Necesidades: $${distribucion.necesidades_50}\n` +
                        `Deseos y Gustos: $${distribucion.deseos_30}\n` +
                        `Ahorro / Deudas: $${distribucion.ahorro_20}`;
                        
        await enviarMensaje(chatId, resumen);
      } else {
        await enviarMensaje(chatId, "Formato incorrecto. Escribe por ejemplo: ingreso 500");
      }
    } else {
      await enviarMensaje(chatId, "No reconozco ese comando. Manda /menu para ver las opciones.");
    }
  }

  return res.status(200).send('OK');
}

import { enviarMensaje, guardarIngreso, borrarHistorial } from './_utils.js';

export default async function handler(req, res) {
  // Vercel a veces manda peticiones GET para revisar si el endpoint vive
  if (req.method !== 'POST') return res.status(200).send('Bot activo y al 100.');

  const body = req.body;
  const telegramToken = process.env.TELEGRAM_TOKEN;

  // -----------------------------------------------------
  // 1. MANEJO DE BOTONES (Callback Queries)
  // -----------------------------------------------------
  if (body.callback_query) {
    const chatId = body.callback_query.message.chat.id;
    const data = body.callback_query.data;

    if (data === 'btn_ingreso') {
      // Activa el ForceReply para que el usuario solo escriba el número
      await enviarMensaje(chatId, "💰 Ingresa el monto (solo números):", {
        force_reply: true,
        input_field_placeholder: "Ejemplo: 500"
      });
    } 
    else if (data === 'btn_ver_gastos') {
      await enviarMensaje(chatId, "💸 Aquí verás tus gastos fijos. (Módulo en construcción)");
    }
    else if (data === 'btn_ver_resumen') {
      await enviarMensaje(chatId, "📊 Aquí verás el resumen de tu quincena. (Módulo en construcción)");
    }
    else if (data === 'btn_borrar_todo') {
      await borrarHistorial(chatId);
      await enviarMensaje(chatId, "🧹 ¡Hecho, maje! Tu bóveda de ingresos está limpia.");
    }

    // Cerrar el estado de carga del botón en la app de Telegram
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

    // Detectar si el usuario está respondiendo al mensaje de ForceReply
    if (body.message.reply_to_message && body.message.reply_to_message.text.includes("💰 Ingresa el monto")) {
      const monto = parseFloat(texto);
      
      if (!isNaN(monto)) {
        // Matemática del 50-30-20
        const distribucion = {
          necesidades_50: monto * 0.5,
          deseos_30: monto * 0.3,
          ahorro_20: monto * 0.2
        };

        await guardarIngreso(chatId, monto, distribucion);

        const resumen = `¡Nítido! Ingreso de $${monto} guardado en la base.\n\n` +
                        `📊 *Distribución 50-30-20:*\n` +
                        `Necesidades: $${distribucion.necesidades_50}\n` +
                        `Deseos: $${distribucion.deseos_30}\n` +
                        `Ahorro: $${distribucion.ahorro_20}`;
                        
        await enviarMensaje(chatId, resumen);
      } else {
        await enviarMensaje(chatId, "Ese no es un número válido. Intenta de nuevo tocando el botón de Registrar Ingreso.");
      }
      return res.status(200).send('OK');
    }

    // Comando principal para lanzar el menú
    if (texto.startsWith('/start') || texto.startsWith('/menu')) {
      const menuBotones = {
        inline_keyboard: [
          [{ text: '💰 Registrar Ingreso', callback_data: 'btn_ingreso' }],
          [{ text: '💸 Ver Mis Gastos', callback_data: 'btn_ver_gastos' }, { text: '📊 Ver Resumen', callback_data: 'btn_ver_resumen' }],
          [{ text: '🗑️ Borrar Historial', callback_data: 'btn_borrar_todo' }]
        ]
      };
      await enviarMensaje(chatId, "¿Qué ondas? ¿Qué vamos a revisar hoy?", menuBotones);
    }
  }

  // Telegram y Vercel necesitan este OK para saber que el mensaje fue procesado
  return res.status(200).send('OK');
}

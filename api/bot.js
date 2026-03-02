import { enviarMensaje, guardarIngreso, borrarHistorial, obtenerGastos, guardarGastoFijo } from './_utils.js';

export default async function handler(req, res) {
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
      // Validar si tiene gastos antes de dejarlo meter ingresos
      const gastos = await obtenerGastos(chatId);
      if (!gastos || gastos.length === 0) {
        await enviarMensaje(chatId, "⚠️ Pérate maje. Antes de registrar ingresos, tenés que registrar al menos un Gasto Fijo para hacer bien el cálculo.\n\n📝 Ingresa el NOMBRE del gasto:", {
          force_reply: true,
          input_field_placeholder: "Ejemplo: Recibo de Internet"
        });
      } else {
        await enviarMensaje(chatId, "💰 Ingresa el monto (solo números):", {
          force_reply: true,
          input_field_placeholder: "Ejemplo: 500"
        });
      }
    } 
    else if (data === 'btn_gasto') {
      // Iniciar la cadena para agregar un nuevo gasto
      await enviarMensaje(chatId, "📝 Ingresa el NOMBRE del gasto:", {
        force_reply: true,
        input_field_placeholder: "Ejemplo: Luz, Agua, Alquiler"
      });
    }
    else if (data === 'btn_ver_gastos') {
      const gastos = await obtenerGastos(chatId);
      if (!gastos || gastos.length === 0) {
        await enviarMensaje(chatId, "Aún no tenés gastos fijos guardados.");
      } else {
        let lista = "💸 *Tus Gastos Fijos:*\n\n";
        gastos.forEach(g => {
          lista += `- ${g.nombre_gasto}: $${g.monto} (Renueva: ${g.fecha_renovacion})\n`;
        });
        await enviarMensaje(chatId, lista);
      }
    }
    else if (data === 'btn_borrar_todo') {
      await borrarHistorial(chatId);
      await enviarMensaje(chatId, "🧹 ¡Hecho, maje! Tu bóveda de ingresos y gastos está limpia.");
    }

    await fetch(`https://api.telegram.org/bot${telegramToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: body.callback_query.id })
    });

    return res.status(200).send('OK');
  }

  // -----------------------------------------------------
  // 2. MANEJO DE MENSAJES DE TEXTO (Respuestas en Cadena)
  // -----------------------------------------------------
  if (body.message && body.message.text) {
    const chatId = body.message.chat.id;
    const texto = body.message.text.trim();
    const textoRespondido = body.message.reply_to_message ? body.message.reply_to_message.text : "";

    // A. Respuesta a "Ingresar monto de INGRESO"
    if (textoRespondido.includes("💰 Ingresa el monto")) {
      const monto = parseFloat(texto);
      if (!isNaN(monto)) {
        // Aquí luego meteremos la resta de los gastos reales. Por ahora es el 50-30-20 base.
        const distribucion = { necesidades_50: monto * 0.5, deseos_30: monto * 0.3, ahorro_20: monto * 0.2 };
        await guardarIngreso(chatId, monto, distribucion);
        const resumen = `¡Nítido! Ingreso de $${monto} guardado en la base.\n\n📊 *Distribución 50-30-20:*\nNecesidades: $${distribucion.necesidades_50}\nDeseos: $${distribucion.deseos_30}\nAhorro: $${distribucion.ahorro_20}`;
        await enviarMensaje(chatId, resumen);
      } else {
        await enviarMensaje(chatId, "Ese no es un número válido. Intenta de nuevo.");
      }
      return res.status(200).send('OK');
    }

    // B. Respuesta a "Ingresar NOMBRE de gasto" (Paso 1)
    if (textoRespondido.includes("📝 Ingresa el NOMBRE del gasto")) {
      const nombreGasto = texto;
      await enviarMensaje(chatId, `💸 Ingresa el COSTO de "${nombreGasto}":`, {
        force_reply: true,
        input_field_placeholder: "Ejemplo: 35.50"
      });
      return res.status(200).send('OK');
    }

    // C. Respuesta a "Ingresar COSTO de gasto" (Paso 2)
    if (textoRespondido.includes("💸 Ingresa el COSTO de")) {
      // Extraemos el nombre que viene entre comillas en el mensaje anterior
      const match = textoRespondido.match(/"([^"]+)"/);
      const nombreGasto = match ? match[1] : "Gasto";
      const costo = parseFloat(texto);

      if (!isNaN(costo)) {
        await enviarMensaje(chatId, `📅 Ingresa la FECHA de renovación de "${nombreGasto}" ($${costo}). Formato DD/MM/AAAA:`, {
          force_reply: true,
          input_field_placeholder: "Ejemplo: 15/03/2026"
        });
      } else {
        await enviarMensaje(chatId, "El costo debe ser un número. Volvé a empezar el registro.");
      }
      return res.status(200).send('OK');
    }

    // D. Respuesta a "Ingresar FECHA de gasto" (Paso 3 Final)
    if (textoRespondido.includes("📅 Ingresa la FECHA de renovación de")) {
      // Extraemos nombre y costo con Regex del mensaje anterior
      const regex = /"([^"]+)" \(\$([0-9.]+)\)/;
      const match = textoRespondido.match(regex);
      
      if (match) {
        const nombreGasto = match[1];
        const costo = parseFloat(match[2]);
        const fecha = texto; // Aquí entra la fecha DD/MM/AAAA

        await guardarGastoFijo(chatId, nombreGasto, costo, fecha);
        await enviarMensaje(chatId, `✅ ¡Perro, ya estuvo! El gasto fijo "${nombreGasto}" por $${costo} que se paga el ${fecha} ha sido guardado exitosamente.`);
      }
      return res.status(200).send('OK');
    }

    // Menú Principal
    if (texto.startsWith('/start') || texto.startsWith('/menu')) {
      const menuBotones = {
        inline_keyboard: [
          [{ text: '💰 Registrar Ingreso', callback_data: 'btn_ingreso' }],
          [{ text: '➕ Agregar Gasto Fijo', callback_data: 'btn_gasto' }, { text: '💸 Ver Mis Gastos', callback_data: 'btn_ver_gastos' }],
          [{ text: '🗑️ Borrar Historial', callback_data: 'btn_borrar_todo' }]
        ]
      };
      await enviarMensaje(chatId, "¿Qué ondas? ¿Qué vamos a revisar hoy?", menuBotones);
    }
  }

  return res.status(200).send('OK');
}

import { 
  enviarMensaje, enviarImagen, guardarIngreso, obtenerUltimoIngreso, borrarHistorial, 
  obtenerGastosFijosTodos, obtenerGastosFijosQuincena, guardarGastoFijo, 
  guardarGastoVariable, obtenerGastosVariables, obtenerFechaSV, generarUrlGrafico 
} from './_utils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('Bot activo chuchuruxo.');

  const body = req.body;
  const telegramToken = process.env.TELEGRAM_TOKEN;
  const { mes: mesActual, quincena: quincenaActual } = obtenerFechaSV();

  // -----------------------------------------------------
  // 1. MANEJO DE BOTONES (Callback Queries)
  // -----------------------------------------------------
  if (body.callback_query) {
    const chatId = body.callback_query.message.chat.id;
    let messageId = null;
    if (body.callback_query.message) {
      messageId = body.callback_query.message.message_id;
    }
    const data = body.callback_query.data;

    if (data === 'btn_ingreso') {
      const gastos = await obtenerGastosFijosTodos(chatId);
      if (!gastos || gastos.length === 0) {
        await enviarMensaje(chatId, "⚠️ Pérate maje. Antes de registrar ingresos, tenés que registrar al menos un Gasto Fijo.\n\n📝 Ingresa el NOMBRE del gasto fijo:", { force_reply: true });
      } else {
        await enviarMensaje(chatId, "💰 Ingresa el monto total de tu ingreso de la quincena (solo números):", { force_reply: true });
      }
    } 
    else if (data === 'btn_gasto') {
      await enviarMensaje(chatId, "📝 Ingresa el NOMBRE del gasto fijo (ej: Alquiler):", { force_reply: true });
    }
    else if (data === 'btn_gasto_diario') {
      await enviarMensaje(chatId, "🛒 Ingresa el monto del gasto diario (ej: 10.25):", { force_reply: true });
    }
    else if (data === 'btn_ver_resumen') {
      // -----------------------------------------------------
      // LÓGICA DEL RESUMEN CON GRÁFICO DE BARRAS
      // -----------------------------------------------------
      const ingresoArr = await obtenerUltimoIngreso(chatId, mesActual, quincenaActual);
      if (!ingresoArr || ingresoArr.length === 0) {
        await enviarMensaje(chatId, "No has registrado ningún ingreso para esta quincena. Toca en 'Ingreso' primero para calcular.");
      } else {
        const ing = ingresoArr[0];
        const dist = ing.distribucion_json;
        
        const fijos = await obtenerGastosFijosQuincena(chatId, quincenaActual);
        const totalFijos = fijos.reduce((sum, g) => sum + g.monto, 0);

        const variables = await obtenerGastosVariables(chatId, mesActual, quincenaActual);
        let gastadoNec = 0; let gastadoDes = 0;
        variables.forEach(v => {
          if(v.categoria === 'NECESIDAD') gastadoNec += v.monto;
          if(v.categoria === 'DESEO') gastadoDes += v.monto;
        });

        // Sumas totales para el gráfico
        const gastoTotalNec = totalFijos + gastadoNec;
        const disponibleNec = dist.necesidades_50 - gastoTotalNec;
        const disponibleDes = dist.deseos_30 - gastadoDes;

        // GENERAR GRÁFICO DE BARRAS APILADAS
        const urlImagen = generarUrlGrafico(
          gastoTotalNec, disponibleNec, // Necesidades (Rojo, Verde)
          gastadoDes, disponibleDes,    // Deseos (Rojo, Verde)
          0, dist.ahorro_20             // Ahorro (Cero gastado, todo disponible)
        );

        let resText = `📊 *RESUMEN: Mes ${mesActual} | Quincena ${quincenaActual}*\n`;
        resText += `💰 Ingreso Total: $${ing.monto_ingreso.toFixed(2)}\n\n`;
        
        resText += `🛑 *NECESIDADES (50%): $${dist.necesidades_50.toFixed(2)}*\n`;
        resText += `   - Fijos Quincena: -$${totalFijos.toFixed(2)}\n`;
        resText += `   - Gastos Diarios: -$${gastadoNec.toFixed(2)}\n`;
        resText += `   >> *Disponible:* $${disponibleNec.toFixed(2)}\n\n`;

        resText += `🎉 *DESEOS (30%): $${dist.deseos_30.toFixed(2)}*\n`;
        resText += `   - Gastado Diario: -$${gastadoDes.toFixed(2)}\n`;
        resText += `   >> *Disponible:* $${disponibleDes.toFixed(2)}\n\n`;

        resText += `🏦 *AHORRO/DEUDAS (20%): $${dist.ahorro_20.toFixed(2)}*`;

        await enviarImagen(chatId, urlImagen, resText);
      }
    }
    else if (data === 'btn_borrar_todo') {
      await borrarHistorial(chatId);
      await enviarMensaje(chatId, "🧹 ¡Hecho, chucho! Toda tu base de datos fue formateada exitosamente.");
    }

    // B. MANEJO DE BOTONES DE SELECCIÓN DE CATEGORÍA Y QUINCENA
    else if (data.startsWith('set_quin_')) {
      // Extraemos datos del callback
      // Formato: set_quin_1_paga_Luz_costo_35.5
      const regex = /set_quin_(\d+)_paga_(.*)_costo_([\d.]+)/;
      const match = data.match(regex);
      
      if (match) {
        const quincena = parseInt(match[1]);
        const nombre = match[2];
        const costo = parseFloat(match[3]);

        await guardarGastoFijo(chatId, nombre, costo, quincena);
        
        if (messageId) {
          await fetch(`https://api.telegram.org/bot${telegramToken}/deleteMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, message_id: messageId })
          });
        }
        await enviarMensaje(chatId, `✅ ¡Uf, perrito! Gasto fijo "${nombre}" guardado para la Quincena ${quincena}.`);
      }
    }

    else if (data.startsWith('set_cat_')) {
      // Formato: set_cat_NECESIDAD_monto_10.5
      const regex = /set_cat_(.*)_monto_([\d.]+)/;
      const match = data.match(regex);

      if (match) {
        const categoria = match[1];
        const monto = parseFloat(match[2]);
        
        await guardarGastoVariable(chatId, monto, categoria, mesActual, quincenaActual);
        
        if (messageId) {
          await fetch(`https://api.telegram.org/bot${telegramToken}/deleteMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, message_id: messageId })
          });
        }

        const emoji = categoria === 'DESEO' ? '🎉' : '🛑';
        await enviarMensaje(chatId, `✅ ${emoji} Gasto diario de $${monto.toFixed(2)} restado de tu cuenta de ${categoria}.`);
      }
    }

    await fetch(`https://api.telegram.org/bot${telegramToken}/answerCallbackQuery`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: body.callback_query.id })
    });
    return res.status(200).send('OK');
  }

  // -----------------------------------------------------
  // 2. MANEJO DE MENSAJES DE TEXTO (Respuestas ForceReply)
  // -----------------------------------------------------
  if (body.message && body.message.text) {
    const chatId = body.message.chat.id;
    const texto = body.message.text.trim();
    const textoRespondido = body.message.reply_to_message ? body.message.reply_to_message.text : "";

    // A. INGRESOS
    if (textoRespondido.includes("💰 Ingresa el monto total de tu ingreso")) {
      const monto = parseFloat(texto);
      if (!isNaN(monto) && monto > 0) {
        const dist = { necesidades_50: monto * 0.5, deseos_30: monto * 0.3, ahorro_20: monto * 0.2 };
        await guardarIngreso(chatId, monto, dist, mesActual, quincenaActual);
        
        const fijos = await obtenerGastosFijosQuincena(chatId, quincenaActual);
        const totalFijos = fijos.reduce((sum, g) => sum + g.monto, 0);
        const libreNec = dist.necesidades_50 - totalFijos;

        const msj = `¡Nítido! Ingreso guardado para Mes ${mesActual}, Quincena ${quincenaActual}.\n\n` +
                    `🛑 Necesidades (50%): $${dist.necesidades_50.toFixed(2)}\n` +
                    `Apartados para fijos: -$${totalFijos.toFixed(2)}\n` +
                    `Te quedan *$${libreNec.toFixed(2)}* para diario en esta quincena.\n\n` +
                    `Toca en 'Resumen' para ver las barras de progreso.`;
        await enviarMensaje(chatId, msj);
      } else {
        await enviarMensaje(chatId, "⚠️ Ingresa un número válido y mayor a cero, maje.");
      }
      return res.status(200).send('OK');
    }

    // B. GASTOS FIJOS
    if (textoRespondido.includes("📝 Ingresa el NOMBRE del gasto fijo")) {
      await enviarMensaje(chatId, `💸 Ingresa el COSTO mensual de "${texto}" (solo números):`, { force_reply: true });
      return res.status(200).send('OK');
    }
    if (textoRespondido.includes("💸 Ingresa el COSTO mensual de")) {
      const match = textoRespondido.match(/"([^"]+)"/);
      const nombreGasto = match ? match[1] : "Gasto";
      const costo = parseFloat(texto);
      if (!isNaN(costo) && costo > 0) {
        const botonesQuincena = {
          inline_keyboard: [
            [
              { text: '1️⃣ Primera (días 1-15)', callback_data: `set_quin_1_paga_${nombreGasto}_costo_${costo}` },
              { text: '2️⃣ Segunda (días 16+)', callback_data: `set_quin_2_paga_${nombreGasto}_costo_${costo}` }
            ]
          ]
        };
        await enviarMensaje(chatId, `📅 ¿En qué quincena se paga "${nombreGasto}" ($${costo.toFixed(2)})? Toca un botón:`, botonesQuincena);
      } else {
        await enviarMensaje(chatId, "El costo debe ser un número mayor a cero. Volvé a empezar el registro.");
      }
      return res.status(200).send('OK');
    }

    // C. GASTOS DIARIOS
    if (textoRespondido.includes("🛒 Ingresa el monto del gasto diario")) {
      const monto = parseFloat(texto);
      if (!isNaN(monto) && monto > 0) {
        const botonesCategoria = {
          inline_keyboard: [
            [
              { text: '🛑 Necesidad (Comida/Bus)', callback_data: `set_cat_NECESIDAD_monto_${monto}` },
              { text: '🎉 Deseo (Salida/Bicha)', callback_data: `set_cat_DESEO_monto_${monto}` }
            ]
          ]
        };
        await enviarMensaje(chatId, `🏷️ ¿El gasto diario de $${monto.toFixed(2)} fue una Necesidad o un Deseo? Toca un botón:`, botonesCategoria);
      } else {
        await enviarMensaje(chatId, "Ingresa un número válido para el gasto diario.");
      }
      return res.status(200).send('OK');
    }

    // D. MENU PRINCIPAL
    if (texto.startsWith('/start') || texto.startsWith('/menu')) {
      const menuBotones = {
        inline_keyboard: [
          [{ text: '📊 Ver Resumen (Barras)', callback_data: 'btn_ver_resumen' }],
          [{ text: '💰 Ingreso', callback_data: 'btn_ingreso' }, { text: '➕ Gasto Fijo', callback_data: 'btn_gasto' }],
          [{ text: '🛒 Gasto Diario', callback_data: 'btn_gasto_diario' }, { text: '🗑️ Borrar Todo', callback_data: 'btn_borrar_todo' }]
        ]
      };
      await enviarMensaje(chatId, `¿Qué ondas, chucho? Estamos en la *Quincena ${quincenaActual}* del *Mes ${mesActual}*.\n¿Qué toca hacer hoy para que rinda la ficha?`, menuBotones);
    }
  }

  return res.status(200).send('OK');
}

import { 
  enviarMensaje, enviarImagen, guardarIngreso, obtenerUltimoIngreso, borrarHistorial, 
  obtenerGastosFijosTodos, obtenerGastosFijosQuincena, guardarGastoFijo, 
  guardarGastoVariable, obtenerGastosVariables, obtenerFechaSV, generarUrlGrafico 
} from './_utils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('Bot activo.');

  const body = req.body;
  const telegramToken = process.env.TELEGRAM_TOKEN;
  const { mes: mesActual, quincena: quincenaActual } = obtenerFechaSV();

  // -----------------------------------------------------
  // 1. MANEJO DE BOTONES (Callback Queries)
  // -----------------------------------------------------
  if (body.callback_query) {
    const chatId = body.callback_query.message.chat.id;
    const messageId = body.callback_query.message.message_id;
    const data = body.callback_query.data;

    // A. FLUJO PRINCIPAL Y MENÚS
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
      // LÓGICA DEL RESUMEN CON GRÁFICO UVA
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

        // Cálculo de lo que queda
        const disponibleNec = dist.necesidades_50 - totalFijos - gastadoNec;
        const disponibleDes = dist.deseos_30 - gastadoDes;

        // GENERAR GRÁFICO (Usa montos bases del 50-30-20)
        const urlImagen = generarUrlGrafico(dist.necesidades_50, dist.deseos_30, dist.ahorro_20);

        let resText = `📊 *RESUMEN: Mes ${mesActual} | Quincena ${quincenaActual}*\n`;
        resText += `💰 Ingreso Total: $${ing.monto_ingreso.toFixed(2)}\n\n`;
        
        resText += `🛑 *NECESIDADES (50%): $${dist.necesidades_50.toFixed(2)}*\n`;
        resText += `   - Gastos Fijos: -$${totalFijos.toFixed(2)}\n`;
        resText += `   - Gastos Diarios: -$${gastadoNec.toFixed(2)}\n`;
        resText += `   >> *Disponible:* $${disponibleNec.toFixed(2)}\n\n`;

        resText += `🎉 *DESEOS (30%): $${dist.deseos_30.toFixed(2)}*\n`;
        resText += `   - Gastado Diario: -$${gastadoDes.toFixed(2)}\n`;
        resText += `   >> *Disponible:* $${disponibleDes.toFixed(2)}\n\n`;

        resText += `🏦 *AHORRO/DEUDAS (20%): $${dist.ahorro_20.toFixed(2)}*`;

        // Mandamos la imagen y el texto como pie de foto
        await enviarImagen(chatId, urlImagen, resText);
      }
    }
    else if (data === 'btn_borrar_todo') {
      await borrarHistorial(chatId);
      await enviarMensaje(chatId, "🧹 ¡Hecho, chucho! Toda tu base de datos fue formateada exitosamente.");
    }

    // B. MANEJO DE BOTONES DE SELECCIÓN (NUEVO)
    
    // Selección de Quincena (Flujo Gasto Fijo)
    else if (data.startsWith('set_quin_')) {
      const partes = data.split('_'); // set_quin_1_Costo_35.5
      const quincena = parseInt(partes[2]);
      const costo = parseFloat(partes[4]);
      const nombre = data.split('paga_')[1].split('_costo')[0]; // Extraer nombre del data string

      await guardarGastoFijo(chatId, nombre, costo, quincena);
      
      // Borrar el mensaje de los botones para no hacer spam
      await fetch(`https://api.telegram.org/bot${telegramToken}/deleteMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId })
      });
      
      await enviarMensaje(chatId, `✅ ¡Uf, perrito! Gasto fijo "${nombre}" guardado para la Quincena ${quincena}. UVA.`);
    }

    // Selección de Categoría (Flujo Gasto Diario)
    else if (data.startsWith('set_cat_')) {
      const partes = data.split('_'); // set_cat_NECESIDAD_monto_10.5
      const categoria = partes[2];
      const monto = parseFloat(partes[4]);
      
      await guardarGastoVariable(chatId, monto, categoria, mesActual, quincenaActual);
      
      // Borrar mensaje de botones
      await fetch(`https://api.telegram.org/bot${telegramToken}/deleteMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId })
      });

      const emoji = categoria === 'DESEO' ? '🎉' : '🛑';
      await enviarMensaje(chatId, `✅ ${emoji} Gasto diario de $${monto.toFixed(2)} restado de tu cuenta de ${categoria}.`);
    }

    // Quitar el relojito de carga
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
                    `Toca en 'Resumen' para ver el gráfico UVA.`;
        await enviarMensaje(chatId, msj);
      } else {
        await enviarMensaje(chatId, "⚠️ Ingresa un número válido y mayor a cero, maje.");
      }
      return res.status(200).send('OK');
    }

    // B. GASTOS FIJOS (Flujo con botones al final)
    if (textoRespondido.includes("📝 Ingresa el NOMBRE del gasto fijo")) {
      await enviarMensaje(chatId, `💸 Ingresa el COSTO mensual de "${texto}" (solo números):`, { force_reply: true });
      return res.status(200).send('OK');
    }
    if (textoRespondido.includes("💸 Ingresa el COSTO mensual de")) {
      const match = textoRespondido.match(/"([^"]+)"/);
      const nombreGasto = match ? match[1] : "Gasto";
      const costo = parseFloat(texto);
      if (!isNaN(costo) && costo > 0) {
        // !!! AQUÍ ESTÁ EL CAMBIO A BOTONES UVA !!!
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

    // C. GASTOS DIARIOS (Flujo con botones al final)
    if (textoRespondido.includes("🛒 Ingresa el monto del gasto diario")) {
      const monto = parseFloat(texto);
      if (!isNaN(monto) && monto > 0) {
        // !!! AQUÍ ESTÁ EL CAMBIO A BOTONES UVA !!!
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
          [{ text: '📊 Ver Resumen UVA', callback_data: 'btn_ver_resumen' }],
          [{ text: '💰 Ingreso', callback_data: 'btn_ingreso' }, { text: '➕ Gasto Fijo', callback_data: 'btn_gasto' }],
          [{ text: '🛒 Gasto Diario', callback_data: 'btn_gasto_diario' }, { text: '🗑️ Borrar Todo', callback_data: 'btn_borrar_todo' }]
        ]
      };
      await enviarMensaje(chatId, `¿Qué ondas, chucho? Estamos en la *Quincena ${quincenaActual}* del *Mes ${mesActual}*.\n¿Qué toca hacer hoy para que rinda la ficha?`, menuBotones);
    }
  }

  return res.status(200).send('OK');
}

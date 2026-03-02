import { 
  enviarMensaje, guardarIngreso, obtenerUltimoIngreso, borrarHistorial, 
  obtenerGastosFijosTodos, obtenerGastosFijosQuincena, guardarGastoFijo, 
  guardarGastoVariable, obtenerGastosVariables, obtenerFechaSV 
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
    const data = body.callback_query.data;

    if (data === 'btn_ingreso') {
      const gastos = await obtenerGastosFijosTodos(chatId);
      if (!gastos || gastos.length === 0) {
        await enviarMensaje(chatId, "⚠️ Pérate maje. Antes de registrar ingresos, tenés que registrar al menos un Gasto Fijo.\n\n📝 Ingresa el NOMBRE del gasto fijo:", { force_reply: true });
      } else {
        await enviarMensaje(chatId, "💰 Ingresa el monto de tu ingreso (solo números):", { force_reply: true });
      }
    } 
    else if (data === 'btn_gasto') {
      await enviarMensaje(chatId, "📝 Ingresa el NOMBRE del gasto fijo:", { force_reply: true });
    }
    else if (data === 'btn_gasto_diario') {
      await enviarMensaje(chatId, "🛒 Ingresa el monto del gasto diario (ej: 5.50):", { force_reply: true });
    }
    else if (data === 'btn_ver_resumen') {
      // LÓGICA DEL RESUMEN MAESTRO
      const ingresoArr = await obtenerUltimoIngreso(chatId, mesActual, quincenaActual);
      if (!ingresoArr || ingresoArr.length === 0) {
        await enviarMensaje(chatId, "No has registrado ningún ingreso para esta quincena. Toca en 'Ingreso' primero.");
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

        const disponibleNec = dist.necesidades_50 - totalFijos - gastadoNec;
        const disponibleDes = dist.deseos_30 - gastadoDes;

        let resText = `📊 *RESUMEN: MES ${mesActual} | QUINCENA ${quincenaActual}*\n`;
        resText += `💰 Ingreso Total: $${ing.monto_ingreso}\n\n`;
        
        resText += `🛒 *NECESIDADES (50%): $${dist.necesidades_50.toFixed(2)}*\n`;
        resText += `   - Fijos de quincena: -$${totalFijos.toFixed(2)}\n`;
        resText += `   - Gastos diarios: -$${gastadoNec.toFixed(2)}\n`;
        resText += `   >> *Disponible:* $${disponibleNec.toFixed(2)}\n\n`;

        resText += `🎉 *DESEOS (30%): $${dist.deseos_30.toFixed(2)}*\n`;
        resText += `   - Gastado: -$${gastadoDes.toFixed(2)}\n`;
        resText += `   >> *Disponible:* $${disponibleDes.toFixed(2)}\n\n`;

        resText += `🏦 *AHORRO/DEUDAS (20%): $${dist.ahorro_20.toFixed(2)}* (Intocable)`;

        await enviarMensaje(chatId, resText);
      }
    }
    else if (data === 'btn_borrar_todo') {
      await borrarHistorial(chatId);
      await enviarMensaje(chatId, "🧹 ¡Hecho, chucho! Toda tu base de datos fue formateada.");
    }

    await fetch(`https://api.telegram.org/bot${telegramToken}/answerCallbackQuery`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callback_query_id: body.callback_query.id })
    });
    return res.status(200).send('OK');
  }

  // -----------------------------------------------------
  // 2. MANEJO DE MENSAJES DE TEXTO (Cadenas)
  // -----------------------------------------------------
  if (body.message && body.message.text) {
    const chatId = body.message.chat.id;
    const texto = body.message.text.trim();
    const textoRespondido = body.message.reply_to_message ? body.message.reply_to_message.text : "";

    // A. INGRESOS
    if (textoRespondido.includes("💰 Ingresa el monto de tu ingreso")) {
      const monto = parseFloat(texto);
      if (!isNaN(monto)) {
        // Cálculo inicial 50-30-20
        const dist = { necesidades_50: monto * 0.5, deseos_30: monto * 0.3, ahorro_20: monto * 0.2 };
        await guardarIngreso(chatId, monto, dist, mesActual, quincenaActual);
        
        const fijos = await obtenerGastosFijosQuincena(chatId, quincenaActual);
        const totalFijos = fijos.reduce((sum, g) => sum + g.monto, 0);
        const libreNec = dist.necesidades_50 - totalFijos;

        const msj = `¡Nítido! Ingreso guardado para Quincena ${quincenaActual}.\n\n` +
                    `📊 *Tu 50% de Necesidades es: $${dist.necesidades_50.toFixed(2)}*\n` +
                    `Se apartaron $${totalFijos.toFixed(2)} para gastos fijos.\n` +
                    `Te quedan *$${libreNec.toFixed(2)}* para sobrevivir la quincena.\n\n` +
                    `Toca en 'Resumen' para ver el cuadro completo.`;
        await enviarMensaje(chatId, msj);
      }
      return res.status(200).send('OK');
    }

    // B. GASTOS FIJOS (Cadena de 3 pasos)
    if (textoRespondido.includes("📝 Ingresa el NOMBRE del gasto fijo")) {
      await enviarMensaje(chatId, `💸 Ingresa el COSTO de "${texto}":`, { force_reply: true });
      return res.status(200).send('OK');
    }
    if (textoRespondido.includes("💸 Ingresa el COSTO de")) {
      const match = textoRespondido.match(/"([^"]+)"/);
      const nombreGasto = match ? match[1] : "Gasto";
      const costo = parseFloat(texto);
      if (!isNaN(costo)) {
        await enviarMensaje(chatId, `📅 ¿En qué QUINCENA se paga "${nombreGasto}" ($${costo})? Responde solo 1 o 2:`, { force_reply: true });
      }
      return res.status(200).send('OK');
    }
    if (textoRespondido.includes("📅 ¿En qué QUINCENA se paga")) {
      const match = textoRespondido.match(/paga "([^"]+)" \(\$([0-9.]+)\)\?/);
      if (match) {
        const nombre = match[1];
        const costo = parseFloat(match[2]);
        const quincena = parseInt(texto);
        if (quincena === 1 || quincena === 2) {
          await guardarGastoFijo(chatId, nombre, costo, quincena);
          await enviarMensaje(chatId, `✅ ¡Uf! Gasto fijo "${nombre}" guardado para la Quincena ${quincena}.`);
        } else {
          await enviarMensaje(chatId, "Maje, la quincena solo puede ser 1 o 2. Volvé a empezar desde el menú.");
        }
      }
      return res.status(200).send('OK');
    }

    // C. GASTOS DIARIOS (Cadena de 2 pasos)
    if (textoRespondido.includes("🛒 Ingresa el monto del gasto diario")) {
      const monto = parseFloat(texto);
      if (!isNaN(monto)) {
        await enviarMensaje(chatId, `🏷️ ¿El gasto de $${monto} fue Necesidad o Deseo? Responde N o D:`, { force_reply: true });
      }
      return res.status(200).send('OK');
    }
    if (textoRespondido.includes("🏷️ ¿El gasto de $")) {
      const match = textoRespondido.match(/\$([0-9.]+)/);
      const monto = match ? parseFloat(match[1]) : 0;
      const letra = texto.toUpperCase();
      const categoria = letra === 'D' ? 'DESEO' : 'NECESIDAD';
      
      await guardarGastoVariable(chatId, monto, categoria, mesActual, quincenaActual);
      await enviarMensaje(chatId, `✅ Gasto de $${monto} restado de tu cuenta de ${categoria}.`);
      return res.status(200).send('OK');
    }

    // D. MENU PRINCIPAL
    if (texto.startsWith('/start') || texto.startsWith('/menu')) {
      const menuBotones = {
        inline_keyboard: [
          [{ text: '💰 Ingreso', callback_data: 'btn_ingreso' }, { text: '📊 Resumen', callback_data: 'btn_ver_resumen' }],
          [{ text: '➕ Gasto Fijo', callback_data: 'btn_gasto' }, { text: '🛒 Gasto Diario', callback_data: 'btn_gasto_diario' }],
          [{ text: '🗑️ Borrar Todo', callback_data: 'btn_borrar_todo' }]
        ]
      };
      await enviarMensaje(chatId, `¿Qué ondas? Estamos en la *Quincena ${quincenaActual}* del *Mes ${mesActual}*. ¿Qué toca hacer hoy?`, menuBotones);
    }
  }

  return res.status(200).send('OK');
}

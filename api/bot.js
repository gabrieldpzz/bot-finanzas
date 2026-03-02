export default async function handler(req, res) {
  // Solo aceptamos peticiones POST que vienen de Telegram
  if (req.method === 'POST') {
    const mensaje = req.body.message;
    
    // Si no hay mensaje o texto, ignoramos
    if (!mensaje || !mensaje.text) {
      return res.status(200).send('OK');
    }

    const chatId = mensaje.chat.id;
    const texto = mensaje.text;
    const telegramToken = process.env.TELEGRAM_TOKEN;

    // Lógica básica de respuesta
    let respuesta = "";
    if (texto.startsWith('/start') || texto.startsWith('/menu')) {
      respuesta = "¡Qué onda! Bienvenido a tu Gestor 50-30-20. Escribe tu ingreso así: ingreso 500";
    } else if (texto.toLowerCase().startsWith('ingreso')) {
      // Extraemos el número que escribiste
      const monto = parseFloat(texto.split(' ')[1]);
      if (!isNaN(monto)) {
        respuesta = `¡Nítido! Registrando $${monto}... Ahorita me conecto a Supabase para calcular el 50-30-20.`;
        // Aquí meteremos la conexión a Supabase después
      } else {
        respuesta = "Formato incorrecto. Escribe por ejemplo: ingreso 500";
      }
    } else {
      respuesta = "No reconozco ese comando. Intenta con /menu o 'ingreso 500'.";
    }

    // Le respondemos a la API de Telegram usando fetch nativo
    const telegramUrl = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
    await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: respuesta
      })
    });

    // Siempre hay que responder con un 200 OK para que Telegram sepa que lo recibimos
    return res.status(200).send('OK');
  }

  // Si abres la URL en el navegador
  return res.status(200).send('El bot está vivo y respirando.');
}

import express from "express";
import {
  createAuthenticatedClient,
  OpenPaymentsClientError,
  isFinalizedGrant,
} from "@interledger/open-payments";

// --- CONFIGURACIÓN DEL SERVIDOR ---
const app = express();
const PORT = 8080; 
app.use(express.json());

// Configuración de CORS para permitir peticiones desde el frontend (modo desarrollo)
app.use((req, res, next) => {
  // Aceptar peticiones desde cualquier origen en desarrollo
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// --- ⚠ 1. CONFIGURACIÓN DE LLAVES ⚠ ---
// Rellena estas 4 variables con tus llaves de Rafiki

// 1. LLAVES DE 'clientea' (Para Tx 1: Cliente -> Seed-Pay)
const CLIENTEA_KEY_ID = "69eaa5f2-6b25-421a-a2dd-f337215bb709";
const CLIENTEA_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIJpwI9YDXOoi8TABa/e2XeWG9xcSMsL5soN9knnnkx2Z
-----END PRIVATE KEY-----`;

// 2. LLAVES DE 'seed-pay' (Para Tx 2: Seed-Pay -> Participantes)
const SEEDPAY_KEY_ID = "97255179-f2ca-4120-aa32-46af654bf47f"; // ID correcto de la wallet seed-pay
const SEEDPAY_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIEmAZ3mAy6eG/DCw6648gYsA51A+QXeF8UgkE7bp4+iH
-----END PRIVATE KEY-----`;


// --- "Base de datos" temporal ---
// Guarda el permiso pendiente entre las dos llamadas de la API
let permisoPendiente = null;


// =======================================================
// LÓGICA DE TRANSACCIÓN 2 (Seed-Pay -> Participantes)
// (Esta era la lógica de 'dispersar.js')
// =======================================================
/**
 * Inicia un pago automático (no-interactivo) desde la
 * wallet 'seed-pay' a un receptor (agricultor/transportista).
 */
async function pagarParticipante(monto, walletUrlReceptor, nombreReceptor) {
  console.log(`\n--- [TX 2] Iniciando pago de ${monto} a '${nombreReceptor}' ---`);
  console.log(`URL de wallet receptora: ${walletUrlReceptor}`);
  try {
    // 1. Crear cliente autenticado CON LLAVES DE SEED-PAY
    const client = await createAuthenticatedClient({
      walletAddressUrl: "https://ilp.interledger-test.dev/seed-pay",
      privateKey: SEEDPAY_PRIVATE_KEY,
      keyId: SEEDPAY_KEY_ID,
    });

    // Obtener información de las wallets
    console.log(`Obteniendo información de las wallets para la transferencia...`);
    const sendingWalletAddress = await client.walletAddress.get({ 
      url: "https://ilp.interledger-test.dev/seed-pay" 
    });
    console.log("Wallet emisora:", sendingWalletAddress);

    const receivingWalletAddress = await client.walletAddress.get({ 
      url: walletUrlReceptor 
    });
    console.log("Wallet receptora:", receivingWalletAddress);

    // 2. Crear 'factura' (incomingPayment) en el receptor
    const incomingPaymentGrant = await client.grant.request(
      { url: receivingWalletAddress.authServer },
      { access_token: { access: [{ type: "incoming-payment", actions: ["read", "complete", "create"] }] } }
    );
    const incomingPayment = await client.incomingPayment.create(
      { url: receivingWalletAddress.resourceServer, accessToken: incomingPaymentGrant.access_token.value },
      {
        walletAddress: receivingWalletAddress.id,
        incomingAmount: {
          assetCode: receivingWalletAddress.assetCode,
          assetScale: receivingWalletAddress.assetScale,
          value: monto,
        },
      }
    );

    // 3. Crear 'cotización' (quote) desde seed-pay
    const quoteGrant = await client.grant.request(
      { url: sendingWalletAddress.authServer },
      { access_token: { access: [{ type: "quote", actions: ["create", "read"] }] } }
    );
    const quote = await client.quote.create(
      { url: sendingWalletAddress.resourceServer, accessToken: quoteGrant.access_token.value },
      {
        walletAddress: sendingWalletAddress.id,
        receiver: incomingPayment.id,
        method: "ilp",
      }
    );

    // 4. Obtener permiso con interacción mínima
    console.log("Solicitando permiso para la transferencia...");
    console.log("Auth Server:", sendingWalletAddress.authServer);
    const outgoingPaymentGrant = await client.grant.request(
      { url: sendingWalletAddress.authServer },
      {
        access_token: {
          access: [
            {
              type: "outgoing-payment",
              actions: ["read", "create"],
              limits: { debitAmount: quote.debitAmount },
              identifier: sendingWalletAddress.id,
            },
          ],
        },
        interact: {
          start: ["redirect"],
        }
      }
    );
    console.log("Permiso obtenido:", outgoingPaymentGrant);

    if (nombreReceptor === 'agricultores') {
      console.log("\n🔵 LINK #2 - APROBAR PAGO A AGRICULTORES (90%):");
    } else {
      console.log("\n🔵 LINK #3 - APROBAR PAGO A TRANSPORTISTA (10%):");
    }
    console.log("============================================");
    console.log(outgoingPaymentGrant.interact.redirect);
    console.log("============================================");

    // Esperar la aprobación del usuario
    const finalizedGrant = await new Promise((resolve, reject) => {
      console.log(`\n⏳ Esperando que apruebes el pago a ${nombreReceptor}...`);
      const checkInterval = setInterval(async () => {
        try {
          const result = await client.grant.continue({
            url: outgoingPaymentGrant.continue.uri,
            accessToken: outgoingPaymentGrant.continue.access_token.value,
          });
          
          if (isFinalizedGrant(result)) {
            console.log(`Aprobación recibida para ${nombreReceptor}`);
            clearInterval(checkInterval);
            resolve(result);
          }
        } catch (error) {
          if (error.status !== 400) { // Ignoramos el error 400 que es normal mientras esperamos
            console.error(`Error al verificar aprobación para ${nombreReceptor}:`, error);
          }
        }
      }, 2000); // Revisar cada 2 segundos
      
      // Timeout después de 5 minutos
      setTimeout(() => {
        clearInterval(checkInterval);
        throw new Error('Tiempo de espera agotado para la aprobación');
      }, 300000);
    });

    if (!finalizedGrant || !isFinalizedGrant(finalizedGrant)) {
      throw new Error('No se pudo obtener el permiso finalizado');
    }

    // 5. ¡PAGAR! (con el permiso ya aprobado)
    const outgoingPayment = await client.outgoingPayment.create(
      { url: sendingWalletAddress.resourceServer, accessToken: finalizedGrant.access_token.value },
      { walletAddress: sendingWalletAddress.id, quoteId: quote.id }
    );

    console.log(`✅ ¡ÉXITO [TX 2]! SEED-PAY pagó a ${nombreReceptor}.`);
    return outgoingPayment;

  } catch (error) {
    console.error(`\n❌ ERROR en [TX 2] pagando a ${nombreReceptor}:`);
    if (error instanceof OpenPaymentsClientError) {
      console.error("OpenPayments Error:", {
        description: error.description,
        status: error.status,
        code: error.code,
        validationErrors: error.validationErrors,
        details: error.details
      });
    } else {
      console.error("Error completo:", error);
    }
  }
}


// =======================================================
// ENDPOINTS DE LA API (Lógica de Transacción 1)
// =======================================================

/**
 * ENDPOINT 1: Iniciar el pago.
 * El Frontend (React) llama a esta ruta.
 * Devuelve una URL para que el usuario apruebe el pago.
 */
app.get("/api/iniciar-pago", async (req, res) => {
  try {
    console.log("\n\n--- [API] /api/iniciar-pago RECIBIDO ---");
    const { monto } = req.query; // Recibir el monto como query parameter
    if (!monto) {
      return res.status(400).json({ error: "Se requiere especificar el monto del pago" });
    }
    
    // Convertir el monto a centavos (multiplicar por 100)
    const montoEnCentavos = (parseFloat(monto) * 100).toString();
    console.log(`Monto recibido: ${monto} (en centavos: ${montoEnCentavos})`);
    
    // Usaremos montoEnCentavos para la transacción

    // 1. Crear cliente CON LLAVES DE CLIENTEA
    const client = await createAuthenticatedClient({
      walletAddressUrl: "https://ilp.interledger-test.dev/clientea",
      privateKey: CLIENTEA_PRIVATE_KEY,
      keyId: CLIENTEA_KEY_ID,
    });

    const [sendingWalletAddress, receivingWalletAddress] = await Promise.all([
      client.walletAddress.get({ url: "https://ilp.interledger-test.dev/clientea" }),
      client.walletAddress.get({ url: "https://ilp.interledger-test.dev/seed-pay" }),
    ]);

    // 2. Pasos 2-5: Crear 'factura' (incomingPayment) y 'cotización' (quote)
    const incomingPaymentGrant = await client.grant.request(
      { url: receivingWalletAddress.authServer },
      { access_token: { access: [{ type: "incoming-payment", actions: ["read", "complete", "create"] }] } }
    );
    const incomingPayment = await client.incomingPayment.create(
      { url: receivingWalletAddress.resourceServer, accessToken: incomingPaymentGrant.access_token.value },
      {
        walletAddress: receivingWalletAddress.id,
        incomingAmount: { value: montoEnCentavos, assetCode: receivingWalletAddress.assetCode, assetScale: receivingWalletAddress.assetScale },
      }
    );
    const quoteGrant = await client.grant.request(
      { url: sendingWalletAddress.authServer },
      { access_token: { access: [{ type: "quote", actions: ["create", "read"] }] } }
    );
    const quote = await client.quote.create(
      { url: sendingWalletAddress.resourceServer, accessToken: quoteGrant.access_token.value },
      { walletAddress: sendingWalletAddress.id, receiver: incomingPayment.id, method: "ilp" }
    );
    console.log("[TX 1] Factura y cotización creadas.");

    // 3. Paso 6: Obtener permiso INTERACTIVO
    const outgoingPaymentGrant = await client.grant.request(
      { url: sendingWalletAddress.authServer },
      {
        access_token: { access: [{ type: "outgoing-payment", actions: ["read", "create"], limits: { debitAmount: quote.debitAmount }, identifier: sendingWalletAddress.id }] },
        interact: { start: ["redirect"] },
      }
    );

    // 4. Guardar información para el siguiente endpoint
    permisoPendiente = {
      continueUri: outgoingPaymentGrant.continue.uri,
      accessToken: outgoingPaymentGrant.continue.access_token.value,
      quoteId: quote.id,
      montoTotal: monto,
      client: client, // Guardamos el cliente de 'clientea'
      sendingWalletAddress: sendingWalletAddress,
    };

    console.log("\n🔵 LINK #1 - APROBAR PAGO INICIAL:");
    console.log("============================================");
    console.log(outgoingPaymentGrant.interact.redirect);
    console.log("============================================");
    console.log("1. Copia este link");
    console.log("2. Aprueba el pago");
    console.log("3. Después visita: http://localhost:8080/api/finalizar-pago\n");
    
    // 5. Devolver la URL de aprobación al Frontend (React)
    res.json({ approvalUrl: outgoingPaymentGrant.interact.redirect });

  } catch (error) {
    console.error("\n--- ❌ ERROR en /api/iniciar-pago ---", error);
    res.status(500).json({ error: "Error al iniciar el pago" });
  }
});


/**
 * ENDPOINT 2: Finalizar el pago.
 * El Frontend (React) llama a esta ruta DESPUÉS de que el usuario
 * aprobó el pago en la URL del paso anterior.
 */
// Variable para controlar el flujo de pagos
let autorizarSiguientePago = false;

// Endpoint para autorizar el siguiente pago
app.get("/api/autorizar-siguiente", (req, res) => {
  autorizarSiguientePago = true;
  console.log("\n🔄 Sistema listo para procesar el siguiente pago");
  res.json({ message: "Sistema listo para el siguiente pago" });
});

// Endpoint para verificar el estado
app.get("/api/estado", (req, res) => {
  res.json({ 
    esperandoAutorizacion: !autorizarSiguientePago,
    hayPagoPendiente: !!permisoPendiente
  });
});

app.get("/api/finalizar-pago", async (req, res) => {
  try {
    console.log("\n\n--- [API] /api/finalizar-pago RECIBIDO ---");

    if (!permisoPendiente) {
      console.log("Error: No hay ningún pago pendiente de finalizar.");
      return res.status(400).json({ error: "No hay ningún pago pendiente de finalizar." });
    }

    if (!autorizarSiguientePago) {
      console.log("\n⏸️ Esperando autorización para continuar...");
      console.log("Visita http://localhost:8080/api/autorizar-siguiente cuando estés listo");
      return res.json({ 
        status: "waiting",
        message: "Esperando autorización para continuar. Use /api/autorizar-siguiente cuando esté listo."
      });
    }

    // Resetear la autorización para el siguiente pago
    autorizarSiguientePago = false;

    // 1. Recuperar la información de la Tx 1
    const { continueUri, accessToken, quoteId, client, sendingWalletAddress, montoTotal } = permisoPendiente;
    permisoPendiente = null; // Limpiamos la variable

    // 2. Paso 7 (Tx 1): Continuar permiso con cliente 'clientea'
    const finalizedGrant = await client.grant.continue({ url: continueUri, accessToken: accessToken });

    if (!isFinalizedGrant(finalizedGrant)) {
      return res.status(400).json({ error: "El permiso no fue finalizado" });
    }
    console.log("[TX 1] Permiso de pago finalizado (CLIENTEA aprobó)");

    // 3. Paso 8 (Tx 1): ¡PAGAR! (clientea -> seed-pay)
    const outgoingPayment = await client.outgoingPayment.create(
      { url: sendingWalletAddress.resourceServer, accessToken: finalizedGrant.access_token.value },
      { walletAddress: sendingWalletAddress.id, quoteId: quoteId }
    );

    console.log("\n✅ ¡ÉXITO [TX 1]! Pago Creado. Fondos en camino de CLIENTEA a SEED-PAY.");
    
    // 4. ¡CONECTAR TRANSACCIÓN 2!
    // Iniciar la dispersión de fondos desde 'seed-pay'
    
    // Calcular montos (80% agricultor, 20% transportista) - convertir a centavos
    const montoNum = parseInt(montoTotal, 10) * 100; // Convertir a centavos
    const montoTransportista = Math.floor(montoNum * 0.2).toString(); // 20% para transportista (en centavos)
    const montoAgricultor = (montoNum - parseInt(montoTransportista, 10)).toString(); // Resto para agricultor (en centavos)
    console.log(`Montos en centavos - Total: ${montoNum}, Agricultor: ${montoAgricultor}, Transportista: ${montoTransportista}`);

    console.log(`Dispersando ${montoTotal}: ${montoAgricultor} (Agric.) y ${montoTransportista} (Transp.)`);
    
    // 4. PREPARAR DISPERSIÓN EN PASOS (no ejecutar automáticamente)
    // Guardamos los montos y el estado en memoria para que el frontend
    // pueda iniciar los pagos a los participantes uno por uno.
    let pendingDispersal = {
      montoTotal: montoTotal,
      agricultor: { amount: montoAgricultor, url: "https://ilp.interledger-test.dev/agricultores", status: 'pending' },
      transportista: { amount: montoTransportista, url: "https://ilp.interledger-test.dev/transportista", status: 'pending' }
    };

    // Estado de la dispersión global
    // Valores: 'idle' | 'pending' | 'agricultor_initiated' | 'agricultor_completed' | 'transportista_initiated' | 'transportista_completed'
    let dispersalState = 'pending';

    // Almacén temporal para guardar grants pendientes creados por seed-pay
    const pendingParticipantGrants = {};

    // Función para iniciar (crear quote + outgoingPaymentGrant) para un participante
    async function iniciarPagoParticipante(monto, walletUrlReceptor, nombreReceptor) {
      console.log(`\n--- [TX 2] (INIT) Preparando pago de ${monto} a '${nombreReceptor}' ---`);
      const client = await createAuthenticatedClient({
        walletAddressUrl: "https://ilp.interledger-test.dev/seed-pay",
        privateKey: SEEDPAY_PRIVATE_KEY,
        keyId: SEEDPAY_KEY_ID,
      });

      const sendingWalletAddress = await client.walletAddress.get({ url: "https://ilp.interledger-test.dev/seed-pay" });
      const receivingWalletAddress = await client.walletAddress.get({ url: walletUrlReceptor });

      // Crear incomingPayment en el receptor
      const incomingPaymentGrant = await client.grant.request(
        { url: receivingWalletAddress.authServer },
        { access_token: { access: [{ type: "incoming-payment", actions: ["read", "complete", "create"] }] } }
      );
      const incomingPayment = await client.incomingPayment.create(
        { url: receivingWalletAddress.resourceServer, accessToken: incomingPaymentGrant.access_token.value },
        { walletAddress: receivingWalletAddress.id, incomingAmount: { assetCode: receivingWalletAddress.assetCode, assetScale: receivingWalletAddress.assetScale, value: monto } }
      );

      // Crear quote desde seed-pay
      const quoteGrant = await client.grant.request(
        { url: sendingWalletAddress.authServer },
        { access_token: { access: [{ type: "quote", actions: ["create", "read"] }] } }
      );
      const quote = await client.quote.create(
        { url: sendingWalletAddress.resourceServer, accessToken: quoteGrant.access_token.value },
        { walletAddress: sendingWalletAddress.id, receiver: incomingPayment.id, method: "ilp" }
      );

      // Solicitar permiso interactivo (se devolverá el link de aprobación)
      const outgoingPaymentGrant = await client.grant.request(
        { url: sendingWalletAddress.authServer },
        {
          access_token: {
            access: [ { type: "outgoing-payment", actions: ["read", "create"], limits: { debitAmount: quote.debitAmount }, identifier: sendingWalletAddress.id } ]
          },
          interact: { start: ["redirect"] }
        }
      );

      // Guardar la info para completarlo después
      pendingParticipantGrants[nombreReceptor] = {
        client,
        sendingWalletAddress,
        quoteId: quote.id,
        continueUri: outgoingPaymentGrant.continue.uri,
        continueAccessToken: outgoingPaymentGrant.continue.access_token.value,
        interactRedirect: outgoingPaymentGrant.interact.redirect,
      };

      console.log(`🔵 LINK para ${nombreReceptor}:`);
      console.log(outgoingPaymentGrant.interact.redirect);

      return { approvalUrl: outgoingPaymentGrant.interact.redirect };
    }

    // Función para completar el pago de un participante después de la aprobación
    async function completarPagoParticipante(nombreReceptor) {
      const entry = pendingParticipantGrants[nombreReceptor];
      if (!entry) throw new Error('No hay un pago iniciado para ' + nombreReceptor);

      const result = await entry.client.grant.continue({ url: entry.continueUri, accessToken: entry.continueAccessToken });
      if (!isFinalizedGrant(result)) throw new Error('El permiso no fue finalizado para ' + nombreReceptor);

      const outgoingPayment = await entry.client.outgoingPayment.create(
        { url: entry.sendingWalletAddress.resourceServer, accessToken: result.access_token.value },
        { walletAddress: entry.sendingWalletAddress.id, quoteId: entry.quoteId }
      );

      // Borrar entry
      delete pendingParticipantGrants[nombreReceptor];
      return outgoingPayment;
    }

    // Guardar en app.locals para que otros endpoints puedan acceder
    app.locals.pendingDispersal = pendingDispersal;
    app.locals.pendingParticipantGrants = pendingParticipantGrants;
    app.locals.dispersalState = dispersalState;
    app.locals.completarPagoParticipante = completarPagoParticipante;
    app.locals.iniciarPagoParticipante = iniciarPagoParticipante;

    // 5. Devolver el éxito de la Tx 1 al Frontend (React) indicando que ahora
    // la dispersión está preparada y puede iniciarse paso a paso.
    res.json({
      success: true,
      message: "¡Pago completado! La dispersión está lista para ejecutarse por pasos.",
      paymentId: outgoingPayment.id,
      dispersal: pendingDispersal
    });

  // Endpoint: iniciar pago a agricultores (crea link de aprobación)
  app.get('/api/pagar-agricultores/init', async (req, res) => {
    try {
      const pd = app.locals.pendingDispersal;
      if (!pd) return res.status(400).json({ error: 'No hay una dispersión preparada. Ejecuta /api/finalizar-pago primero.' });
      // Iniciar el pago (crea quote y outgoingPaymentGrant, devuelve approvalUrl)
      const result = await app.locals.iniciarPagoParticipante(pd.agricultor.amount, pd.agricultor.url, 'agricultores');
      app.locals.dispersalState = 'agricultor_initiated';
      return res.json({ approvalUrl: result.approvalUrl });
    } catch (err) {
      console.error('Error iniciando pago a agricultores:', err);
      return res.status(500).json({ error: err.message || String(err) });
    }
  });

  // Endpoint: completar pago a agricultores (llamar después de aprobar el link)
  app.get('/api/pagar-agricultores/complete', async (req, res) => {
    try {
      if (!app.locals.pendingDispersal) return res.status(400).json({ error: 'No hay una dispersión preparada.' });
      const outgoing = await app.locals.completarPagoParticipante('agricultores');
      app.locals.dispersalState = 'agricultor_completed';
      return res.json({ success: true, outgoingPayment: outgoing });
    } catch (err) {
      console.error('Error completando pago a agricultores:', err);
      return res.status(500).json({ error: err.message || String(err) });
    }
  });

  // Endpoint: iniciar pago a transportista (crea link de aprobación)
  app.get('/api/pagar-transportista/init', async (req, res) => {
    try {
      const pd = app.locals.pendingDispersal;
      if (!pd) return res.status(400).json({ error: 'No hay una dispersión preparada. Ejecuta /api/finalizar-pago primero.' });
      if (app.locals.dispersalState !== 'agricultor_completed') return res.status(400).json({ error: 'Debe completar el pago a agricultores primero.' });
      const result = await app.locals.iniciarPagoParticipante(pd.transportista.amount, pd.transportista.url, 'transportista');
      app.locals.dispersalState = 'transportista_initiated';
      return res.json({ approvalUrl: result.approvalUrl });
    } catch (err) {
      console.error('Error iniciando pago a transportista:', err);
      return res.status(500).json({ error: err.message || String(err) });
    }
  });

  // Endpoint: completar pago a transportista
  app.get('/api/pagar-transportista/complete', async (req, res) => {
    try {
      if (!app.locals.pendingDispersal) return res.status(400).json({ error: 'No hay una dispersión preparada.' });
      const outgoing = await app.locals.completarPagoParticipante('transportista');
      app.locals.dispersalState = 'transportista_completed';
      return res.json({ success: true, outgoingPayment: outgoing });
    } catch (err) {
      console.error('Error completando pago a transportista:', err);
      return res.status(500).json({ error: err.message || String(err) });
    }
  });

  } catch (error) {
    console.error("\n\n--- ❌ ERROR en /api/finalizar-pago ---", error);
    res.status(500).json({ error: "Error al finalizar el pago" });
  }
});


// --- INICIAR SERVIDOR ---
app.listen(PORT, () => {
  console.clear(); // Limpia la consola
  console.log("\n==============================================");
  console.log("🌱 SERVIDOR SEEDPAY - SISTEMA DE PAGOS");
  console.log("==============================================\n");
  console.log("INSTRUCCIONES:");
  console.log("1. Visita este link para iniciar:"); 
  console.log("   ➜ http://localhost:8080/api/iniciar-pago");
  console.log("\n2. Cuando aparezca el LINK #1:");
  console.log("   - Cópialo y ábrelo en tu navegador");
  console.log("   - Aprueba el pago");
  console.log("   - Regresa y visita /api/finalizar-pago");
  console.log("\n3. Cuando aparezcan LINK #2 y #3:");
  console.log("   - Aprueba ambos links para completar");
  console.log("==============================================\n");
});
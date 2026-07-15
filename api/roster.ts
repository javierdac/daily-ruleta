// Vercel Function (Web standard Request/Response).
//
// Recibe el token SSO del usuario en Teams, lo intercambia por un token de
// Microsoft Graph con el flujo On-Behalf-Of (OBO), y devuelve los miembros del
// chat de la reunión.
//
// Variables de entorno requeridas (Vercel → Settings → Environment Variables):
//   AAD_TENANT_ID     - Directory (tenant) ID de Azure AD
//   AAD_CLIENT_ID     - Application (client) ID de la app registrada
//   AAD_CLIENT_SECRET - Client secret de esa app
//
// Permiso delegado que la app debe tener consentido en Azure: ChatMember.Read

const GRAPH_SCOPE = "https://graph.microsoft.com/ChatMember.Read";

export default async function handler(req: Request): Promise<Response> {
  const cors: Record<string, string> = {
    "Access-Control-Allow-Origin": req.headers.get("origin") ?? "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
    Vary: "Origin",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== "GET") {
    return json({ error: "Método no permitido" }, 405, cors);
  }

  const url = new URL(req.url);
  const chatId = url.searchParams.get("chatId");
  const ssoToken = (req.headers.get("authorization") ?? "").replace(
    /^Bearer\s+/i,
    "",
  );

  if (!chatId || !ssoToken) {
    return json({ error: "Falta chatId o token SSO" }, 400, cors);
  }

  const tenant = process.env.AAD_TENANT_ID;
  const clientId = process.env.AAD_CLIENT_ID;
  const clientSecret = process.env.AAD_CLIENT_SECRET;
  if (!tenant || !clientId || !clientSecret) {
    return json({ error: "Backend sin configurar (faltan AAD_*)" }, 500, cors);
  }

  // 1) On-Behalf-Of: cambiar el token SSO por uno de Graph.
  let graphToken: string;
  try {
    const params = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      client_id: clientId,
      client_secret: clientSecret,
      assertion: ssoToken,
      scope: GRAPH_SCOPE,
      requested_token_use: "on_behalf_of",
    });
    const r = await fetch(
      `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
      },
    );
    const data: any = await r.json();
    if (!r.ok) {
      // Suele ser consentimiento faltante (invalid_grant / consent_required).
      return json({ error: "Fallo OBO", detail: data }, 502, cors);
    }
    graphToken = data.access_token;
  } catch (e) {
    return json({ error: "Error en OBO", detail: String(e) }, 502, cors);
  }

  // 2) Leer los miembros del chat de la reunión.
  try {
    const r = await fetch(
      `https://graph.microsoft.com/v1.0/chats/${encodeURIComponent(
        chatId,
      )}/members`,
      { headers: { Authorization: `Bearer ${graphToken}` } },
    );
    const data: any = await r.json();
    if (!r.ok) {
      return json({ error: "Fallo Graph", detail: data }, 502, cors);
    }

    const participants = (data.value ?? [])
      .map((m: any) => ({
        id: m.userId || m.id,
        name: m.displayName || m.email || "",
        isHost: Array.isArray(m.roles) && m.roles.includes("owner"),
      }))
      .filter((p: { name: string }) => p.name.length > 0);

    return json({ participants }, 200, cors);
  } catch (e) {
    return json({ error: "Error en Graph", detail: String(e) }, 502, cors);
  }
}

function json(
  body: unknown,
  status: number,
  headers: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

// Vercel Function (firma Node.js: req, res).
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

interface Req {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
}
interface Res {
  setHeader(name: string, value: string): void;
  status(code: number): Res;
  json(body: unknown): void;
  end(): void;
}

export default async function handler(req: Req, res: Res): Promise<void> {
  const origin = pick(req.headers.origin) ?? "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "Método no permitido" });
    return;
  }

  const chatId = pick(req.query.chatId);
  const ssoToken = (pick(req.headers.authorization) ?? "").replace(
    /^Bearer\s+/i,
    "",
  );

  if (!chatId || !ssoToken) {
    res.status(400).json({ error: "Falta chatId o token SSO" });
    return;
  }

  const tenant = process.env.AAD_TENANT_ID;
  const clientId = process.env.AAD_CLIENT_ID;
  const clientSecret = process.env.AAD_CLIENT_SECRET;
  if (!tenant || !clientId || !clientSecret) {
    res.status(500).json({ error: "Backend sin configurar (faltan AAD_*)" });
    return;
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
    const data = (await r.json()) as { access_token?: string };
    if (!r.ok || !data.access_token) {
      // Suele ser consentimiento faltante (invalid_grant / consent_required).
      res.status(502).json({ error: "Fallo OBO", detail: data });
      return;
    }
    graphToken = data.access_token;
  } catch (e) {
    res.status(502).json({ error: "Error en OBO", detail: String(e) });
    return;
  }

  // 2) Leer los miembros del chat de la reunión.
  try {
    const r = await fetch(
      `https://graph.microsoft.com/v1.0/chats/${encodeURIComponent(
        chatId,
      )}/members`,
      { headers: { Authorization: `Bearer ${graphToken}` } },
    );
    const data = (await r.json()) as {
      value?: Array<{
        id?: string;
        userId?: string;
        displayName?: string;
        email?: string;
        roles?: string[];
      }>;
      error?: unknown;
    };
    if (!r.ok) {
      res.status(502).json({ error: "Fallo Graph", detail: data });
      return;
    }

    const participants = (data.value ?? [])
      .map((m) => ({
        id: m.userId || m.id || "",
        name: m.displayName || m.email || "",
        isHost: Array.isArray(m.roles) && m.roles.includes("owner"),
      }))
      .filter((p) => p.name.length > 0);

    res.status(200).json({ participants });
  } catch (e) {
    res.status(502).json({ error: "Error en Graph", detail: String(e) });
  }
}

function pick(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

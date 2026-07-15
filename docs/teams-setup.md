# Integración con Microsoft Teams (Meeting app)

La ruleta corre como **app de reunión** en el side panel de Teams. La lista de la
ruleta se toma de los **miembros del chat de la reunión** (tu equipo del daily),
leídos desde Microsoft Graph con **SSO delegado + On-Behalf-Of (OBO)**.

## Cómo fluye

```
Teams client ──SSO token──► app (ruleta) ──Bearer──► /api/roster (Vercel)
                                                        │ OBO
                                                        ▼
                                          Microsoft Graph  GET /chats/{chatId}/members
```

## 1. Registrar la app en Azure AD

1. portal.azure.com → **App registrations** → *New registration*.
2. Anotá **Application (client) ID** y **Directory (tenant) ID**.
3. **Expose an API**:
   - *Application ID URI*: `api://TU-DOMINIO/APP_ID`
     (ej: `api://ruleta.vercel.app/00000000-...`).
   - *Add a scope*: nombre `access_as_user`, admin+user consent.
   - En *Authorized client applications* agregá los client IDs de Teams:
     - `1fec8e78-bce4-4aaf-ab1b-5451cc387264` (Teams desktop/mobile)
     - `5e3ce6c0-2b1f-4285-8d4b-75ee78787346` (Teams web)
4. **API permissions** → *Add* → Microsoft Graph → *Delegated* → **ChatMember.Read**
   → *Grant admin consent* (o dejá que cada usuario consienta la primera vez).
5. **Certificates & secrets** → *New client secret* → guardá el valor para `AAD_CLIENT_SECRET`.
6. **Authentication** → agregá plataforma *Single-page application* con redirect
   `https://TU-DOMINIO/` (para el token SSO).

## 2. Configurar el backend (Vercel)

En Vercel → tu proyecto → *Settings → Environment Variables*, cargá:

```
AAD_TENANT_ID=<Directory (tenant) ID>
AAD_CLIENT_ID=<Application (client) ID>
AAD_CLIENT_SECRET=<client secret>
```

El endpoint `/api/roster` (código en `api/roster.ts`) ya hace el OBO y llama a
Graph. La app lo usa por defecto en `/api/roster` (mismo deploy).

## 3. Manifiesto de Teams

Editá `teams-app/manifest.json` reemplazando:
- `TU-DOMINIO` → tu dominio (ej. `ruleta.vercel.app`).
- `REEMPLAZAR-CON-GUID-DE-AZURE-AD` → el Application (client) ID (aparece en `id` y
  en `webApplicationInfo.id`).
- `webApplicationInfo.resource` queda como `api://TU-DOMINIO/APP_ID`.

Empaquetá con los íconos y subilo:

```bash
cd teams-app
zip ../ruleta-teams.zip manifest.json color.png outline.png
# Teams → Apps → Manage your apps → Upload a custom app → subí el zip
```

(`color.png` 192×192 y `outline.png` 32×32 transparente).

## 4. Usar

En una reunión de Teams: **+ Apps** → agregá "Ruleta Daily" al side panel. La
primera vez puede pedir consentimiento; luego la ruleta se llena sola con los
miembros del chat.

## Local dev

`npm run dev` (Vite) **no** sirve `/api/*`. Para probar el backend localmente usá
`vercel dev` y exponé por HTTPS con un túnel (`ngrok`/`cloudflared`), poniendo esa
URL en `configurationUrl` y `validDomains` del manifiesto.

## Troubleshooting

- **La ruleta muestra solo tu nombre** → el backend no devolvió miembros: revisá
  las env vars `AAD_*`, el consentimiento de `ChatMember.Read`, y que el error de
  `/api/roster` (campo `detail`) no sea `consent_required`.
- **Error de audiencia en el token** → revisá que `webApplicationInfo.resource` y el
  *Application ID URI* coincidan exactamente (`api://TU-DOMINIO/APP_ID`).

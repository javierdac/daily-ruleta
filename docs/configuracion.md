# Configuración en Zoom y Teams

Guía concreta para dejar la ruleta andando dentro de las reuniones, usando el
deploy actual:

- **App en vivo:** https://daily-ruleta-six.vercel.app
- **Dominio:** `daily-ruleta-six.vercel.app`

> Zoom y Teams no cargan el código: cargan esta **URL pública HTTPS** y la
> muestran embebida dentro de la reunión. Por eso primero hay que tener el deploy
> (ya está) y después registrar la URL en cada plataforma.

---

## 🔵 Zoom (no necesita backend)

Zoom entrega la lista de conectados con el SDK del cliente. No hace falta Azure.

1. **https://marketplace.zoom.us** → *Develop* → *Build App* → **General App**.
2. **Home URL** (Surface):
   ```
   https://daily-ruleta-six.vercel.app/?platform=zoom
   ```
3. **OAuth Redirect URL:** `https://daily-ruleta-six.vercel.app`
   **Domain allow list:** `daily-ruleta-six.vercel.app`
4. **Scopes:** `meeting:read`.
5. **Zoom App SDK → Add APIs** (exactamente las que usa `src/platform/zoom.ts`):
   - `getMeetingParticipants`
   - `getMeetingContext`
   - `getUserContext`
   - `onParticipantChange`
6. **Add the app to your account** (modo desarrollo). Abrí Zoom → iniciá una
   reunión → botón **Apps** → tu app. La ruleta se llena con los conectados.

Más detalle: [`zoom-setup.md`](zoom-setup.md).

---

## 🟣 Teams (necesita registro en Azure para leer el chat)

El navegador no puede leer la lista de participantes en Teams; la lee el backend
`/api/roster` vía Microsoft Graph (miembros del chat de la reunión), con SSO
delegado + On-Behalf-Of.

### a) Registrar la app en Azure AD

portal.azure.com → **App registrations** → *New registration*. Anotá el
**Application (client) ID** y el **Directory (tenant) ID**, y luego:

- **Expose an API**
  - *Application ID URI:* `api://daily-ruleta-six.vercel.app/<CLIENT_ID>`
  - *Add a scope:* `access_as_user` (admin + user).
  - *Authorized client applications:* agregá los IDs de Teams
    - `1fec8e78-bce4-4aaf-ab1b-5451cc387264`
    - `5e3ce6c0-2b1f-4285-8d4b-75ee78787346`
- **API permissions** → Microsoft Graph → *Delegated* → **ChatMember.Read**
  → *Grant admin consent*.
- **Certificates & secrets** → *New client secret* → guardá el valor.

### b) Variables de entorno en Vercel

Vercel → proyecto → *Settings → Environment Variables* (después *Redeploy*):

```
AAD_TENANT_ID=<Directory (tenant) ID>
AAD_CLIENT_ID=<Application (client) ID>
AAD_CLIENT_SECRET=<client secret>
```

### c) Manifiesto de Teams

`teams-app/manifest.json` ya tiene el dominio puesto. Solo reemplazá el GUID
`REEMPLAZAR-CON-GUID-DE-AZURE-AD` por tu **Application (client) ID** (aparece en
`id`, en `webApplicationInfo.id` y dentro de `resource`). Faltan los íconos
`color.png` (192×192) y `outline.png` (32×32 transparente) en `teams-app/`.

Empaquetá y subí:

```bash
cd teams-app
zip ../ruleta-teams.zip manifest.json color.png outline.png
# Teams → Apps → Manage your apps → Upload a custom app → subí el zip
```

En una reunión: **+ Apps** → agregá "Ruleta Daily" al panel lateral.

Más detalle y troubleshooting: [`teams-setup.md`](teams-setup.md).

---

## Comprobar que el backend está sano

```bash
curl -s "https://daily-ruleta-six.vercel.app/api/roster"
# Esperado (sano, sin datos): {"error":"Falta chatId o token SSO"}
```

Si devuelve `500 / FUNCTION_INVOCATION_FAILED`, revisá el deploy. Si devuelve
`"Backend sin configurar (faltan AAD_*)"`, faltan las env vars del paso (b).

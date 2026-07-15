# 🎯 Ruleta del Daily Scrum

Ruleta que muestra los **participantes conectados** de una reunión y **elige uno al
azar**. Es una única app web que se integra como **plugin en Zoom** (Zoom App) y en
**Microsoft Teams** (meeting app), detectando sola en qué plataforma corre.

## Cómo funciona

- Un mismo código, tres adaptadores (`src/platform/`):
  - **Zoom** → `@zoom/appssdk` → `getMeetingParticipants` (roster real automática).
  - **Teams** → `@microsoft/teams-js` (SSO) + función `/api/roster` que lee los
    **miembros del chat de la reunión** vía Microsoft Graph (On-Behalf-Of).
  - **Standalone/Manual** → para probar en el navegador y agregar nombres a mano.
- La detección de plataforma es automática; se puede forzar con `?platform=zoom`,
  `?platform=teams` o `?platform=standalone`.
- El sorteo es justo: se elige el ganador primero y la animación gira hacia él.
- Extras: excluir al host, "reiniciar ronda" para no repetir hasta que hablen todos.

## Desarrollo

```bash
npm install
npm run dev            # http://localhost:5173  (probar en modo Manual)
npm run build          # genera dist/ (estático)
```

Probar la UI sin Zoom/Teams: abrí `http://localhost:5173/?platform=standalone` y
agregá nombres.

## Desplegar

Es un sitio estático (carpeta `dist/`). Cualquier hosting HTTPS sirve. Con Vercel:

```bash
npm i -g vercel
vercel            # preview
vercel --prod     # producción
```

Zoom y Teams **exigen HTTPS**; en local usá un túnel (`ngrok http 5173`).

## Integración por plataforma

- Zoom: ver [`docs/zoom-setup.md`](docs/zoom-setup.md)
- Teams: ver [`docs/teams-setup.md`](docs/teams-setup.md) y `teams-app/manifest.json`

## Estructura

```
src/
  platform/
    types.ts        # Participant + PlatformAdapter (contrato común)
    detect.ts       # detección/selección de adaptador
    zoom.ts         # adaptador Zoom Apps SDK
    teams.ts        # adaptador Teams JS SDK (+ hook a backend Graph opcional)
    standalone.ts   # manual / localStorage
  wheel/
    Wheel.tsx       # ruleta en canvas + winnerIndex()
  App.tsx           # UI, animación del giro, sorteo, lista de participantes
teams-app/
  manifest.json     # manifiesto de la app de Teams
docs/               # guías de setup por plataforma
```

## Licencia

[MIT](LICENSE) © 2026 Javier Daccorso

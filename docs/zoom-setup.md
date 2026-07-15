# Integración con Zoom (Zoom App)

La ruleta corre como **Zoom App** embebida en el cliente de Zoom. Usa el
`@zoom/appssdk` para leer los participantes con `getMeetingParticipants`.

## Pasos

1. **Marketplace** → https://marketplace.zoom.us → *Develop* → *Build App* →
   elegí tipo **Zoom Apps** (General App con capacidad Zoom App).

2. **Home URL / Redirect**
   - Home URL: `https://TU-DOMINIO/?platform=zoom`
   - Redirect URL for OAuth: `https://TU-DOMINIO`
   - Domain allow list: agregá `TU-DOMINIO`.

3. **Scopes** (OAuth): agregá `meeting:read` (según pida el asistente para leer
   participantes).

4. **Zoom App SDK → Features / APIs**: habilitá exactamente las capabilities que
   pide el código (`src/platform/zoom.ts`):
   - `getMeetingParticipants`
   - `getMeetingContext`
   - `getUserContext`
   - `onParticipantChange`

5. **Local dev**: Zoom exige HTTPS. Levantá `npm run dev` y exponé el 5173 con un
   túnel:
   ```bash
   npm run dev
   # en otra terminal:
   ngrok http 5173      # o: cloudflared tunnel --url http://localhost:5173
   ```
   Poné la URL https del túnel como Home URL mientras desarrollás.

6. Abrí Zoom, iniciá una reunión, y abrí la app desde **Apps** en la barra.

## Notas

- `getMeetingParticipants` solo devuelve datos con una reunión en curso.
- El `participantUUID` es estable dentro de la reunión → lo usamos como `id`.
- Publicación: para uso interno alcanza con la app en modo *Development* y agregar
  testers, o publicarla como app interna de tu cuenta (admin-managed).

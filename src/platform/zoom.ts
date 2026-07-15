import zoomSdk from "@zoom/appssdk";
import type { Participant, PlatformAdapter } from "./types";

/**
 * Adaptador para Zoom Apps (la app corre embebida en el cliente de Zoom).
 *
 * Requisitos en Zoom App Marketplace (ver docs/zoom-setup.md):
 *  - App tipo "Zoom App" con Home URL = URL de esta app (HTTPS).
 *  - Capabilities / API a habilitar:
 *      getMeetingParticipants, getMeetingContext, getUserContext,
 *      onParticipantChange
 *  - Scopes OAuth: meeting:read (según la config del Marketplace).
 */
export class ZoomAdapter implements PlatformAdapter {
  readonly id = "zoom" as const;
  readonly label = "Zoom";

  async init(): Promise<void> {
    await zoomSdk.config({
      capabilities: [
        "getMeetingParticipants",
        "getMeetingContext",
        "getUserContext",
        "onParticipantChange",
      ],
    });
  }

  async getParticipants(): Promise<Participant[]> {
    // getMeetingParticipants requiere que el meeting esté en curso.
    const res = (await zoomSdk.getMeetingParticipants()) as {
      participants?: Array<{
        participantUUID?: string;
        screenName?: string;
        role?: string;
      }>;
    };

    const list = res.participants ?? [];
    return list.map((p, i) => ({
      id: p.participantUUID ?? `zoom-${i}`,
      name: p.screenName ?? "Sin nombre",
      isHost: p.role === "host" || p.role === "co-host",
    }));
  }

  onParticipantsChanged(cb: () => void): () => void {
    const handler = () => cb();
    zoomSdk.onParticipantChange(handler);
    return () => {
      // El SDK expone removeEventListener por evento.
      try {
        zoomSdk.removeEventListener("onParticipantChange", handler);
      } catch {
        /* noop */
      }
    };
  }
}

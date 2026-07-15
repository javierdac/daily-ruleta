import { app, authentication } from "@microsoft/teams-js";
import type { Participant, PlatformAdapter } from "./types";

/**
 * Adaptador para Microsoft Teams (la app corre como panel dentro de la reunión).
 *
 * La roster de participantes se obtiene de los MIEMBROS DEL CHAT de la reunión
 * (Graph GET /chats/{chatId}/members), vía SSO delegado + On-Behalf-Of:
 *   1) el cliente de Teams entrega un token SSO del usuario (authentication.getAuthToken)
 *   2) ese token viaja al backend /api/roster, que hace el flujo OBO y llama a Graph.
 *
 * Setup en Azure AD + Teams: ver docs/teams-setup.md.
 */
export class TeamsAdapter implements PlatformAdapter {
  readonly id = "teams" as const;
  readonly label = "Microsoft Teams";

  private chatId?: string;

  async init(): Promise<void> {
    await app.initialize();
    const ctx = await app.getContext();
    this.chatId = ctx.chat?.id;
  }

  async getParticipants(): Promise<Participant[]> {
    const roster = await this.rosterViaGraph();
    if (roster.length > 0) return roster;

    // Fallback si no hay chatId o el backend no responde: al menos el usuario actual.
    const me = await this.currentUser();
    return me ? [me] : [];
  }

  private async currentUser(): Promise<Participant | null> {
    try {
      const ctx = await app.getContext();
      const name = ctx.user?.displayName ?? ctx.user?.userPrincipalName;
      if (!name) return null;
      return { id: ctx.user?.id ?? name, name };
    } catch {
      return null;
    }
  }

  /**
   * Trae los miembros del chat de la reunión.
   * Configurable con VITE_ROSTER_API; por defecto usa /api/roster del mismo deploy.
   * El backend espera: GET {endpoint}?chatId=... con Authorization: Bearer <ssoToken>
   * y devuelve { participants: {id, name, isHost}[] }.
   */
  private async rosterViaGraph(): Promise<Participant[]> {
    if (!this.chatId) return [];
    const endpoint =
      (import.meta.env.VITE_ROSTER_API as string | undefined) || "/api/roster";
    try {
      const token = await authentication.getAuthToken();
      const res = await fetch(
        `${endpoint}?chatId=${encodeURIComponent(this.chatId)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );
      if (!res.ok) return [];
      const data = (await res.json()) as { participants?: Participant[] };
      return data.participants ?? [];
    } catch {
      return [];
    }
  }
}

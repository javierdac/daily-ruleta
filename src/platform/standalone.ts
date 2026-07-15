import type { Participant, PlatformAdapter } from "./types";

const STORAGE_KEY = "ruleta.participants.manual";

/**
 * Adaptador "standalone": para probar en el navegador fuera de Zoom/Teams,
 * y como fallback manual dentro de Teams cuando no hay roster automática.
 * Persiste la lista en localStorage.
 */
export class StandaloneAdapter implements PlatformAdapter {
  readonly id = "standalone" as const;
  readonly label = "Manual";

  async init(): Promise<void> {
    /* nada que inicializar */
  }

  async getParticipants(): Promise<Participant[]> {
    return readManual();
  }
}

export function readManual(): Participant[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Participant[];
  } catch {
    return [];
  }
}

export function writeManual(list: Participant[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export type PlatformId = "zoom" | "teams" | "standalone";

export interface Participant {
  /** Identificador estable dentro del meeting (para deduplicar). */
  id: string;
  /** Nombre a mostrar en la ruleta. */
  name: string;
  /** true si es el host/organizador (por si querés excluirlo del sorteo). */
  isHost?: boolean;
}

export interface PlatformAdapter {
  readonly id: PlatformId;
  /** Nombre legible de la plataforma. */
  readonly label: string;
  /** Inicializa el SDK correspondiente. Lanza si no está disponible. */
  init(): Promise<void>;
  /** Devuelve los participantes conectados en este momento. */
  getParticipants(): Promise<Participant[]>;
  /**
   * Se suscribe a cambios en la lista de participantes (entradas/salidas).
   * Devuelve una función para desuscribirse. Opcional según plataforma.
   */
  onParticipantsChanged?(cb: () => void): () => void;
}

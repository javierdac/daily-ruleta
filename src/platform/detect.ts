import type { PlatformAdapter, PlatformId } from "./types";
import { ZoomAdapter } from "./zoom";
import { TeamsAdapter } from "./teams";
import { StandaloneAdapter } from "./standalone";

/**
 * Detecta en qué host corre la app y devuelve el adaptador ya inicializado.
 * Estrategia: intentar Zoom, luego Teams; si ninguno inicializa, standalone.
 */
export async function resolveAdapter(): Promise<PlatformAdapter> {
  const forced = new URLSearchParams(location.search).get("platform") as
    | PlatformId
    | null;

  if (forced === "standalone") return initOrThrow(new StandaloneAdapter());
  if (forced === "zoom") return initOrThrow(new ZoomAdapter());
  if (forced === "teams") return initOrThrow(new TeamsAdapter());

  // Zoom inyecta el SDK dentro de su webview; config() falla fuera de Zoom.
  try {
    const zoom = new ZoomAdapter();
    await zoom.init();
    return zoom;
  } catch {
    /* no es Zoom */
  }

  // Teams: app.initialize() resuelve solo dentro del cliente/host de Teams.
  try {
    const teams = new TeamsAdapter();
    await withTimeout(teams.init(), 2500);
    return teams;
  } catch {
    /* no es Teams */
  }

  return initOrThrow(new StandaloneAdapter());
}

async function initOrThrow(a: PlatformAdapter): Promise<PlatformAdapter> {
  await a.init();
  return a;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
}

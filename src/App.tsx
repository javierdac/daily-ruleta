import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveAdapter } from "./platform/detect";
import type { Participant, PlatformAdapter } from "./platform/types";
import { readManual, writeManual } from "./platform/standalone";
import { Wheel, winnerIndex } from "./wheel/Wheel";

const TAU = Math.PI * 2;
const SPIN_MS = 5200;

export default function App() {
  const [adapter, setAdapter] = useState<PlatformAdapter | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [excludeHost, setExcludeHost] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<Participant | null>(null);
  const [alreadyPicked, setAlreadyPicked] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);

  // Inicializa la plataforma y trae participantes.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const a = await resolveAdapter();
        if (!alive) return;
        setAdapter(a);
        await refresh(a);
        a.onParticipantsChanged?.(() => void refresh(a));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(async (a: PlatformAdapter) => {
    const list = await a.getParticipants();
    // En manual/standalone, mezclamos con lo guardado en localStorage.
    const merged =
      a.id === "standalone" ? dedupe([...list, ...readManual()]) : dedupe(list);
    setParticipants(merged);
  }, []);

  // Pool para el sorteo: aplica exclusiones.
  const pool = useMemo(() => {
    return participants.filter((p) => {
      if (excludeHost && p.isHost) return false;
      if (alreadyPicked.has(p.id)) return false;
      return true;
    });
  }, [participants, excludeHost, alreadyPicked]);

  const spin = useCallback(() => {
    if (spinning || pool.length === 0) return;
    setWinner(null);
    setSpinning(true);

    // Elegimos el ganador PRIMERO (sorteo justo), luego animamos hacia él.
    const targetIdx = Math.floor(Math.random() * pool.length);
    const target = pool[targetIdx];

    // Índice del ganador dentro de la lista completa dibujada.
    const drawIdx = participants.findIndex((p) => p.id === target.id);
    const n = participants.length;
    const seg = TAU / n;

    // Ángulo local del centro del segmento ganador.
    const centerTheta = (drawIdx + 0.5) * seg;
    // Queremos rotation tal que (centerTheta + rotation) === 3π/2 (puntero arriba).
    const pointer = (3 * Math.PI) / 2;
    let targetRotation = pointer - centerTheta;
    // Sumamos varias vueltas y un pequeño jitter dentro del segmento.
    const spins = 6 + Math.floor(Math.random() * 3);
    const jitter = (Math.random() - 0.5) * seg * 0.7;
    targetRotation += spins * TAU + jitter;

    const startRotation = rotation % TAU;
    const delta = targetRotation - startRotation;
    const startTs = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - startTs) / SPIN_MS);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setRotation(startRotation + delta * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setSpinning(false);
        const idx = winnerIndex(startRotation + delta, n);
        const w = participants[idx] ?? target;
        setWinner(w);
        setAlreadyPicked((prev) => new Set(prev).add(w.id));
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [spinning, pool, participants, rotation]);

  const addManual = useCallback(() => {
    const name = newName.trim();
    if (!name) return;
    const p: Participant = { id: `manual-${name}-${Date.now()}`, name };
    const next = dedupe([...readManual(), p]);
    writeManual(next);
    setParticipants((prev) => dedupe([...prev, p]));
    setNewName("");
  }, [newName]);

  const removeParticipant = useCallback(
    (id: string) => {
      setParticipants((prev) => prev.filter((p) => p.id !== id));
      writeManual(readManual().filter((p) => p.id !== id));
    },
    [],
  );

  const resetPicked = useCallback(() => {
    setAlreadyPicked(new Set());
    setWinner(null);
  }, []);

  const isManual = adapter?.id === "standalone";

  return (
    <div className="app">
      <header className="topbar">
        <h1>🎯 Ruleta del Daily</h1>
        <span className="platform-badge">
          {adapter ? adapter.label : "detectando…"}
        </span>
      </header>

      {error && <div className="error">Error: {error}</div>}

      <main className="layout">
        <section className="wheel-col">
          <Wheel participants={participants} rotation={rotation} size={360} />
          <button
            className="spin-btn"
            onClick={spin}
            disabled={spinning || pool.length === 0}
          >
            {spinning ? "Girando…" : "¡Girar!"}
          </button>

          {winner && (
            <div className="winner" role="status">
              Le toca a <strong>{winner.name}</strong> 🎉
            </div>
          )}
          {pool.length === 0 && participants.length > 0 && (
            <div className="hint">Todos ya participaron. Reiniciá la ronda.</div>
          )}
        </section>

        <aside className="side">
          <div className="controls">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={excludeHost}
                onChange={(e) => setExcludeHost(e.target.checked)}
              />
              Excluir al host
            </label>
            <button className="ghost" onClick={resetPicked}>
              Reiniciar ronda
            </button>
            {adapter && (
              <button className="ghost" onClick={() => void refresh(adapter)}>
                ↻ Actualizar
              </button>
            )}
          </div>

          <h2>
            Participantes{" "}
            <span className="count">
              {pool.length}/{participants.length}
            </span>
          </h2>

          {(isManual || participants.length === 0) && (
            <div className="add-row">
              <input
                value={newName}
                placeholder="Agregar nombre…"
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addManual()}
              />
              <button onClick={addManual}>+</button>
            </div>
          )}

          <ul className="plist">
            {participants.map((p) => (
              <li
                key={p.id}
                className={alreadyPicked.has(p.id) ? "picked" : ""}
              >
                <span>
                  {p.name}
                  {p.isHost && <em className="tag">host</em>}
                </span>
                {p.id.startsWith("manual-") && (
                  <button
                    className="x"
                    onClick={() => removeParticipant(p.id)}
                    aria-label={`Quitar ${p.name}`}
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        </aside>
      </main>
    </div>
  );
}

function dedupe(list: Participant[]): Participant[] {
  const seen = new Set<string>();
  const out: Participant[] = [];
  for (const p of list) {
    const key = p.id || p.name;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

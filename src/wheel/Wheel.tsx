import { useEffect, useRef } from "react";
import type { Participant } from "../platform/types";

const TAU = Math.PI * 2;

// Paleta accesible, se cicla por segmento.
const COLORS = [
  "#4f46e5", "#0891b2", "#16a34a", "#ca8a04",
  "#dc2626", "#db2777", "#7c3aed", "#0d9488",
];

interface WheelProps {
  participants: Participant[];
  /** Ángulo de rotación actual en radianes (controlado por el padre). */
  rotation: number;
  size?: number;
}

/**
 * Dibuja la ruleta. El puntero está fijo arriba (12 en punto).
 * El padre controla `rotation`; para saber el ganador usar winnerIndex().
 */
export function Wheel({ participants, rotation, size = 360 }: WheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 6;
    const n = participants.length;

    if (n === 0) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "16px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Sin participantes", cx, cy);
      return;
    }

    const seg = TAU / n;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    for (let i = 0; i < n; i++) {
      const start = i * seg;
      const end = start + seg;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, start, end);
      ctx.closePath();
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.fill();

      // Etiqueta radial.
      ctx.save();
      ctx.rotate(start + seg / 2);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.font = "600 14px system-ui, sans-serif";
      const label = truncate(participants[i].name, 16);
      ctx.fillText(label, r - 14, 0);
      ctx.restore();
    }

    // Círculo central.
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, TAU);
    ctx.fillStyle = "#0f172a";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    ctx.restore();
  }, [participants, rotation, size]);

  return (
    <div className="wheel-wrap" style={{ width: size, height: size }}>
      <div className="wheel-pointer" aria-hidden />
      <canvas ref={canvasRef} style={{ width: size, height: size }} />
    </div>
  );
}

/**
 * Dado el ángulo final de rotación y la cantidad de segmentos, devuelve el
 * índice del segmento que queda bajo el puntero (arriba, 12 en punto).
 *
 * Canvas: 0 rad = 3 en punto, ángulo positivo = horario (y hacia abajo).
 * El puntero (arriba) está en 3π/2. Un segmento con centro local θ aparece
 * en pantalla en (θ + rotation). Queremos el θ tal que (θ + rotation) = 3π/2.
 */
export function winnerIndex(rotation: number, n: number): number {
  if (n === 0) return -1;
  const seg = TAU / n;
  const pointer = (3 * Math.PI) / 2;
  let theta = (pointer - rotation) % TAU;
  if (theta < 0) theta += TAU;
  return Math.floor(theta / seg) % n;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

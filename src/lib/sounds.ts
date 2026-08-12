/**
 * Procedural sound effects via Web Audio API.
 * No audio files — everything is synthesised on demand.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    ctx = new AudioContextClass();
  }
  return ctx;
}

/** Deep resonant pulse — used for the sphere click. */
export async function playSphereClick() {
  const ac = getCtx();
  if (!ac) return;
  try {
    if (ac.state === "suspended") await ac.resume();
  } catch {
    // Ignore autoplay blocks
  }
  const now = ac.currentTime;

  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  osc.connect(gain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.35);
}

/** Metallic chime — used for the torus click. */
export async function playTorusClick() {
  const ac = getCtx();
  if (!ac) return;
  try {
    if (ac.state === "suspended") await ac.resume();
  } catch {
    // Ignore autoplay blocks
  }
  const now = ac.currentTime;

  // Two detuned oscillators for a metallic shimmer
  for (const freq of [880, 1320]) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.2);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain).connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }
}

/** Crystalline ping — used for the icosahedron click. */
export async function playIcoClick() {
  const ac = getCtx();
  if (!ac) return;
  try {
    if (ac.state === "suspended") await ac.resume();
  } catch {
    // Ignore autoplay blocks
  }
  const now = ac.currentTime;

  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1760, now);
  osc.frequency.exponentialRampToValueAtTime(440, now + 0.15);
  gain.gain.setValueAtTime(0.07, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(gain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.2);
}

// ── Hover sounds (subtle whooshes) ──────────────────────────────────────

let _lastHoverSound = 0;
const HOVER_COOLDOWN = 120; // ms — prevent rapid-fire on jittery cursor

/** Low breathy whoosh — sphere hover. */
export function playSphereHover() {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  if (now * 1000 - _lastHoverSound < HOVER_COOLDOWN) return;
  _lastHoverSound = now * 1000;

  // Filtered noise burst
  const bufferSize = ac.sampleRate * 0.15;
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
  const noise = ac.createBufferSource();
  noise.buffer = buffer;

  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(300, now);
  filter.frequency.exponentialRampToValueAtTime(120, now + 0.15);
  filter.Q.value = 1;

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.04, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  noise.connect(filter).connect(gain).connect(ac.destination);
  noise.start(now);
  noise.stop(now + 0.15);
}

/** Mid shimmer whoosh — torus hover. */
export function playTorusHover() {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  if (now * 1000 - _lastHoverSound < HOVER_COOLDOWN) return;
  _lastHoverSound = now * 1000;

  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(600, now);
  osc.frequency.exponentialRampToValueAtTime(900, now + 0.08);
  osc.frequency.exponentialRampToValueAtTime(500, now + 0.18);
  gain.gain.setValueAtTime(0.03, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  osc.connect(gain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.18);
}

/** High crystalline shimmer — icosahedron hover. */
export function playIcoHover() {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  if (now * 1000 - _lastHoverSound < HOVER_COOLDOWN) return;
  _lastHoverSound = now * 1000;

  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.exponentialRampToValueAtTime(1800, now + 0.06);
  osc.frequency.exponentialRampToValueAtTime(1000, now + 0.14);
  gain.gain.setValueAtTime(0.025, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
  osc.connect(gain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.14);
}

/** Dispatch hover sound based on object type. */
export function playHoverSound(obj: "sphere" | "torus" | "ico") {
  switch (obj) {
    case "sphere": playSphereHover(); break;
    case "torus": playTorusHover(); break;
    case "ico": playIcoHover(); break;
  }
}

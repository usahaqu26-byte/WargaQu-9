let sharedAudioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!sharedAudioCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      sharedAudioCtx = new Ctx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      void sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

export function triggerSiagaQuizVibrate(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return false;
  }
  try {
    return navigator.vibrate([260, 120, 260, 120, 420]);
  } catch {
    return false;
  }
}

export function playSiagaQuizChime(muted = false): void {
  if (muted) return;
  const ctx = getAudioCtx();
  if (!ctx) return;

  const notes = [
    { freq: 880, start: 0, dur: 0.16 },
    { freq: 1174.66, start: 0.2, dur: 0.16 },
    { freq: 1318.51, start: 0.4, dur: 0.28 },
    { freq: 1174.66, start: 0.74, dur: 0.14 },
    { freq: 1567.98, start: 0.92, dur: 0.34 },
  ];

  const baseTime = ctx.currentTime;
  for (const n of notes) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.freq, baseTime + n.start);

      gain.gain.setValueAtTime(0.001, baseTime + n.start);
      gain.gain.exponentialRampToValueAtTime(0.18, baseTime + n.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, baseTime + n.start + n.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(baseTime + n.start);
      osc.stop(baseTime + n.start + n.dur + 0.02);
    } catch {
      // Abaikan jika browser membatasi autoplay audio
    }
  }
}

export function triggerSiagaQuizAlert(muted = false): { vibrated: boolean } {
  const vibrated = triggerSiagaQuizVibrate();
  playSiagaQuizChime(muted);
  return { vibrated };
}

import type { QuizQuotaCheckResult, QuizRound, SuggestedScheduleSlot } from './quizTypes';

export const QUIZ_DURATION_SEC = 10 * 60; // 10 menit
export const MAX_HOURLY_QUIZ_QUOTA = 5000;

export function getHourSlotKey(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return 'invalid';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:00`;
}

export function formatIndonesianDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTimeOnlyHHMM(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function toLocalDateTimeInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

export function getHourlyBookedCount(
  rounds: QuizRound[],
  targetIso: string
): number {
  const key = getHourSlotKey(targetIso);
  return rounds
    .filter((r) => getHourSlotKey(r.scheduledStartAt) === key)
    .reduce((sum, r) => sum + Math.max(r.registeredCount, r.participants.length), 0);
}

/**
 * Mengecek kuota per jam (maks 5.000 peserta/jam).
 * Bila jam pilihan menyentuh limit, mengembalikan saran penggeseran jadwal
 * (mis. mundur 15 menit dari 18:25 -> 18:40, 19:00, atau maju 15 menit).
 */
export function checkScheduleSlotQuota(
  rounds: QuizRound[],
  candidateIso: string,
  maxQuota = MAX_HOURLY_QUIZ_QUOTA
): QuizQuotaCheckResult {
  const baseDate = new Date(candidateIso);
  const validDate = Number.isNaN(baseDate.getTime()) ? new Date(Date.now() + 15 * 60000) : baseDate;
  const hourKey = getHourSlotKey(validDate);
  const currentBooked = getHourlyBookedCount(rounds, validDate.toISOString());
  const isAtLimit = currentBooked >= maxQuota;
  const remaining = Math.max(0, maxQuota - currentBooked);

  const offsetsMinutes = [15, 35, 60, -15];
  const suggestedSlots: SuggestedScheduleSlot[] = [];

  for (const offset of offsetsMinutes) {
    const shifted = new Date(validDate.getTime() + offset * 60 * 1000);
    const shiftedIso = shifted.toISOString();
    const booked = getHourlyBookedCount(rounds, shiftedIso);

    if (!isAtLimit || booked < maxQuota || offset >= 35) {
      const direction = offset > 0 ? `Mundur +${offset} mnt` : `Majukan ${Math.abs(offset)} mnt`;
      suggestedSlots.push({
        iso: shiftedIso,
        timeLabel: formatTimeOnlyHHMM(shiftedIso),
        dateTimeLabel: formatIndonesianDateTime(shiftedIso),
        shiftLabel: direction,
        bookedCount: booked,
      });
    }
  }

  return {
    isAtLimit,
    hourKey,
    currentBooked,
    maxQuota,
    remaining,
    suggestedSlots,
  };
}

export interface RoundTimingSnapshot {
  phase: 'upcoming' | 'live' | 'ended';
  startsInSec: number;
  remainingSec: number;
  elapsedSec: number;
}

export function getRoundTimingSnapshot(round: QuizRound, nowMs = Date.now()): RoundTimingSnapshot {
  const startMs = new Date(round.scheduledStartAt).getTime();
  const durationMs = Math.max(60, round.durationSec || QUIZ_DURATION_SEC) * 1000;
  const endMs = startMs + durationMs;

  if (Number.isNaN(startMs)) {
    return { phase: 'upcoming', startsInSec: 900, remainingSec: QUIZ_DURATION_SEC, elapsedSec: 0 };
  }

  if (round.status === 'completed' || nowMs >= endMs) {
    return {
      phase: 'ended',
      startsInSec: 0,
      remainingSec: 0,
      elapsedSec: Math.round(durationMs / 1000),
    };
  }

  if (round.status === 'live' || nowMs >= startMs) {
    const remainingSec = Math.max(0, Math.ceil((endMs - nowMs) / 1000));
    const elapsedSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
    return {
      phase: remainingSec > 0 ? 'live' : 'ended',
      startsInSec: 0,
      remainingSec,
      elapsedSec,
    };
  }

  return {
    phase: 'upcoming',
    startsInSec: Math.max(0, Math.ceil((startMs - nowMs) / 1000)),
    remainingSec: Math.round(durationMs / 1000),
    elapsedSec: 0,
  };
}

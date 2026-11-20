import { AuthService } from '../authService';
import { canonicalInviteSlug, REALTIME_RELAY_EVENT_NAME, RELAY_REGISTER_CHANNELS_EVENT } from '../inviteRelayService';
import { RealtimeRelayService } from '../realtimeRelayService';
import { MAX_HOURLY_QUIZ_QUOTA } from './quizSchedulerService';
import { buildApiUrl } from '../appOriginService';
import type {
  QuizAccessPolicy,
  QuizParticipantEntry,
  QuizPersonalRecap,
  QuizRound,
  QuizSponsorContribution,
} from './quizTypes';

const QUIZ_ROUNDS_KEY_PREFIX = 'wargaqu_leluhur_quiz_rounds_v1_';
const QUIZ_RECAPS_KEY_PREFIX = 'wargaqu_leluhur_quiz_recaps_v1_';
const QUIZ_DISMISSED_ALERTS_KEY = 'wargaqu_leluhur_quiz_dismissed_v1';
const QUIZ_TRAFFIC_POLICY_KEY = 'wargaqu_leluhur_quiz_policy_v1';

export const QUIZ_SYNC_CHANNEL_PREFIX = 'sync:trah-quiz:';

export function getQuizSyncChannel(trahName: string): string {
  return `${QUIZ_SYNC_CHANNEL_PREFIX}${canonicalInviteSlug(trahName || 'umum')}`;
}

export function getCurrentQuizScopeKey(): string {
  const acc = AuthService.getAccount();
  const email = (acc?.email || '').trim().toLowerCase();
  return email ? email.replace(/[^a-z0-9@._-]/g, '_') : 'guest';
}

function safeLoad<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSave<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Abaikan kuota storage penuh
  }
}

export function loadQuizRounds(
  scopeKey: string,
  trahId: string
): QuizRound[] {
  const key = `${QUIZ_ROUNDS_KEY_PREFIX}${scopeKey}_${trahId}`;
  const existing = safeLoad<QuizRound[] | null>(key, null);
  if (existing && Array.isArray(existing)) {
    return existing.filter((r) => !r.id?.startsWith('round-seed-'));
  }
  return [];
}

export function saveQuizRounds(scopeKey: string, trahId: string, rounds: QuizRound[]): void {
  const key = `${QUIZ_ROUNDS_KEY_PREFIX}${scopeKey}_${trahId}`;
  safeSave(key, rounds.filter((r) => !r.id?.startsWith('round-seed-')));
}

export async function fetchServerQuizRounds(trahName: string): Promise<QuizRound[]> {
  if (typeof fetch === 'undefined') return [];
  try {
    const slug = canonicalInviteSlug(trahName || 'umum');
    const resp = await fetch(buildApiUrl(`/api/quiz-rounds/${encodeURIComponent(slug)}`));
    if (!resp.ok) return [];
    const data = (await resp.json()) as { found?: boolean; rounds?: QuizRound[] };
    if (!data.found || !Array.isArray(data.rounds)) return [];
    return data.rounds.filter((r) => !r.id?.startsWith('round-seed-'));
  } catch {
    return [];
  }
}

export async function pushServerQuizRounds(trahName: string, rounds: QuizRound[]): Promise<void> {
  if (typeof fetch === 'undefined') return;
  try {
    const slug = canonicalInviteSlug(trahName || 'umum');
    const cleanRounds = rounds.filter((r) => !r.id?.startsWith('round-seed-'));
    await fetch(buildApiUrl(`/api/quiz-rounds/${encodeURIComponent(slug)}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rounds: cleanRounds }),
    });
  } catch {
    // Abaikan error jaringan latar belakang
  }
}

export function loadPersonalRecaps(scopeKey: string): QuizPersonalRecap[] {
  const key = `${QUIZ_RECAPS_KEY_PREFIX}${scopeKey}`;
  const list = safeLoad<QuizPersonalRecap[]>(key, []);
  return Array.isArray(list) ? list : [];
}

export function savePersonalRecap(scopeKey: string, recap: QuizPersonalRecap): QuizPersonalRecap[] {
  const current = loadPersonalRecaps(scopeKey);
  const filtered = current.filter((item) => item.id !== recap.id);
  const next = [recap, ...filtered].slice(0, 80);
  safeSave(`${QUIZ_RECAPS_KEY_PREFIX}${scopeKey}`, next);
  return next;
}

export function markAlertHandledForRound(roundId: string): void {
  const map = safeLoad<Record<string, boolean>>(QUIZ_DISMISSED_ALERTS_KEY, {});
  map[roundId] = true;
  safeSave(QUIZ_DISMISSED_ALERTS_KEY, map);
}

export function isAlertHandledForRound(roundId: string): boolean {
  const map = safeLoad<Record<string, boolean>>(QUIZ_DISMISSED_ALERTS_KEY, {});
  return Boolean(map[roundId]);
}

/**
 * Urutan rekapan peserta ronde:
 * 1. Peserta yang menjawab >= 1 soal diurutkan skor tertinggi lalu waktu submit tercepat.
 * 2. Peserta yang tidak merespons (0 jawaban / HP mati / tidak submit) selalu di paling bawah.
 */
export function sortRoundParticipantsForRecap(
  participants: QuizParticipantEntry[],
  roundEnded = false
): QuizParticipantEntry[] {
  const normalized = participants.map((p) => {
    if (roundEnded && p.answeredCount === 0 && p.status !== 'no_response') {
      return { ...p, status: 'no_response' as const };
    }
    return p;
  });

  const activeResponders = normalized
    .filter((p) => p.answeredCount > 0 && p.status !== 'no_response')
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const durA = a.submitDurationSec ?? 999999;
      const durB = b.submitDurationSec ?? 999999;
      return durA - durB;
    });

  const nonResponders = normalized
    .filter((p) => p.answeredCount === 0 || p.status === 'no_response')
    .sort((a, b) => a.name.localeCompare(b.name));

  return [...activeResponders, ...nonResponders];
}

export function getTotalSponsorPool(round: QuizRound): number {
  return (round.sponsors || []).reduce((sum, sp) => sum + (Number(sp.amount) || 0), 0);
}

/**
 * Lapisan kontrol akses & monetisasi masa depan (terpisah dari fasilitas cetak/print PDF silsilah).
 * Saat trafik di bawah kuota real-time gratis (5.000 peserta), semua sesi tetap gratis.
 */
export function getQuizAccessPolicy(
  activeTrafficCount = 0,
  overrideMode?: 'free' | 'per_session' | 'monthly_pass'
): QuizAccessPolicy {
  const saved = safeLoad<Partial<QuizAccessPolicy>>(QUIZ_TRAFFIC_POLICY_KEY, {});
  const threshold = MAX_HOURLY_QUIZ_QUOTA;
  const isOver = activeTrafficCount > threshold;
  const mode = overrideMode || saved.mode || (isOver ? 'per_session' : 'free');
  const sessionFeeRp = saved.sessionFeeRp ?? 2000;
  const monthlyFeeRp = saved.monthlyFeeRp ?? 15000;

  return {
    mode,
    realtimeParticipantThreshold: threshold,
    activeTrafficCount,
    isOverRealtimeQuota: isOver,
    sessionFeeRp,
    monthlyFeeRp,
    canJoinFree: !isOver && mode === 'free',
    statusSummary: isOver
      ? `Trafik padat (${activeTrafficCount.toLocaleString('id-ID')} > ${threshold.toLocaleString('id-ID')}/jam): siap aktifkan tarif ringan Rp ${sessionFeeRp.toLocaleString('id-ID')}/sesi atau Paket Bulanan Rp ${monthlyFeeRp.toLocaleString('id-ID')}.`
      : `Kuota Real-Time Gratis aktif (trafik di bawah ${threshold.toLocaleString('id-ID')} peserta/jam). Tarif ringan siap diaktifkan otomatis saat ramai.`,
    printDocumentSeparateNote:
      'Fasilitas Cetak/Print Poster & Buku Silsilah PDF dikelola terpisah dari layanan kuis trah.',
  };
}

export function saveQuizAccessMode(mode: 'free' | 'per_session' | 'monthly_pass'): void {
  const prev = safeLoad<Record<string, unknown>>(QUIZ_TRAFFIC_POLICY_KEY, {});
  safeSave(QUIZ_TRAFFIC_POLICY_KEY, { ...prev, mode });
}

export type QuizSyncMessage =
  | { type: 'quiz:round_upsert'; trahId: string; round: QuizRound }
  | { type: 'quiz:participant_update'; trahId: string; roundId: string; participant: QuizParticipantEntry }
  | { type: 'quiz:sponsor_add'; trahId: string; roundId: string; sponsor: QuizSponsorContribution }
  | { type: 'quiz:sync_request'; trahId: string }
  | { type: 'quiz:sync_state'; trahId: string; rounds: QuizRound[] };

export function publishQuizSyncEvent(trahName: string, message: QuizSyncMessage): void {
  const channel = getQuizSyncChannel(trahName);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(RELAY_REGISTER_CHANNELS_EVENT, { detail: { channels: [channel] } })
    );
  }
  RealtimeRelayService.publish(channel, message.type, message);
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const bc = new BroadcastChannel(channel);
      bc.postMessage(message);
      bc.close();
    } catch {
      // Abaikan jika BroadcastChannel dibatasi
    }
  }
}

export function subscribeQuizSyncEvents(
  trahName: string,
  onMessage: (msg: QuizSyncMessage) => void
): () => void {
  const channel = getQuizSyncChannel(trahName);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(RELAY_REGISTER_CHANNELS_EVENT, { detail: { channels: [channel] } })
    );
  }

  const onRelay = (ev: Event) => {
    const detail = (ev as CustomEvent<{
      channel?: string;
      eventName?: string;
      payload?: QuizSyncMessage;
    }>).detail;
    if (!detail || detail.channel !== channel || !detail.payload) return;
    onMessage(detail.payload);
  };

  window.addEventListener(REALTIME_RELAY_EVENT_NAME, onRelay as EventListener);

  let bc: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      bc = new BroadcastChannel(channel);
      bc.onmessage = (e) => {
        if (e.data && typeof e.data === 'object') {
          onMessage(e.data as QuizSyncMessage);
        }
      };
    } catch {
      bc = null;
    }
  }

  return () => {
    window.removeEventListener(REALTIME_RELAY_EVENT_NAME, onRelay as EventListener);
    if (bc) bc.close();
  };
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  Check,
  ChevronRight,
  Clock,
  HeartHandshake,
  History,
  ListChecks,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { FamilyMember, TrahCategory } from './LeluhurQuView';
import type {
  QuizAnswerDetail,
  QuizDataScope,
  QuizDifficulty,
  QuizPersonalRecap,
  QuizQuestion,
  QuizRound,
} from '../../services/leluhurQuiz/quizTypes';
import {
  composeQuizSessionQuestions,
  generateQuizQuestionBank,
} from '../../services/leluhurQuiz/quizQuestionBank';
import {
  checkScheduleSlotQuota,
  formatIndonesianDateTime,
  formatTimeOnlyHHMM,
  getRoundTimingSnapshot,
  MAX_HOURLY_QUIZ_QUOTA,
  QUIZ_DURATION_SEC,
  toLocalDateTimeInputValue,
} from '../../services/leluhurQuiz/quizSchedulerService';
import {
  fetchServerQuizRounds,
  getCurrentQuizScopeKey,
  getQuizAccessPolicy,
  getTotalSponsorPool,
  isAlertHandledForRound,
  loadPersonalRecaps,
  loadQuizRounds,
  markAlertHandledForRound,
  publishQuizSyncEvent,
  pushServerQuizRounds,
  savePersonalRecap,
  saveQuizAccessMode,
  saveQuizRounds,
  sortRoundParticipantsForRecap,
  subscribeQuizSyncEvents,
} from '../../services/leluhurQuiz/quizStorageAndSync';
import { triggerSiagaQuizAlert } from '../../services/leluhurQuiz/siagaQuizAlert';
import {
  RELAY_TELEMETRY_EVENT,
  RealtimeRelayService,
  ServerTelemetryPayload,
} from '../../services/realtimeRelayService';

export interface LeluhurQuizViewProps {
  activeTrah: TrahCategory;
  trahList: TrahCategory[];
  userName: string;
  userKinship?: string;
  onOpenPrintBook?: () => void;
  showNotification: (msg: string) => void;
}

type QuizSubTab = 'jadwal' | 'sponsor' | 'latihan' | 'rekap' | 'aturan';

interface ActiveQuizSessionState {
  mode: 'official' | 'practice';
  roundId: string;
  title: string;
  difficulty: QuizDifficulty;
  questions: QuizQuestion[];
  answers: Array<number | null>;
  currentIndex: number;
  startedAtMs: number;
  endsAtMs: number | null; // null untuk mode Latihan mandiri (tanpa tekanan timer resmi)
  siagaAlertBanner: boolean;
}

const DIFFICULTY_META: Record<
  QuizDifficulty,
  { label: string; shortDesc: string; sponsorHint: string }
> = {
  ringan: {
    label: 'Ringan',
    shortDesc: 'Stage 1 (Nama, panggilan, orang tua inti, pasangan)',
    sponsorHint: 'Ramah semua usia & generasi anak/cucu',
  },
  medium: {
    label: 'Medium',
    shortDesc: 'Stage 2 (Kombinasi kota domisili & cabang keluarga)',
    sponsorHint: 'Cocok untuk adu ingat lintas cabang keluarga',
  },
  sulit: {
    label: 'Sulit',
    shortDesc: 'Stage 3 (Tahun kelahiran tepat, selisih usia, 3-faktor)',
    sponsorHint: 'Tantangan tinggi — memicu sponsor menambah hadiah!',
  },
  campuran: {
    label: 'Campuran (4-3-3)',
    shortDesc: '4 soal Ringan + 3 soal Medium + 3 soal Sulit acak',
    sponsorHint: 'Format turnamen lengkap — pemicu patungan hadiah seru!',
  },
};

function formatTimerClock(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const mm = String(Math.floor(safe / 60)).padStart(2, '0');
  const ss = String(safe % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function formatRupiah(val: number): string {
  return `Rp ${Math.max(0, Math.round(val)).toLocaleString('id-ID')}`;
}

export const LeluhurQuizView: React.FC<LeluhurQuizViewProps> = ({
  activeTrah,
  trahList,
  userName,
  userKinship = 'Keluarga Trah',
  onOpenPrintBook,
  showNotification,
}) => {
  const scopeKey = useMemo(() => getCurrentQuizScopeKey(), []);
  const [subTab, setSubTab] = useState<QuizSubTab>('jadwal');
  const [dataScope, setDataScope] = useState<QuizDataScope>('active_trah');
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [isMutedAlert, setIsMutedAlert] = useState<boolean>(false);

  // Gabungan anggota sesuai scope (Trah Aktif atau Gabung Semua Pilar Trah)
  const targetMembers = useMemo<FamilyMember[]>(() => {
    if (dataScope === 'all_trah' && trahList.length > 0) {
      return trahList.flatMap((t) => t.members || []);
    }
    return activeTrah.members || [];
  }, [dataScope, trahList, activeTrah.members]);

  // Statistik Bank Soal & Deteksi Nama Sama
  const bankInfo = useMemo(
    () => generateQuizQuestionBank(targetMembers, `preview-${activeTrah.id}-${dataScope}`).stats,
    [targetMembers, activeTrah.id, dataScope]
  );

  // State ronde resmi & rekapan pribadi per-user
  const [rounds, setRounds] = useState<QuizRound[]>(() =>
    loadQuizRounds(scopeKey, activeTrah.id)
  );
  const [personalRecaps, setPersonalRecaps] = useState<QuizPersonalRecap[]>(() =>
    loadPersonalRecaps(scopeKey)
  );
  const [selectedRecapId, setSelectedRecapId] = useState<string | null>(null);
  const [selectedRekapRoundId, setSelectedRekapRoundId] = useState<string>('');
  const [liveRelayTraffic, setLiveRelayTraffic] = useState<number>(
    () => RealtimeRelayService.getTelemetry()?.connectedClients || 0
  );

  // Reload rounds lokal + tarik sinkronisasi server saat ganti Trah aktif
  useEffect(() => {
    const loaded = loadQuizRounds(scopeKey, activeTrah.id);
    setRounds(loaded);
    setSelectedRekapRoundId(loaded[0]?.id || '');

    let cancelled = false;
    void fetchServerQuizRounds(activeTrah.name).then((remoteRounds) => {
      if (cancelled || remoteRounds.length === 0) return;
      setRounds((prev) => {
        const mergedMap = new Map<string, QuizRound>();
        for (const r of remoteRounds) {
          if (r.trahId === activeTrah.id) mergedMap.set(r.id, r);
        }
        for (const r of prev) {
          if (!mergedMap.has(r.id)) mergedMap.set(r.id, r);
        }
        const merged = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        return merged;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [scopeKey, activeTrah.id, activeTrah.name]);

  // Persist rounds lokal & dorong ke server relay RAM saat berubah
  useEffect(() => {
    saveQuizRounds(scopeKey, activeTrah.id, rounds);
    if (rounds.length > 0) {
      void pushServerQuizRounds(activeTrah.name, rounds);
    }
  }, [rounds, scopeKey, activeTrah.id, activeTrah.name]);

  // Live WebSocket telemetry untuk trafik aktual
  useEffect(() => {
    void RealtimeRelayService.fetchHealthTelemetry().then((t) => {
      if (t) setLiveRelayTraffic(t.connectedClients);
    });
    const onTel = (ev: Event) => {
      const t = (ev as CustomEvent<ServerTelemetryPayload>).detail;
      if (t) setLiveRelayTraffic(t.connectedClients);
    };
    window.addEventListener(RELAY_TELEMETRY_EVENT, onTel);
    return () => window.removeEventListener(RELAY_TELEMETRY_EVENT, onTel);
  }, []);

  // Sinkronisasi Real-time (WebSocket Relay + BroadcastChannel)
  useEffect(() => {
    const unsubscribe = subscribeQuizSyncEvents(activeTrah.name, (msg) => {
      if (msg.trahId !== activeTrah.id) return;
      if (msg.type === 'quiz:round_upsert') {
        setRounds((prev) => {
          const exists = prev.some((r) => r.id === msg.round.id);
          return exists
            ? prev.map((r) => (r.id === msg.round.id ? msg.round : r))
            : [msg.round, ...prev];
        });
      } else if (msg.type === 'quiz:sponsor_add') {
        setRounds((prev) =>
          prev.map((r) => {
            if (r.id !== msg.roundId) return r;
            if (r.sponsors.some((s) => s.id === msg.sponsor.id)) return r;
            return { ...r, sponsors: [msg.sponsor, ...r.sponsors] };
          })
        );
      } else if (msg.type === 'quiz:participant_update') {
        setRounds((prev) =>
          prev.map((r) => {
            if (r.id !== msg.roundId) return r;
            const others = r.participants.filter(
              (p) => p.participantKey !== msg.participant.participantKey
            );
            const nextParticipants = [msg.participant, ...others];
            return {
              ...r,
              participants: nextParticipants,
              registeredCount: Math.max(r.registeredCount, nextParticipants.length),
            };
          })
        );
      } else if (msg.type === 'quiz:sync_state' && Array.isArray(msg.rounds)) {
        setRounds((prev) => {
          const mergedMap = new Map<string, QuizRound>();
          for (const r of msg.rounds) mergedMap.set(r.id, r);
          for (const r of prev) {
            if (!mergedMap.has(r.id)) mergedMap.set(r.id, r);
          }
          return Array.from(mergedMap.values());
        });
      }
    });
    return unsubscribe;
  }, [activeTrah.id, activeTrah.name]);

  // State sesi kuis aktif (Live Pop-up ala SiagaQu atau Sesi Latihan)
  const [activeSession, setActiveSession] = useState<ActiveQuizSessionState | null>(null);
  const [latestResultRecap, setLatestResultRecap] = useState<QuizPersonalRecap | null>(null);

  // Form Modal Buat & Posting Ronde Baru (+ cek kuota 5.000/jam + geser jadwal)
  const [isCreateRoundOpen, setIsCreateRoundOpen] = useState<boolean>(false);
  const [newRoundTitle, setNewRoundTitle] = useState<string>('');
  const [newRoundStartLocal, setNewRoundStartLocal] = useState<string>(() =>
    toLocalDateTimeInputValue(new Date(Date.now() + 20 * 60000))
  );
  const [newRoundDifficulty, setNewRoundDifficulty] = useState<QuizDifficulty>('campuran');
  const [newRoundScope, setNewRoundScope] = useState<QuizDataScope>('active_trah');
  const [newRoundPrizeNote, setNewRoundPrizeNote] = useState<string>(
    'Hadiah langsung antar-keluarga untuk Juara 1–3 & Tercepat'
  );
  const [newRoundTransferInfo, setNewRoundTransferInfo] = useState<string>(
    'Transfer langsung ke Bendahara Keluarga / Rekening Tuan Rumah'
  );
  const [shiftedFromLabel, setShiftedFromLabel] = useState<string>('');

  // Form Sponsor / Patungan Hadiah
  const [sponsorRoundId, setSponsorRoundId] = useState<string>('');
  const [sponsorNameInput, setSponsorNameInput] = useState<string>(userName || 'Keluarga');
  const [sponsorGenInput, setSponsorGenInput] = useState<string>('Generasi 3 (Cucu)');
  const [sponsorAmountInput, setSponsorAmountInput] = useState<string>('100000');
  const [sponsorChannelInput, setSponsorChannelInput] = useState<string>(
    'Transfer Langsung Antar-Keluarga (0% Potongan)'
  );
  const [sponsorMsgInput, setSponsorMsgInput] = useState<string>('');
  const [sponsorAlsoPlaying, setSponsorAlsoPlaying] = useState<boolean>(true);

  // Sesi Latihan difficulty picker
  const [practiceDifficulty, setPracticeDifficulty] = useState<QuizDifficulty>('campuran');

  // Kontrol akses real-time
  const [accessMode, setAccessMode] = useState<'free' | 'per_session' | 'monthly_pass'>('free');

  useEffect(() => {
    if (!sponsorRoundId && rounds.length > 0) {
      setSponsorRoundId(rounds[0].id);
    }
    if (!selectedRekapRoundId && rounds.length > 0) {
      setSelectedRekapRoundId(rounds[0].id);
    }
  }, [rounds, sponsorRoundId, selectedRekapRoundId]);

  // Timer tick setiap 1 detik untuk jadwal live, countdown 10 menit, dan auto-close
  useEffect(() => {
    const iv = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(iv);
  }, []);

  const finalizeActiveSession = useCallback(
    (autoClosed: boolean) => {
      setActiveSession((current) => {
        if (!current) return null;

        const now = Date.now();
        const elapsedSec = Math.max(1, Math.round((now - current.startedAtMs) / 1000));
        let correctCount = 0;
        let wrongCount = 0;
        let blankCount = 0;

        const details: QuizAnswerDetail[] = current.questions.map((q, idx) => {
          const picked = current.answers[idx];
          const isBlank = picked === null || picked === undefined;
          const isCorrect = !isBlank && picked === q.correctIndex;
          if (isBlank) blankCount += 1;
          else if (isCorrect) correctCount += 1;
          else wrongCount += 1;

          return {
            questionId: q.id,
            prompt: q.prompt,
            stage: q.stage,
            stageLabel: q.stageLabel,
            difficulty: q.difficulty,
            selectedIndex: picked ?? null,
            selectedText:
              picked !== null && picked !== undefined ? q.options[picked] ?? null : null,
            correctIndex: q.correctIndex,
            correctText: q.options[q.correctIndex] || '',
            isCorrect,
            isBlank,
            explanation: q.explanation,
          };
        });

        const totalQ = current.questions.length || 1;
        const score = Math.round((correctCount / totalQ) * 100);
        const participantKey = `user_${scopeKey}`;

        const recap: QuizPersonalRecap = {
          id: `recap-${current.roundId}-${now}`,
          roundId: current.roundId,
          roundTitle: current.title,
          trahId: activeTrah.id,
          trahName: activeTrah.name,
          mode: current.mode,
          difficulty: current.difficulty,
          participantName: userName || 'Peserta Keluarga',
          score,
          correctCount,
          wrongCount,
          blankCount,
          totalQuestions: totalQ,
          submitDurationSec: elapsedSec,
          autoClosed,
          finishedAt: new Date(now).toISOString(),
          details,
        };

        const updatedRecaps = savePersonalRecap(scopeKey, recap);
        setPersonalRecaps(updatedRecaps);
        setLatestResultRecap(recap);
        setSelectedRecapId(recap.id);

        if (current.mode === 'official') {
          markAlertHandledForRound(current.roundId);
          const answeredCount = totalQ - blankCount;
          const participantUpdate = {
            participantKey,
            name: userName || 'Peserta Keluarga',
            kinshipLabel: userKinship,
            registeredAt: new Date(current.startedAtMs).toISOString(),
            status: (answeredCount > 0 ? 'completed' : 'no_response') as
              | 'completed'
              | 'no_response',
            score,
            correctCount,
            answeredCount,
            totalQuestions: totalQ,
            submitDurationSec: answeredCount > 0 ? elapsedSec : null,
            submittedAt: new Date(now).toISOString(),
          };

          setRounds((prev) =>
            prev.map((r) => {
              if (r.id !== current.roundId) return r;
              const others = r.participants.filter((p) => p.participantKey !== participantKey);
              const nextParts = [participantUpdate, ...others];
              return {
                ...r,
                participants: nextParts,
                registeredCount: Math.max(r.registeredCount, nextParts.length),
              };
            })
          );

          publishQuizSyncEvent(activeTrah.name, {
            type: 'quiz:participant_update',
            trahId: activeTrah.id,
            roundId: current.roundId,
            participant: participantUpdate,
          });
        }

        if (autoClosed) {
          showNotification('Waktu 10 menit habis — Kuis otomatis ditutup (Auto-Close) & hasil tersimpan.');
        } else {
          showNotification(`Kuis selesai! Skor Anda ${score}/100 & rekapan tersimpan ke data Anda.`);
        }

        return null;
      });
    },
    [activeTrah.id, activeTrah.name, scopeKey, showNotification, userKinship, userName]
  );

  // Auto-Close tepat saat countdown 10 menit menyentuh 00:00
  useEffect(() => {
    if (!activeSession || activeSession.mode !== 'official' || !activeSession.endsAtMs) return;
    if (nowMs >= activeSession.endsAtMs) {
      finalizeActiveSession(true);
    }
  }, [activeSession, nowMs, finalizeActiveSession]);

  const startOfficialRoundQuiz = useCallback(
    (round: QuizRound, startImmediately = false) => {
      const roundMembers =
        round.dataScope === 'all_trah' && trahList.length > 0
          ? trahList.flatMap((t) => t.members || [])
          : activeTrah.members || [];

      if (roundMembers.length < 4) {
        showNotification('Minimal butuh 4 anggota silsilah untuk membentuk pilihan ganda kuis.');
        return;
      }

      const { questions } = composeQuizSessionQuestions(
        roundMembers,
        round.difficulty,
        round.questionSeed,
        10
      );
      if (questions.length === 0) {
        showNotification('Data silsilah belum cukup untuk membentuk pertanyaan.');
        return;
      }

      const now = Date.now();
      let effectiveRound = round;
      if (startImmediately && round.status !== 'live') {
        effectiveRound = {
          ...round,
          scheduledStartAt: new Date(now).toISOString(),
          status: 'live',
        };
        setRounds((prev) =>
          prev.map((r) => (r.id === effectiveRound.id ? effectiveRound : r))
        );
        publishQuizSyncEvent(activeTrah.name, {
          type: 'quiz:round_upsert',
          trahId: activeTrah.id,
          round: effectiveRound,
        });
      }

      const scheduledStartMs = new Date(effectiveRound.scheduledStartAt).getTime();
      const endsAtMs = Math.max(
        now + 15000,
        scheduledStartMs + (effectiveRound.durationSec || QUIZ_DURATION_SEC) * 1000
      );

      triggerSiagaQuizAlert(isMutedAlert);
      markAlertHandledForRound(effectiveRound.id);

      setLatestResultRecap(null);
      setActiveSession({
        mode: 'official',
        roundId: effectiveRound.id,
        title: effectiveRound.title,
        difficulty: effectiveRound.difficulty,
        questions,
        answers: new Array(questions.length).fill(null),
        currentIndex: 0,
        startedAtMs: now,
        endsAtMs,
        siagaAlertBanner: true,
      });
    },
    [activeTrah.id, activeTrah.members, activeTrah.name, isMutedAlert, showNotification, trahList]
  );

  // Watcher Otomatis: Saat jadwal ronde resmi tiba, tampilkan alert SiagaQu + getar + buka pop-up 10 menit!
  const autoTriggeredRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (activeSession || latestResultRecap) return;
    for (const r of rounds) {
      const snap = getRoundTimingSnapshot(r, nowMs);
      if (snap.phase === 'live' && !isAlertHandledForRound(r.id) && !autoTriggeredRef.current.has(r.id)) {
        autoTriggeredRef.current.add(r.id);
        startOfficialRoundQuiz(r, false);
        break;
      }
    }
  }, [rounds, nowMs, activeSession, latestResultRecap, startOfficialRoundQuiz]);

  const startPracticeSession = () => {
    if (targetMembers.length < 4) {
      showNotification('Tambahkan minimal 4 anggota silsilah terlebih dahulu untuk Sesi Latihan.');
      return;
    }
    const seed = `practice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const { questions } = composeQuizSessionQuestions(targetMembers, practiceDifficulty, seed, 10);
    if (questions.length === 0) {
      showNotification('Belum cukup data silsilah untuk membuat soal latihan.');
      return;
    }
    setLatestResultRecap(null);
    setActiveSession({
      mode: 'practice',
      roundId: seed,
      title: `Latihan Mandiri (${DIFFICULTY_META[practiceDifficulty].label})`,
      difficulty: practiceDifficulty,
      questions,
      answers: new Array(questions.length).fill(null),
      currentIndex: 0,
      startedAtMs: Date.now(),
      endsAtMs: null,
      siagaAlertBanner: false,
    });
  };

  const handleRegisterToRound = (round: QuizRound) => {
    const pKey = `user_${scopeKey}`;
    const already = round.participants.some((p) => p.participantKey === pKey);
    if (already) {
      showNotification('Anda sudah terdaftar di ronde ini.');
      return;
    }
    if (round.registeredCount >= round.maxQuota) {
      showNotification('Kuota ronde ini sudah penuh (5.000 peserta). Silakan pilih slot jam lain.');
      return;
    }
    const newEntry = {
      participantKey: pKey,
      name: userName || 'Peserta Keluarga',
      kinshipLabel: userKinship,
      registeredAt: new Date().toISOString(),
      status: 'registered' as const,
      score: 0,
      correctCount: 0,
      answeredCount: 0,
      totalQuestions: 10,
      submitDurationSec: null,
    };
    setRounds((prev) =>
      prev.map((r) =>
        r.id === round.id
          ? {
              ...r,
              participants: [...r.participants, newEntry],
              registeredCount: Math.max(r.registeredCount + 1, r.participants.length + 1),
            }
          : r
      )
    );
    publishQuizSyncEvent(activeTrah.name, {
      type: 'quiz:participant_update',
      trahId: activeTrah.id,
      roundId: round.id,
      participant: newEntry,
    });
    showNotification(`Terdaftar pada "${round.title}". Alert SiagaQu akan berbunyi saat waktu mulai.`);
  };

  // Cek kuota penjadwalan saat membuat ronde baru
  const newRoundQuotaCheck = useMemo(
    () =>
      checkScheduleSlotQuota(
        rounds,
        newRoundStartLocal ? new Date(newRoundStartLocal).toISOString() : new Date().toISOString(),
        MAX_HOURLY_QUIZ_QUOTA
      ),
    [rounds, newRoundStartLocal]
  );

  const handleCreateAndPostRound = (e: React.FormEvent) => {
    e.preventDefault();
    if (newRoundQuotaCheck.isAtLimit) {
      showNotification(
        'Kuota jam terpilih menyentuh limit 5.000 peserta. Pilih salah satu jam geseran yang tersedia terlebih dahulu.'
      );
      return;
    }
    const parsedDate = new Date(newRoundStartLocal);
    const isoStart = Number.isNaN(parsedDate.getTime())
      ? new Date(Date.now() + 15 * 60000).toISOString()
      : parsedDate.toISOString();

    const created: QuizRound = {
      id: `round-${Date.now().toString(36)}`,
      trahId: activeTrah.id,
      trahName: activeTrah.name,
      dataScope: newRoundScope,
      title: newRoundTitle.trim() || `Kuis ${activeTrah.name.split('(')[0].trim()}`,
      organizerName: userName || 'Panitia Keluarga',
      difficulty: newRoundDifficulty,
      scheduledStartAt: isoStart,
      durationSec: QUIZ_DURATION_SEC,
      maxQuota: MAX_HOURLY_QUIZ_QUOTA,
      registeredCount: 1,
      participants: [
        {
          participantKey: `user_${scopeKey}`,
          name: userName || 'Panitia Keluarga',
          kinshipLabel: userKinship,
          registeredAt: new Date().toISOString(),
          status: 'registered',
          score: 0,
          correctCount: 0,
          answeredCount: 0,
          totalQuestions: 10,
          submitDurationSec: null,
        },
      ],
      sponsors: [],
      prizeNote: newRoundPrizeNote.trim() || undefined,
      transferTargetInfo: newRoundTransferInfo.trim() || 'Transfer langsung antar-keluarga',
      wasRescheduledFrom: shiftedFromLabel || undefined,
      status: 'scheduled',
      questionSeed: `qseed-${Date.now().toString(36)}`,
      createdAt: new Date().toISOString(),
    };

    setRounds((prev) => [created, ...prev]);
    publishQuizSyncEvent(activeTrah.name, {
      type: 'quiz:round_upsert',
      trahId: activeTrah.id,
      round: created,
    });

    setSponsorRoundId(created.id);
    setSelectedRekapRoundId(created.id);
    setNewRoundTitle('');
    setShiftedFromLabel('');
    setIsCreateRoundOpen(false);
    showNotification(
      `Ronde "${created.title}" resmi diposting untuk pukul ${formatTimeOnlyHHMM(created.scheduledStartAt)}!`
    );
  };

  const handleAddSponsor = (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = sponsorRoundId || rounds[0]?.id;
    if (!targetId) {
      showNotification('Posting jadwal ronde terlebih dahulu sebelum menambah sponsor.');
      return;
    }
    const cleanAmount = Math.max(10000, parseInt(sponsorAmountInput.replace(/\D/g, ''), 10) || 0);
    const contrib = {
      id: `sp-${Date.now().toString(36)}`,
      sponsorName: sponsorNameInput.trim() || userName || 'Keluarga',
      generationLabel: sponsorGenInput.trim() || 'Generasi 3 (Cucu)',
      amount: cleanAmount,
      channelLabel: sponsorChannelInput.trim() || 'Transfer Langsung Antar-Keluarga',
      message: sponsorMsgInput.trim() || undefined,
      alsoPlaying: sponsorAlsoPlaying,
      createdAt: new Date().toISOString(),
    };

    setRounds((prev) =>
      prev.map((r) => {
        if (r.id !== targetId) return r;
        let nextParticipants = r.participants;
        if (sponsorAlsoPlaying) {
          const pKey = `user_${scopeKey}`;
          const exists = r.participants.some((p) => p.participantKey === pKey);
          if (!exists) {
            nextParticipants = [
              ...r.participants,
              {
                participantKey: pKey,
                name: contrib.sponsorName,
                kinshipLabel: contrib.generationLabel,
                registeredAt: new Date().toISOString(),
                status: 'registered',
                score: 0,
                correctCount: 0,
                answeredCount: 0,
                totalQuestions: 10,
                submitDurationSec: null,
                isSponsor: true,
              },
            ];
          } else {
            nextParticipants = r.participants.map((p) =>
              p.participantKey === pKey ? { ...p, isSponsor: true } : p
            );
          }
        }
        return {
          ...r,
          sponsors: [contrib, ...r.sponsors],
          participants: nextParticipants,
          registeredCount: Math.max(r.registeredCount, nextParticipants.length),
        };
      })
    );

    publishQuizSyncEvent(activeTrah.name, {
      type: 'quiz:sponsor_add',
      trahId: activeTrah.id,
      roundId: targetId,
      sponsor: contrib,
    });

    setSponsorMsgInput('');
    showNotification(
      `Patungan hadiah ${formatRupiah(cleanAmount)} dari ${contrib.sponsorName} tercatat (0% potongan)!`
    );
  };

  // Tandai peserta yang masih status 'registered' (belum submit saat ronde berakhir) menjadi 'no_response' di bagian paling bawah
  const handleFinalizeRoundRecap = (roundId: string) => {
    setRounds((prev) =>
      prev.map((r) => {
        if (r.id !== roundId) return r;
        const updatedParticipants = r.participants.map((p) =>
          p.answeredCount === 0
            ? { ...p, status: 'no_response' as const, score: 0, submitDurationSec: null }
            : p
        );
        return { ...r, status: 'completed', participants: updatedParticipants };
      })
    );
    showNotification('Rekap ronde dikunci: peserta 0 jawaban ditempatkan di bagian paling bawah.');
  };

  const activeRekapRound = useMemo(
    () => rounds.find((r) => r.id === selectedRekapRoundId) || rounds[0] || null,
    [rounds, selectedRekapRoundId]
  );

  const sortedRoundParticipants = useMemo(() => {
    if (!activeRekapRound) return [];
    const timing = getRoundTimingSnapshot(activeRekapRound, nowMs);
    return sortRoundParticipantsForRecap(
      activeRekapRound.participants,
      timing.phase === 'ended' || activeRekapRound.status === 'completed'
    );
  }, [activeRekapRound, nowMs]);

  const displayedRecapDetail = useMemo(
    () => personalRecaps.find((r) => r.id === selectedRecapId) || latestResultRecap || null,
    [personalRecaps, selectedRecapId, latestResultRecap]
  );

  const accessPolicy = useMemo(() => {
    const highestBooked = rounds.reduce((mx, r) => Math.max(mx, r.registeredCount), 0);
    const liveTraffic = Math.max(highestBooked, liveRelayTraffic);
    return getQuizAccessPolicy(liveTraffic, accessMode);
  }, [rounds, liveRelayTraffic, accessMode]);

  const activeCountdownSec = useMemo(() => {
    if (!activeSession || !activeSession.endsAtMs) return null;
    return Math.max(0, Math.ceil((activeSession.endsAtMs - nowMs) / 1000));
  }, [activeSession, nowMs]);

  return (
    <div className="bg-white text-stone-900 min-h-full pb-20">
      <div className="max-w-4xl mx-auto">
        {/* ========================================================= */}
        {/* HEADER RINGKAS MOBILE-FIRST & PILIHAN SUMBER DATA SILSILAH */}
        {/* ========================================================= */}
        <div className="px-4 pt-3 pb-3 border-b border-stone-200 bg-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold tracking-tight text-stone-900 leading-snug">
                Kuis Trah Silsilah
              </h2>
              <p className="text-xs text-stone-600 mt-0.5 tabular-nums">
                {dataScope === 'all_trah'
                  ? `Gabungan ${trahList.length} Trah`
                  : activeTrah.name}{' '}
                · {bankInfo.totalMembers} anggota · {bankInfo.potentialTotal} bank soal (3 Stage)
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsMutedAlert((m) => !m)}
              className="min-h-[44px] min-w-[44px] px-2.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 flex items-center justify-center gap-1.5 text-xs font-bold shrink-0"
              title={isMutedAlert ? 'Suara Alert SiagaQu Dimatikan' : 'Suara Alert SiagaQu Aktif'}
            >
              {isMutedAlert ? <VolumeX className="w-4 h-4 text-stone-500" /> : <Volume2 className="w-4 h-4 text-emerald-700" />}
              <span className="hidden sm:inline">{isMutedAlert ? 'Bisu' : 'Suara'}</span>
            </button>
          </div>

          {/* Toggle Sumber Data: Trah Aktif vs Semua Pilar Trah */}
          <div className="mt-3 flex items-center gap-1.5 p-1 bg-stone-100 rounded-xl w-full sm:w-auto sm:inline-flex">
            <button
              type="button"
              onClick={() => setDataScope('active_trah')}
              className={`flex-1 sm:flex-none min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                dataScope === 'active_trah'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Trah Aktif ({activeTrah.members.length})
            </button>
            <button
              type="button"
              onClick={() => setDataScope('all_trah')}
              className={`flex-1 sm:flex-none min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                dataScope === 'all_trah'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Gabung Semua Trah ({trahList.reduce((s, t) => s + t.members.length, 0)})
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* NAVIGASI SUBMENU KUIS (NYAMAN JEMPOL, BERGARIS BAWAH)     */}
        {/* ========================================================= */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-stone-200 px-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center justify-between sm:justify-start sm:gap-4 min-w-max">
            {(
              [
                { id: 'jadwal', label: 'Jadwal & Daftar' },
                { id: 'sponsor', label: 'Sponsor Hadiah' },
                { id: 'latihan', label: 'Sesi Latihan' },
                { id: 'rekap', label: `Rekap (${personalRecaps.length})` },
                { id: 'aturan', label: 'Aturan & Nama Sama' },
              ] as Array<{ id: QuizSubTab; label: string }>
            ).map((tab) => {
              const active = subTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSubTab(tab.id)}
                  className={`min-h-[44px] px-3 py-2.5 text-xs font-extrabold border-b-2 transition whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-emerald-700 text-emerald-800'
                      : 'border-transparent text-stone-500 hover:text-stone-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ========================================================= */}
        {/* TAB 1: PENDAFTARAN, JADWAL RESMI & KUOTA 5.000/JAM        */}
        {/* ========================================================= */}
        {subTab === 'jadwal' && (
          <div className="divide-y divide-stone-200">
            <div className="px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 bg-stone-50/70">
              <div>
                <h3 className="text-sm font-extrabold text-stone-900">
                  Jadwal Ronde Terposting
                </h3>
                <p className="text-xs text-stone-600 mt-0.5">
                  Timer 10 menit tersinkronisasi · Kuota 5.000 peserta/jam · Alert SiagaQu otomatis
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateRoundOpen(true)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold flex items-center gap-1.5 active:scale-[0.98] transition whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Posting Ronde Baru</span>
              </button>
            </div>

            {rounds.length === 0 ? (
              <div className="px-4 py-8 text-center bg-white space-y-2">
                <p className="text-sm font-extrabold text-stone-800">
                  Belum Ada Jadwal Ronde Kuis Terposting
                </p>
                <p className="text-xs text-stone-500 max-w-sm mx-auto">
                  Silakan tekan tombol &ldquo;Posting Ronde Baru&rdquo; untuk menjadwalkan kuis keluarga
                  secara real-time atau buka tab Sesi Latihan untuk pemanasan mandiri.
                </p>
              </div>
            ) : (
              rounds.map((round) => {
              const timing = getRoundTimingSnapshot(round, nowMs);
              const totalPrize = getTotalSponsorPool(round);
              const isRegistered = round.participants.some(
                (p) => p.participantKey === `user_${scopeKey}`
              );
              const diffInfo = DIFFICULTY_META[round.difficulty];

              return (
                <div key={round.id} className="px-4 py-4 bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-stone-500 tabular-nums">
                        {formatIndonesianDateTime(round.scheduledStartAt)} ·{' '}
                        {round.wasRescheduledFrom
                          ? `Digeser dari ${round.wasRescheduledFrom}`
                          : 'Jadwal Pasti'}
                      </p>
                      <h4 className="text-base font-extrabold text-stone-900 mt-0.5 leading-snug">
                        {round.title}
                      </h4>
                      <p className="text-xs text-stone-700 mt-1">
                        Tingkat Soal: <strong className="text-stone-900">{diffInfo.label}</strong> —{' '}
                        {diffInfo.shortDesc}
                      </p>
                      <p className="text-xs text-stone-600 mt-1 tabular-nums">
                        Kuota: {round.registeredCount.toLocaleString('id-ID')} /{' '}
                        {round.maxQuota.toLocaleString('id-ID')} peserta · Durasi 10 menit ·{' '}
                        Panitia: {round.organizerName}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-[11px] font-semibold text-stone-500">Total Hadiah</p>
                      <p className="text-base font-extrabold text-emerald-800 tabular-nums">
                        {formatRupiah(totalPrize)}
                      </p>
                      <p className="text-[11px] font-bold text-stone-600 mt-0.5 tabular-nums">
                        {timing.phase === 'live'
                          ? `LIVE · ${formatTimerClock(timing.remainingSec)}`
                          : timing.phase === 'ended'
                          ? 'Selesai'
                          : `Mulai ${formatTimerClock(timing.startsInSec)}`}
                      </p>
                    </div>
                  </div>

                  {/* Aksi Jempol */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {!isRegistered && timing.phase !== 'ended' && (
                      <button
                        type="button"
                        onClick={() => handleRegisterToRound(round)}
                        className="min-h-[44px] px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-extrabold flex items-center gap-1.5 active:scale-[0.98] transition"
                      >
                        <ListChecks className="w-4 h-4" />
                        <span>Daftar Ronde</span>
                      </button>
                    )}

                    {isRegistered && timing.phase === 'upcoming' && (
                      <span className="min-h-[44px] px-3 py-2 rounded-xl border border-emerald-700/30 bg-emerald-50 text-emerald-900 text-xs font-bold flex items-center gap-1.5">
                        <Check className="w-4 h-4" />
                        <span>Terdaftar (Tunggu Alert)</span>
                      </span>
                    )}

                    {timing.phase === 'live' ? (
                      <button
                        type="button"
                        onClick={() => startOfficialRoundQuiz(round, false)}
                        className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-extrabold flex items-center gap-1.5 active:scale-[0.98] transition"
                      >
                        <BellRing className="w-4 h-4" />
                        <span>Masuk Pop-up Kuis Live</span>
                      </button>
                    ) : timing.phase === 'upcoming' ? (
                      <button
                        type="button"
                        onClick={() => startOfficialRoundQuiz(round, true)}
                        className="min-h-[44px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-900 text-xs font-bold flex items-center gap-1.5 active:scale-[0.98] transition"
                        title="Mulai ronde sekarang dan siarkan alert SiagaQu live ke semua perangkat peserta"
                      >
                        <BellRing className="w-4 h-4 text-emerald-700" />
                        <span>Mulai Ronde Sekarang</span>
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => {
                        setSponsorRoundId(round.id);
                        setSubTab('sponsor');
                      }}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-xs font-bold flex items-center gap-1.5"
                    >
                      <HeartHandshake className="w-4 h-4 text-emerald-700" />
                      <span>Tambah Patungan</span>
                    </button>
                  </div>
                </div>
              );
            })
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: JADI SPONSOR / PATUNGAN HADIAH (0% POTONGAN)       */}
        {/* ========================================================= */}
        {subTab === 'sponsor' && (
          <div className="divide-y divide-stone-200">
            <div className="px-4 py-4 bg-stone-50/70">
              <h3 className="text-sm font-extrabold text-stone-900">
                Patungan Hadiah Keluarga (0% Potongan Pengembang)
              </h3>
              <p className="text-xs text-stone-700 mt-1 leading-relaxed">
                Terbuka untuk seluruh anggota termasuk generasi ketiga (cucu). Dana hadiah ditransfer
                langsung antar-keluarga tanpa potongan platform.{' '}
                <strong className="text-emerald-800">
                  Sponsor juga tetap diperbolehkan ikut bermain sebagai peserta.
                </strong>
              </p>
            </div>

            <form onSubmit={handleAddSponsor} className="px-4 py-4 space-y-3 bg-white">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Pilih Ronde Sasaran
                  </label>
                  <select
                    value={sponsorRoundId}
                    onChange={(e) => setSponsorRoundId(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 border border-stone-300 rounded-xl text-sm font-semibold bg-white text-stone-900"
                  >
                    {rounds.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title} ({DIFFICULTY_META[r.difficulty].label})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Nama Sponsor / Keluarga
                  </label>
                  <input
                    type="text"
                    value={sponsorNameInput}
                    onChange={(e) => setSponsorNameInput(e.target.value)}
                    placeholder="Contoh: Cucu / Keluarga Samud"
                    className="w-full min-h-[44px] px-3 py-2 border border-stone-300 rounded-xl text-sm font-semibold text-stone-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Peran / Generasi Keluarga
                  </label>
                  <select
                    value={sponsorGenInput}
                    onChange={(e) => setSponsorGenInput(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 border border-stone-300 rounded-xl text-sm font-semibold bg-white text-stone-900"
                  >
                    <option value="Generasi 1–2 (Sesepuh/Orang Tua)">
                      Generasi 1–2 (Sesepuh / Orang Tua)
                    </option>
                    <option value="Generasi 3 (Cucu)">Generasi 3 (Cucu)</option>
                    <option value="Generasi 4+ (Cicit & Menantu)">
                      Generasi 4+ (Cicit &amp; Menantu)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Nominal Patungan (Rp)
                  </label>
                  <input
                    type="number"
                    min={10000}
                    step={10000}
                    value={sponsorAmountInput}
                    onChange={(e) => setSponsorAmountInput(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 border border-stone-300 rounded-xl text-sm font-extrabold tabular-nums text-stone-900"
                    required
                  />
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {['50000', '100000', '250000', '500000'].map((nom) => (
                      <button
                        key={nom}
                        type="button"
                        onClick={() => setSponsorAmountInput(nom)}
                        className="px-2.5 py-1 rounded-lg border border-stone-300 text-[11px] font-bold text-stone-800 hover:bg-stone-100 tabular-nums"
                      >
                        {formatRupiah(Number(nom))}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Jalur Transfer Langsung Antar-Keluarga
                </label>
                <input
                  type="text"
                  value={sponsorChannelInput}
                  onChange={(e) => setSponsorChannelInput(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 border border-stone-300 rounded-xl text-sm text-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Pesan Semangat untuk Peserta (Opsional)
                </label>
                <input
                  type="text"
                  value={sponsorMsgInput}
                  onChange={(e) => setSponsorMsgInput(e.target.value)}
                  placeholder="Contoh: Tambahan hadiah karena soal mode Sulit!"
                  className="w-full min-h-[44px] px-3 py-2 border border-stone-300 rounded-xl text-sm text-stone-900"
                />
              </div>

              <label className="flex items-center gap-2.5 py-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sponsorAlsoPlaying}
                  onChange={(e) => setSponsorAlsoPlaying(e.target.checked)}
                  className="w-5 h-5 accent-emerald-700"
                />
                <span className="text-xs font-bold text-stone-800">
                  Saya juga ikut bermain sebagai peserta di ronde ini
                </span>
              </label>

              <button
                type="submit"
                className="w-full sm:w-auto min-h-[48px] px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-extrabold flex items-center justify-center gap-2 active:scale-[0.98] transition"
              >
                <HeartHandshake className="w-4 h-4" />
                <span>Catat Patungan Hadiah</span>
              </button>
            </form>

            {/* Daftar Sponsor Tercatat */}
            <div className="px-4 py-3 bg-stone-50/60">
              <h4 className="text-xs font-extrabold text-stone-700 uppercase tracking-wide">
                Daftar Kontribusi Sponsor Terbuka
              </h4>
            </div>
            {(rounds.find((r) => r.id === sponsorRoundId)?.sponsors || []).length === 0 ? (
              <div className="px-4 py-6 text-xs text-stone-500">
                Belum ada patungan hadiah pada ronde terpilih. Jadilah sponsor pertama keluarga!
              </div>
            ) : (
              (rounds.find((r) => r.id === sponsorRoundId)?.sponsors || []).map((sp) => (
                <div
                  key={sp.id}
                  className="px-4 py-3 flex items-start justify-between gap-3 bg-white"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-stone-900">
                      {sp.sponsorName}{' '}
                      <span className="text-xs font-semibold text-stone-500">
                        · {sp.generationLabel}
                      </span>
                    </p>
                    <p className="text-xs text-stone-600 mt-0.5">
                      {sp.channelLabel} · {sp.alsoPlaying ? 'Ikut bermain juga' : 'Sponsor saja'}
                    </p>
                    {sp.message && (
                      <p className="text-xs text-stone-700 italic mt-1">&ldquo;{sp.message}&rdquo;</p>
                    )}
                  </div>
                  <span className="text-sm font-extrabold text-emerald-800 tabular-nums shrink-0">
                    {formatRupiah(sp.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: SESI LATIHAN MANDIRI (PEMANASAN DAYA INGAT)        */}
        {/* ========================================================= */}
        {subTab === 'latihan' && (
          <div className="divide-y divide-stone-200">
            <div className="px-4 py-4 bg-stone-50/70">
              <h3 className="text-sm font-extrabold text-stone-900">
                Sesi Latihan Daya Ingat Mandiri
              </h3>
              <p className="text-xs text-stone-600 mt-1">
                Berlatih mengingat nama, kota, dan tahun kelahiran keluarga tanpa tekanan hadiah atau
                timer 10 menit resmi. Pilihan ganda tetap bebas diganti sebelum selesai.
              </p>
            </div>

            {/* Ringkasan Kapasitas Bank Soal 3 Stage */}
            <div className="px-4 py-3 grid grid-cols-3 gap-2 text-center bg-white">
              <div className="py-2 border-b border-stone-200">
                <p className="text-xs text-stone-500 font-semibold">Stage 1 · Nama</p>
                <p className="text-lg font-extrabold text-stone-900 tabular-nums">
                  {bankInfo.byStage[1]}
                </p>
              </div>
              <div className="py-2 border-b border-stone-200">
                <p className="text-xs text-stone-500 font-semibold">Stage 2 · Kota</p>
                <p className="text-lg font-extrabold text-stone-900 tabular-nums">
                  {bankInfo.byStage[2]}
                </p>
              </div>
              <div className="py-2 border-b border-stone-200">
                <p className="text-xs text-stone-500 font-semibold">Stage 3 · Tahun</p>
                <p className="text-lg font-extrabold text-stone-900 tabular-nums">
                  {bankInfo.byStage[3]}
                </p>
              </div>
            </div>

            {bankInfo.membersWithCityCount < 3 && (
              <div className="px-4 py-2.5 bg-amber-50/70 text-xs text-amber-900 font-medium">
                Info: Baru {bankInfo.membersWithCityCount} anggota memiliki kolom Kota terisi. Isi
                kolom Kota di menu Tabel untuk memperkaya soal Stage 2 hingga ~300 pertanyaan.
              </div>
            )}

            {/* Pilihan 4 Tingkat Kesulitan Latihan */}
            <div className="divide-y divide-stone-200 bg-white">
              {(['ringan', 'medium', 'sulit', 'campuran'] as QuizDifficulty[]).map((diff) => {
                const selected = practiceDifficulty === diff;
                const info = DIFFICULTY_META[diff];
                return (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => setPracticeDifficulty(diff)}
                    className={`w-full min-h-[56px] px-4 py-3 text-left flex items-center justify-between gap-3 transition ${
                      selected ? 'bg-emerald-50/70' : 'hover:bg-stone-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-stone-900">{info.label}</p>
                      <p className="text-xs text-stone-600 mt-0.5">{info.shortDesc}</p>
                    </div>
                    <span
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selected
                          ? 'border-emerald-700 bg-emerald-700 text-white'
                          : 'border-stone-300 bg-white'
                      }`}
                    >
                      {selected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="px-4 py-4 bg-white">
              <button
                type="button"
                onClick={startPracticeSession}
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-extrabold flex items-center justify-center gap-2 active:scale-[0.98] transition"
              >
                <Play className="w-4 h-4" />
                <span>Mulai Sesi Latihan (10 Soal Acak)</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: REKAPAN PRIBADI & REKAP PESERTA RONDE              */}
        {/* ========================================================= */}
        {subTab === 'rekap' && (
          <div className="divide-y divide-stone-200">
            {/* Bagian A: Riwayat Rekapan Pribadi */}
            <div className="px-4 py-3.5 bg-stone-50/70 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-stone-900">
                  Rekapan Pribadi Tersimpan ({personalRecaps.length})
                </h3>
                <p className="text-xs text-stone-600">
                  Ketuk sesi untuk melihat rincian betul, salah (tercatat), atau kosong.
                </p>
              </div>
              <History className="w-4 h-4 text-stone-500 shrink-0" />
            </div>

            {personalRecaps.length === 0 ? (
              <div className="px-4 py-6 text-xs text-stone-500 bg-white">
                Belum ada riwayat kuis atau latihan tersimpan pada akun Anda.
              </div>
            ) : (
              personalRecaps.slice(0, 12).map((rec) => (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => setSelectedRecapId(rec.id)}
                  className="w-full min-h-[56px] px-4 py-3 text-left flex items-center justify-between gap-3 bg-white hover:bg-stone-50 transition"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-stone-500 font-semibold tabular-nums">
                      {rec.mode === 'official' ? 'Ronde Resmi' : 'Latihan'} ·{' '}
                      {DIFFICULTY_META[rec.difficulty].label} ·{' '}
                      {formatIndonesianDateTime(rec.finishedAt)}
                    </p>
                    <p className="text-sm font-extrabold text-stone-900 truncate mt-0.5">
                      {rec.roundTitle}
                    </p>
                    <p className="text-xs text-stone-600 tabular-nums mt-0.5">
                      Betul {rec.correctCount} · Salah {rec.wrongCount} · Kosong {rec.blankCount} ·{' '}
                      Waktu {formatTimerClock(rec.submitDurationSec)}
                      {rec.autoClosed ? ' · Auto-Close' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-base font-extrabold text-emerald-800 tabular-nums">
                      {rec.score}
                    </span>
                    <ChevronRight className="w-4 h-4 text-stone-400" />
                  </div>
                </button>
              ))
            )}

            {/* Bagian B: Rekap Peserta Ronde (Non-Responden di Paling Bawah) */}
            <div className="px-4 py-3.5 bg-stone-50/70 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-stone-900">
                  Rekap Peserta Ronde Resmi
                </h3>
                <p className="text-xs text-stone-600">
                  Peserta dengan 0 jawaban / tidak merespons otomatis ditempatkan di paling bawah.
                </p>
              </div>
              {activeRekapRound && (
                <div className="flex items-center gap-2">
                  <select
                    value={activeRekapRound.id}
                    onChange={(e) => setSelectedRekapRoundId(e.target.value)}
                    className="min-h-[40px] px-2.5 py-1 border border-stone-300 rounded-xl text-xs font-bold bg-white text-stone-900"
                  >
                    {rounds.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleFinalizeRoundRecap(activeRekapRound.id)}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-xs font-bold text-stone-800"
                  >
                    Tutup &amp; Rekap Ronde
                  </button>
                </div>
              )}
            </div>

            {sortedRoundParticipants.map((p, idx) => {
              const isNoResponse = p.answeredCount === 0 || p.status === 'no_response';
              return (
                <div
                  key={p.participantKey}
                  className={`px-4 py-3 flex items-center justify-between gap-3 ${
                    isNoResponse ? 'bg-stone-50 text-stone-500' : 'bg-white text-stone-900'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 text-xs font-extrabold tabular-nums text-stone-500">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold truncate">
                        {p.name}
                        {p.isSponsor ? ' (Sponsor)' : ''}
                      </p>
                      <p className="text-xs text-stone-500 tabular-nums">
                        {p.kinshipLabel} ·{' '}
                        {isNoResponse
                          ? '0 Jawaban · Tidak Merespons / HP Mati'
                          : `${p.answeredCount}/${p.totalQuestions} terjawab · Kecepatan ${formatTimerClock(
                              p.submitDurationSec || 0
                            )}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`text-sm font-extrabold tabular-nums ${
                        isNoResponse ? 'text-stone-400' : 'text-emerald-800'
                      }`}
                    >
                      {isNoResponse ? '0' : p.score}
                    </p>
                    <p className="text-[11px] text-stone-500">
                      {isNoResponse ? 'Kosong' : `${p.correctCount} benar`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 5: TATA CARA, SOLUSI NAMA SAMA & KONTROL AKSES         */}
        {/* ========================================================= */}
        {subTab === 'aturan' && (
          <div className="divide-y divide-stone-200 bg-white">
            {/* Solusi Nama Yang Sama */}
            <div className="px-4 py-4">
              <h3 className="text-sm font-extrabold text-stone-900">
                01. Solusi Jika Ada Nama yang Sama (Disambiguasi Otomatis)
              </h3>
              <p className="text-xs text-stone-700 mt-1.5 leading-relaxed">
                Sistem otomatis mendeteksi anggota dengan nama identik di silsilah dan menyertakan
                penanda nasab (<strong>Bin/Binti Orang Tua</strong>, <strong>Generasi</strong>,
                serta atribut aman yang tidak membocorkan jawaban) pada soal maupun pilihan ganda,
                sehingga tidak pernah ada dua opsi jawaban membingungkan.
              </p>

              <div className="mt-3 border-t border-stone-200 pt-2.5">
                <p className="text-xs font-bold text-stone-800 tabular-nums">
                  Hasil Deteksi pada Data Aktif ({bankInfo.totalMembers} anggota):{' '}
                  {bankInfo.duplicateNames.length === 0
                    ? 'Tidak ditemukan nama kembar identik saat ini (fitur tetap siaga otomatis).'
                    : `Ditemukan ${bankInfo.duplicateNames.length} kelompok nama sama:`}
                </p>
                {bankInfo.duplicateNames.length > 0 && (
                  <div className="mt-2 divide-y divide-stone-100">
                    {bankInfo.duplicateNames.map((grp) => (
                      <div key={grp.normalizedName} className="py-2 text-xs text-stone-700">
                        <span className="font-extrabold text-stone-900">
                          &ldquo;{grp.displayName}&rdquo; ({grp.count} orang):{' '}
                        </span>
                        <span>{grp.resolvedLabels.join('  |  ')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Tata Cara & Syarat Ketentuan */}
            <div className="px-4 py-4 space-y-2.5">
              <h3 className="text-sm font-extrabold text-stone-900">
                02. Tata Cara &amp; Syarat Ketentuan Kuis Resmi
              </h3>
              <ol className="list-decimal pl-5 space-y-2 text-xs text-stone-700 leading-relaxed">
                <li>
                  <strong>Alert ala SiagaQu &amp; Pop-up Langsung:</strong> Saat jam ronde resmi
                  tiba, aplikasi membunyikan nada peringatan dan getar lalu langsung membuka pop-up
                  kuis berdurasi <strong>10 menit</strong> yang menutup penuh layar kuis.
                </li>
                <li>
                  <strong>10 Soal Pilihan Ganda Bebas Diganti:</strong> Mode{' '}
                  <strong>Campuran</strong> memilih acak{' '}
                  <strong>4 Ringan + 3 Medium + 3 Sulit</strong> dari bank hingga ~300 soal (Stage
                  1 Nama, Stage 2 Kota, Stage 3 Tahun Kelahiran). Jawaban boleh diganti berkali-kali
                  selama timer berjalan sebelum Submit atau Auto-Close.
                </li>
                <li>
                  <strong>Auto-Close 10 Menit:</strong> Begitu countdown menyentuh 00:00, pop-up
                  otomatis tertutup dan sistem langsung merekam jawaban yang sudah terisi serta
                  menampilkan ringkasan skor pribadi Anda.
                </li>
                <li>
                  <strong>Penentuan Pemenang &amp; Rekap:</strong> Diurutkan dari skor tertinggi
                  lalu kecepatan submit. Peserta terdaftar yang tidak merespons atau HP-nya mati
                  tetap dicatat di bagian paling bawah dengan status <strong>0 jawaban</strong>.
                </li>
                <li>
                  <strong>Sponsor Terbuka (0% Potongan):</strong> Siapa pun di keluarga (termasuk
                  cucu/generasi ketiga) boleh berpatungan hadiah via transfer langsung antar-keluarga
                  dan tetap boleh ikut bermain.
                </li>
              </ol>
            </div>

            {/* Kontrol Akses & Pemisahan Cetak Silsilah */}
            <div className="px-4 py-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-extrabold text-stone-900">
                    03. Kontrol Kapasitas Real-Time &amp; Pemisahan Fasilitas Cetak
                  </h3>
                  <p className="text-xs text-stone-600 mt-1">
                    {accessPolicy.statusSummary}
                  </p>
                  <p className="text-xs text-stone-500 mt-1">
                    {accessPolicy.printDocumentSeparateNote}
                  </p>
                </div>
                <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <div className="min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-xs font-bold text-stone-700 flex items-center tabular-nums">
                  Trafik Real-Time Relay: {liveRelayTraffic.toLocaleString('id-ID')} perangkat aktif
                </div>
                <select
                  value={accessMode}
                  onChange={(e) => {
                    const m = e.target.value as 'free' | 'per_session' | 'monthly_pass';
                    setAccessMode(m);
                    saveQuizAccessMode(m);
                  }}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 text-xs font-bold bg-white text-stone-900"
                >
                  <option value="free">Mode Gratis (Di bawah Kuota)</option>
                  <option value="per_session">Mode Tarif Ringan per Sesi (Rp 2.000)</option>
                  <option value="monthly_pass">Mode Paket Bulanan (Rp 15.000)</option>
                </select>
                {onOpenPrintBook && (
                  <button
                    type="button"
                    onClick={onOpenPrintBook}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl border border-emerald-700 text-emerald-800 text-xs font-extrabold hover:bg-emerald-50"
                  >
                    Buka Fasilitas Cetak Silsilah (Terpisah)
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL BUAT & POSTING RONDE BARU (+ CEK KUOTA 5.000/JAM)   */}
      {/* ========================================================= */}
      {isCreateRoundOpen && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-end sm:items-center justify-center">
          <div className="bg-white text-stone-900 w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-4 py-3.5 border-b border-stone-200 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-stone-900">
                Buat &amp; Posting Jadwal Ronde
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateRoundOpen(false)}
                className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-stone-500 hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAndPostRound} className="p-4 space-y-3.5 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Judul Ronde</label>
                <input
                  type="text"
                  value={newRoundTitle}
                  onChange={(e) => setNewRoundTitle(e.target.value)}
                  placeholder={`Contoh: Kuis Arisan ${activeTrah.name.split('(')[0].trim()}`}
                  className="w-full min-h-[44px] px-3 py-2 border border-stone-300 rounded-xl text-sm font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Jadwal Mulai (Durasi 10 Menit)
                  </label>
                  <input
                    type="datetime-local"
                    value={newRoundStartLocal}
                    onChange={(e) => {
                      setNewRoundStartLocal(e.target.value);
                      setShiftedFromLabel('');
                    }}
                    className="w-full min-h-[44px] px-3 py-2 border border-stone-300 rounded-xl text-sm font-bold tabular-nums"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Cakupan Data Anggota
                  </label>
                  <select
                    value={newRoundScope}
                    onChange={(e) => setNewRoundScope(e.target.value as QuizDataScope)}
                    className="w-full min-h-[44px] px-3 py-2 border border-stone-300 rounded-xl text-sm font-semibold bg-white"
                  >
                    <option value="active_trah">Trah Aktif Saja</option>
                    <option value="all_trah">Gabung Semua Pilar Trah</option>
                  </select>
                </div>
              </div>

              {/* Pilihan Tingkat Kesulitan + Pemicu Hadiah Sponsor */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Tingkat Soal (Tampil di Pendaftaran &amp; Pemicu Sponsor)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['ringan', 'medium', 'sulit', 'campuran'] as QuizDifficulty[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setNewRoundDifficulty(d)}
                      className={`min-h-[44px] p-2.5 rounded-xl border text-left transition ${
                        newRoundDifficulty === d
                          ? 'border-emerald-700 bg-emerald-50 text-emerald-950'
                          : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <p className="text-xs font-extrabold">{DIFFICULTY_META[d].label}</p>
                      <p className="text-[11px] text-stone-600 leading-tight mt-0.5">
                        {DIFFICULTY_META[d].sponsorHint}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pengecekan Kuota Per Jam (5.000/jam) & Geser Jadwal */}
              <div className="pt-2 border-t border-stone-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-stone-800 tabular-nums">
                    Kuota Jam {newRoundQuotaCheck.hourKey}:{' '}
                    {newRoundQuotaCheck.currentBooked.toLocaleString('id-ID')} /{' '}
                    {newRoundQuotaCheck.maxQuota.toLocaleString('id-ID')}
                  </p>
                  <span className="text-[11px] font-semibold text-emerald-800 tabular-nums">
                    Tersisa {newRoundQuotaCheck.remaining.toLocaleString('id-ID')} slot
                  </span>
                </div>

                {newRoundQuotaCheck.isAtLimit && (
                  <div className="p-3 rounded-xl border border-amber-400 bg-amber-50 text-amber-950 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <p className="text-xs font-bold leading-snug">
                        Kuota jam pilihan sedang menyentuh limit 5.000 peserta! Silakan mundurkan
                        atau majukan jadwal sebelum diposting:
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {newRoundQuotaCheck.suggestedSlots.map((slot) => (
                        <button
                          key={slot.iso}
                          type="button"
                          onClick={() => {
                            const prevFormatted = newRoundStartLocal
                              ? formatTimeOnlyHHMM(new Date(newRoundStartLocal).toISOString())
                              : '';
                            setShiftedFromLabel(prevFormatted);
                            setNewRoundStartLocal(toLocalDateTimeInputValue(new Date(slot.iso)));
                            showNotification(
                              `Jadwal digeser ke ${slot.timeLabel} (${slot.shiftLabel}).`
                            );
                          }}
                          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white border border-amber-400 hover:bg-amber-100 text-xs font-extrabold text-stone-900 tabular-nums"
                        >
                          {slot.timeLabel} ({slot.shiftLabel})
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Info Transfer Hadiah Antar-Keluarga
                </label>
                <input
                  type="text"
                  value={newRoundTransferInfo}
                  onChange={(e) => setNewRoundTransferInfo(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 border border-stone-300 rounded-xl text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={newRoundQuotaCheck.isAtLimit}
                className={`w-full min-h-[48px] rounded-xl text-sm font-extrabold transition ${
                  newRoundQuotaCheck.isAtLimit
                    ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                    : 'bg-emerald-700 hover:bg-emerald-800 text-white active:scale-[0.98]'
                }`}
              >
                {newRoundQuotaCheck.isAtLimit
                  ? 'Pilih Jam Geseran Terlebih Dahulu'
                  : 'Posting Jadwal Ronde Resmi'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* POP-UP INTERAKTIF KUIS PENUH (ALERT SIAGAQU + 10 MENIT)   */}
      {/* ========================================================= */}
      {activeSession && (
        <div className="fixed inset-0 z-50 bg-white text-stone-900 flex flex-col">
          {/* Header Pop-up: Info Alert SiagaQu + Countdown 10 Menit Tersinkron */}
          <div className="px-4 py-3 border-b border-stone-200 bg-stone-900 text-white flex items-center justify-between gap-3 shrink-0">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                {activeSession.mode === 'official' ? (
                  <>
                    <BellRing className="w-3.5 h-3.5" />
                    <span>ALERT SIAGAQU · KUIS RESMI BERJALAN</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>SESI LATIHAN MANDIRI</span>
                  </>
                )}
              </p>
              <h3 className="text-sm font-extrabold truncate">{activeSession.title}</h3>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {activeSession.mode === 'official' && activeCountdownSec !== null ? (
                <div className="px-3 py-1.5 rounded-xl bg-amber-400 text-stone-950 font-extrabold text-sm tabular-nums flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>{formatTimerClock(activeCountdownSec)}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveSession(null)}
                  className="min-h-[40px] min-w-[40px] rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center"
                  title="Tutup Latihan"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Stepper Nomor Soal 1..10 (Ketuk untuk lompat & ubah jawaban kapan saja) */}
          <div className="px-4 py-2.5 border-b border-stone-200 bg-stone-50 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {activeSession.questions.map((q, idx) => {
              const isCur = idx === activeSession.currentIndex;
              const isAnswered = activeSession.answers[idx] !== null;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() =>
                    setActiveSession((prev) => (prev ? { ...prev, currentIndex: idx } : null))
                  }
                  className={`min-w-[38px] h-[38px] rounded-xl text-xs font-extrabold tabular-nums transition shrink-0 ${
                    isCur
                      ? 'bg-stone-900 text-white'
                      : isAnswered
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-400'
                      : 'bg-white text-stone-600 border border-stone-300'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          {/* Badan Soal & Pilihan Ganda Bebas Ganti */}
          {(() => {
            const q = activeSession.questions[activeSession.currentIndex];
            const selectedOpt = activeSession.answers[activeSession.currentIndex];
            const answeredTotal = activeSession.answers.filter((a) => a !== null).length;

            return (
              <>
                <div className="flex-1 overflow-y-auto px-4 py-5 max-w-2xl w-full mx-auto">
                  <p className="text-xs font-bold text-stone-500">
                    Soal {activeSession.currentIndex + 1} dari {activeSession.questions.length} ·{' '}
                    {q.stageLabel} · Tingkat {DIFFICULTY_META[q.difficulty].label}
                  </p>
                  <h4 className="text-lg font-extrabold text-stone-900 mt-2 leading-snug">
                    {q.prompt}
                  </h4>
                  {q.hasDuplicateNameDisambiguation && (
                    <p className="text-xs text-emerald-800 font-semibold mt-1.5">
                      Catatan: Identitas diberi pembeda nasab/generasi agar nama kembar tidak tertukar.
                    </p>
                  )}

                  <div className="mt-5 divide-y divide-stone-200 border-t border-b border-stone-200">
                    {q.options.map((optText, optIdx) => {
                      const isPicked = selectedOpt === optIdx;
                      const letter = ['A', 'B', 'C', 'D'][optIdx] || String(optIdx + 1);
                      return (
                        <button
                          key={`${q.id}-${optIdx}`}
                          type="button"
                          onClick={() =>
                            setActiveSession((prev) => {
                              if (!prev) return null;
                              const nextAns = [...prev.answers];
                              nextAns[prev.currentIndex] = optIdx;
                              return { ...prev, answers: nextAns };
                            })
                          }
                          className={`w-full min-h-[56px] py-3.5 px-3 text-left flex items-center justify-between gap-3 transition ${
                            isPicked ? 'bg-emerald-50 text-emerald-950' : 'bg-white hover:bg-stone-50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-extrabold shrink-0 ${
                                isPicked
                                  ? 'bg-emerald-700 text-white'
                                  : 'bg-stone-100 text-stone-800'
                              }`}
                            >
                              {letter}
                            </span>
                            <span className="text-sm font-bold leading-snug">{optText}</span>
                          </div>
                          {isPicked && <Check className="w-5 h-5 text-emerald-700 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-xs text-stone-500 mt-3 tabular-nums">
                    Terjawab {answeredTotal} / {activeSession.questions.length} soal · Pilihan masih
                    bisa diganti-ganti sebelum Submit atau Auto-Close.
                  </p>
                </div>

                {/* Navigasi Jempol Bawah Kuis */}
                <div className="px-4 py-3 border-t border-stone-200 bg-white flex items-center justify-between gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={activeSession.currentIndex === 0}
                    onClick={() =>
                      setActiveSession((prev) =>
                        prev ? { ...prev, currentIndex: Math.max(0, prev.currentIndex - 1) } : null
                      )
                    }
                    className="min-h-[48px] px-4 rounded-xl border border-stone-300 text-xs font-extrabold text-stone-800 disabled:opacity-40"
                  >
                    Sebelumnya
                  </button>

                  {activeSession.currentIndex < activeSession.questions.length - 1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setActiveSession((prev) =>
                          prev
                            ? {
                                ...prev,
                                currentIndex: Math.min(
                                  prev.questions.length - 1,
                                  prev.currentIndex + 1
                                ),
                              }
                            : null
                        )
                      }
                      className="flex-1 min-h-[48px] px-5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-sm font-extrabold"
                    >
                      Soal Berikutnya
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => finalizeActiveSession(false)}
                      className="flex-1 min-h-[48px] px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-extrabold"
                    >
                      Kirim Jawaban ({answeredTotal}/{activeSession.questions.length})
                    </button>
                  )}

                  {activeSession.currentIndex < activeSession.questions.length - 1 && (
                    <button
                      type="button"
                      onClick={() => finalizeActiveSession(false)}
                      className="min-h-[48px] px-3.5 rounded-xl border border-emerald-700 text-emerald-800 text-xs font-extrabold"
                    >
                      Submit
                    </button>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL RINGKASAN HASIL PRIBADI (SETELAH SUBMIT / REKAPAN)  */}
      {/* ========================================================= */}
      {displayedRecapDetail && !activeSession && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-end sm:items-center justify-center">
          <div className="bg-white text-stone-900 w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-4 py-3.5 border-b border-stone-200 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">
                  Ringkasan Hasil Pribadi ·{' '}
                  {displayedRecapDetail.autoClosed ? 'Auto-Close 10 Menit' : 'Tersimpan di Data Anda'}
                </p>
                <h3 className="text-base font-extrabold text-stone-900 truncate">
                  {displayedRecapDetail.roundTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedRecapId(null);
                  setLatestResultRecap(null);
                }}
                className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-stone-500 hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Skor Utama */}
            <div className="px-4 py-4 border-b border-stone-200 bg-stone-50 grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-[11px] font-semibold text-stone-500">Skor Akhir</p>
                <p className="text-2xl font-extrabold text-emerald-800 tabular-nums">
                  {displayedRecapDetail.score}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-stone-500">Betul</p>
                <p className="text-xl font-extrabold text-emerald-700 tabular-nums">
                  {displayedRecapDetail.correctCount}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-stone-500">Salah</p>
                <p className="text-xl font-extrabold text-rose-700 tabular-nums">
                  {displayedRecapDetail.wrongCount}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-stone-500">Kosong</p>
                <p className="text-xl font-extrabold text-stone-600 tabular-nums">
                  {displayedRecapDetail.blankCount}
                </p>
              </div>
            </div>

            {/* Rincian Per Soal: Betul, Salah (beserta jawaban tercatat), atau Kosong */}
            <div className="flex-1 overflow-y-auto divide-y divide-stone-200 px-4">
              {displayedRecapDetail.details.map((item, idx) => (
                <div key={`${item.questionId}-${idx}`} className="py-3.5 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-stone-500">
                      Soal {idx + 1} · {item.stageLabel}
                    </span>
                    <span
                      className={`text-xs font-extrabold ${
                        item.isCorrect
                          ? 'text-emerald-700'
                          : item.isBlank
                          ? 'text-stone-500'
                          : 'text-rose-700'
                      }`}
                    >
                      {item.isCorrect ? 'BETUL' : item.isBlank ? 'KOSONG' : 'SALAH'}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-stone-900 leading-snug">{item.prompt}</p>
                  <p className="text-xs text-stone-700">
                    Jawaban Tercatat di Sistem:{' '}
                    <strong>{item.selectedText || '— (Tidak dijawab / Kosong)'}</strong>
                  </p>
                  {!item.isCorrect && (
                    <p className="text-xs font-bold text-emerald-800">
                      Jawaban Benar: {item.correctText}
                    </p>
                  )}
                  <p className="text-xs text-stone-500">{item.explanation}</p>
                </div>
              ))}
            </div>

            <div className="px-4 py-3 border-t border-stone-200 bg-white flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedRecapId(null);
                  setLatestResultRecap(null);
                  setSubTab('rekap');
                }}
                className="flex-1 min-h-[48px] rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-sm font-extrabold"
              >
                Lihat Peringkat &amp; Rekap Lengkap
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

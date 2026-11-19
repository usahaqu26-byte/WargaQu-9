export type QuizStage = 1 | 2 | 3;

export type QuizDifficulty = 'ringan' | 'medium' | 'sulit' | 'campuran';

export type QuizCoreDifficulty = 'ringan' | 'medium' | 'sulit';

export type QuizDataScope = 'active_trah' | 'all_trah';

export interface QuizQuestion {
  id: string;
  stage: QuizStage;
  stageLabel: string;
  difficulty: QuizCoreDifficulty;
  prompt: string;
  contextHint?: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  subjectMemberId: string;
  hasDuplicateNameDisambiguation: boolean;
}

export interface DuplicateNameGroup {
  normalizedName: string;
  displayName: string;
  count: number;
  resolvedLabels: string[];
}

export interface QuizBankStats {
  totalMembers: number;
  potentialTotal: number;
  byStage: Record<QuizStage, number>;
  byDifficulty: Record<QuizCoreDifficulty, number>;
  duplicateNames: DuplicateNameGroup[];
  membersWithCityCount: number;
  membersWithBirthYearCount: number;
}

export interface QuizSponsorContribution {
  id: string;
  sponsorName: string;
  generationLabel: string;
  amount: number;
  channelLabel: string;
  message?: string;
  alsoPlaying: boolean;
  createdAt: string;
}

export interface QuizParticipantEntry {
  participantKey: string;
  name: string;
  kinshipLabel: string;
  registeredAt: string;
  status: 'registered' | 'completed' | 'no_response';
  score: number;
  correctCount: number;
  answeredCount: number;
  totalQuestions: number;
  submitDurationSec: number | null;
  submittedAt?: string;
  isSponsor?: boolean;
}

export interface QuizRound {
  id: string;
  trahId: string;
  trahName: string;
  dataScope: QuizDataScope;
  title: string;
  organizerName: string;
  difficulty: QuizDifficulty;
  scheduledStartAt: string;
  durationSec: number;
  maxQuota: number;
  registeredCount: number;
  participants: QuizParticipantEntry[];
  sponsors: QuizSponsorContribution[];
  prizeNote?: string;
  transferTargetInfo: string;
  wasRescheduledFrom?: string;
  status: 'scheduled' | 'live' | 'completed';
  questionSeed: string;
  createdAt: string;
}

export interface QuizAnswerDetail {
  questionId: string;
  prompt: string;
  stage: QuizStage;
  stageLabel: string;
  difficulty: QuizCoreDifficulty;
  selectedIndex: number | null;
  selectedText: string | null;
  correctIndex: number;
  correctText: string;
  isCorrect: boolean;
  isBlank: boolean;
  explanation: string;
}

export interface QuizPersonalRecap {
  id: string;
  roundId: string;
  roundTitle: string;
  trahId: string;
  trahName: string;
  mode: 'official' | 'practice';
  difficulty: QuizDifficulty;
  participantName: string;
  score: number;
  correctCount: number;
  wrongCount: number;
  blankCount: number;
  totalQuestions: number;
  submitDurationSec: number;
  autoClosed: boolean;
  finishedAt: string;
  details: QuizAnswerDetail[];
}

export interface SuggestedScheduleSlot {
  iso: string;
  timeLabel: string;
  dateTimeLabel: string;
  shiftLabel: string;
  bookedCount: number;
}

export interface QuizQuotaCheckResult {
  isAtLimit: boolean;
  hourKey: string;
  currentBooked: number;
  maxQuota: number;
  remaining: number;
  suggestedSlots: SuggestedScheduleSlot[];
}

export interface QuizAccessPolicy {
  mode: 'free' | 'per_session' | 'monthly_pass';
  realtimeParticipantThreshold: number;
  activeTrafficCount: number;
  isOverRealtimeQuota: boolean;
  sessionFeeRp: number;
  monthlyFeeRp: number;
  canJoinFree: boolean;
  statusSummary: string;
  printDocumentSeparateNote: string;
}

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebaseClient';
import { FirebaseSyncService } from './firebaseSyncService';
import {
  KasTransaction,
  OrgType,
  RtCommunityWorkspace,
  RtGovernanceAction,
  RtGovernanceActionType,
  RtHandoverRecord,
  RtOfficerAccount,
  RtSiagaStorage,
} from './rtSiagaStorage';

function sanitizeId(raw: string, prefix = 'id'): string {
  const clean = (raw || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return clean || `${prefix}_${Date.now()}`;
}

function toEndTimestamp(dateStr: string): Timestamp {
  const clean = (dateStr || '').trim();
  const parsed = new Date(`${clean}T23:59:59`);
  if (Number.isFinite(parsed.getTime())) {
    return Timestamp.fromDate(parsed);
  }
  const fallback = new Date();
  fallback.setFullYear(fallback.getFullYear() + 3);
  return Timestamp.fromDate(fallback);
}

function toGraceTimestamp(endTs: Timestamp, graceDays: number): Timestamp {
  const safeDays = Math.min(60, Math.max(0, Math.round(graceDays || 0)));
  return Timestamp.fromMillis(endTs.toMillis() + safeDays * 86400000);
}

function normalizeOfficers(officers: RtOfficerAccount[]): RtOfficerAccount[] {
  const seen = new Set<string>();
  const result: RtOfficerAccount[] = [];
  for (const off of officers) {
    const email = (off.email || '').trim().toLowerCase().slice(0, 160);
    if (!email || !email.includes('@') || seen.has(email)) continue;
    seen.add(email);
    result.push({
      id: sanitizeId(off.id || `off_${result.length + 1}`, 'off'),
      name: (off.name || email.split('@')[0]).trim().slice(0, 80),
      role: (off.role || 'Pengurus').trim().slice(0, 60),
      division: (off.division || 'Pengurus Inti').trim().slice(0, 80),
      email,
      phone: (off.phone || '-').trim().slice(0, 32),
      canVerifySiaga: Boolean(off.canVerifySiaga),
      appointedAt: (off.appointedAt || new Date().toISOString().slice(0, 10)).slice(0, 16),
    });
    if (result.length >= 10) break;
  }
  return result;
}

function computeTotals(transactions: KasTransaction[]) {
  const totalMasuk = transactions
    .filter(t => t.type === 'masuk')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const totalKeluar = transactions
    .filter(t => t.type === 'keluar')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  return {
    totalMasuk,
    totalKeluar,
    kasBalance: totalMasuk - totalKeluar,
  };
}

function toTimestampIso(val: unknown): string {
  if (val && typeof val === 'object' && 'toDate' in val && typeof (val as Timestamp).toDate === 'function') {
    return (val as Timestamp).toDate().toISOString();
  }
  if (typeof val === 'string' && val) return val;
  return new Date().toISOString();
}

export const RtGovernanceCloudService = {
  isCloudReady(): boolean {
    return FirebaseSyncService.isCloudSignedIn();
  },

  async syncWorkspaceToCloud(ws: RtCommunityWorkspace, note = 'Sinkronisasi pengurus'): Promise<{
    ok: boolean;
    message: string;
  }> {
    const user = FirebaseSyncService.getCurrentUser();
    if (!user || !user.email || !user.emailVerified) {
      return {
        ok: false,
        message: 'Login dengan akun Google terlebih dahulu agar data RT tersimpan & dikunci di server.',
      };
    }

    const communityId = sanitizeId(ws.id, 'comm');
    const cleanEmail = user.email.trim().toLowerCase();
    const rawOfficers = RtSiagaStorage.getOfficers(ws);
    const officers = normalizeOfficers(rawOfficers);

    // Ensure current verified officer email is included if empty
    if (!officers.some(o => o.email === cleanEmail) && officers.length < 10) {
      officers.unshift({
        id: sanitizeId(`off_${Date.now()}`, 'off'),
        name: user.displayName || cleanEmail.split('@')[0],
        role: 'Ketua / Pengurus Utama',
        division: 'Pimpinan & Pengesahan',
        email: cleanEmail,
        phone: '-',
        canVerifySiaga: true,
        appointedAt: ws.profile.termStartDate || new Date().toISOString().slice(0, 10),
      });
    }

    const officerEmails = officers.map(o => o.email);
    const termStartDate = (ws.profile.termStartDate || `${ws.profile.year || 2026}-01-01`).slice(0, 16);
    const termEndDate = (ws.profile.termEndDate || `${(ws.profile.year || 2026) + 2}-12-31`).slice(0, 16);
    const gracePeriodDays =
      typeof ws.profile.gracePeriodDays === 'number'
        ? Math.min(60, Math.max(0, ws.profile.gracePeriodDays))
        : 14;
    const termEndTimestamp = toEndTimestamp(termEndDate);
    const graceEndTimestamp = toGraceTimestamp(termEndTimestamp, gracePeriodDays);
    const { totalMasuk, totalKeluar, kasBalance } = computeTotals(ws.transactions || []);
    const recentTransactions = (ws.transactions || []).slice(0, 25).map(tx => ({
      id: sanitizeId(tx.id, 'kas'),
      type: tx.type,
      category: String(tx.category || 'Donasi / Kas').slice(0, 60),
      title: String(tx.title || 'Transaksi Kas').slice(0, 200),
      amount: Math.max(0, Number(tx.amount) || 0),
      date: String(tx.date || '').slice(0, 32),
      recordedBy: String(tx.recordedBy || 'Pengurus').slice(0, 100),
      recordedByEmail: String(tx.recordedByEmail || cleanEmail).slice(0, 160),
      isCorrection: Boolean(tx.isCorrection),
      correctsTxId: String(tx.correctsTxId || '').slice(0, 128),
    }));
    const handoverHistory = (ws.handovers || []).slice(0, 15).map(h => ({
      id: sanitizeId(h.id, 'ho'),
      handoverDate: String(h.handoverDate || '').slice(0, 32),
      periodLabel: String(h.periodLabel || '').slice(0, 40),
      outgoingOfficerEmails: (h.outgoingOfficerEmails || []).slice(0, 10),
      incomingOfficerEmails: (h.incomingOfficerEmails || []).slice(0, 10),
      incomingOfficers: (h.incomingOfficers || []).slice(0, 10),
      closingBalance: Number(h.closingBalance) || 0,
      memberCount: Math.max(0, Number(h.memberCount) || 0),
      skNumber: String(h.skNumber || '').slice(0, 80),
      note: String(h.note || '').slice(0, 300),
      approvedByEmails: (h.approvedByEmails || []).slice(0, 10),
    }));

    const inviteCode = (ws.profile.inviteCode || `WQR-${communityId.slice(0, 6).toUpperCase()}`)
      .trim()
      .slice(0, 32);

    const docPath = `rtCommunities/${communityId}`;
    const docRef = doc(db, 'rtCommunities', communityId);

    try {
      const existingSnap = await getDoc(docRef);
      if (!existingSnap.exists()) {
        await setDoc(docRef, {
          communityId,
          orgType: ws.profile.orgType,
          customBrandName: (ws.profile.customBrandName || '').slice(0, 80),
          orgName: (ws.profile.orgName || 'Komunitas RTQu').slice(0, 80),
          areaName: (ws.profile.areaName || '').slice(0, 100),
          monthlyDuesAmount: Math.max(0, Number(ws.profile.monthlyDuesAmount) || 0),
          year: Math.min(2100, Math.max(2020, Number(ws.profile.year) || 2026)),
          inviteCode,
          termStartDate,
          termEndDate,
          termEndTimestamp,
          graceEndTimestamp,
          gracePeriodDays,
          skNumber: (ws.profile.skNumber || '').slice(0, 80),
          officerEmails,
          officers,
          kasBalance,
          totalMasuk,
          totalKeluar,
          memberCount: (ws.members || []).length,
          handoverCount: handoverHistory.length,
          recentTransactions,
          handoverHistory,
          lastGovernanceActionId: ws.lastGovernanceActionId || 'init',
          lastActionNote: note.slice(0, 240),
          createdByUid: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedByUid: user.uid,
        });
      } else {
        await updateDoc(docRef, {
          orgType: ws.profile.orgType,
          customBrandName: (ws.profile.customBrandName || '').slice(0, 80),
          orgName: (ws.profile.orgName || 'Komunitas RTQu').slice(0, 80),
          areaName: (ws.profile.areaName || '').slice(0, 100),
          monthlyDuesAmount: Math.max(0, Number(ws.profile.monthlyDuesAmount) || 0),
          year: Math.min(2100, Math.max(2020, Number(ws.profile.year) || 2026)),
          kasBalance,
          totalMasuk,
          totalKeluar,
          memberCount: (ws.members || []).length,
          recentTransactions,
          lastActionNote: note.slice(0, 240),
          updatedAt: serverTimestamp(),
          updatedByUid: user.uid,
        });
      }

      // Ensure uidMembers link exists for current user
      await this.ensureUidMemberLink(communityId, inviteCode);

      return {
        ok: true,
        message: 'Data RTQu & aturan masa jabatan tersinkronisasi di server.',
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.toLowerCase().includes('permission')) {
        try {
          handleFirestoreError(error, OperationType.WRITE, docPath);
        } catch {
          // logged
        }
        return {
          ok: false,
          message:
            'Ditolak server: Masa jabatan pengurus habis atau akun Anda belum terdaftar di daftar pengurus aktif.',
        };
      }
      return { ok: false, message: `Gagal sinkron ke server: ${msg}` };
    }
  },

  async ensureUidMemberLink(communityId: string, inviteCode: string): Promise<void> {
    const user = FirebaseSyncService.getCurrentUser();
    if (!user || !user.email || !user.emailVerified) return;
    const cid = sanitizeId(communityId, 'comm');
    const path = `rtCommunities/${cid}/uidMembers/${user.uid}`;
    const ref = doc(db, 'rtCommunities', cid, 'uidMembers', user.uid);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          uid: user.uid,
          email: user.email.trim().toLowerCase().slice(0, 160),
          displayName: (user.displayName || user.email.split('@')[0] || 'Warga').slice(0, 80),
          inviteCode: inviteCode.trim().slice(0, 32),
          joinedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async addOfficersDirectInitialSetup(
    ws: RtCommunityWorkspace,
    nextOfficers: RtOfficerAccount[]
  ): Promise<{ ok: boolean; message: string }> {
    const user = FirebaseSyncService.getCurrentUser();
    if (!user || !user.email || !user.emailVerified) {
      RtSiagaStorage.saveOfficersDirectSetup(nextOfficers);
      return {
        ok: true,
        message: 'Pengurus disimpan lokal (login Google agar dikunci juga oleh server).',
      };
    }

    const communityId = sanitizeId(ws.id, 'comm');
    const normalized = normalizeOfficers(nextOfficers);
    const officerEmails = normalized.map(o => o.email);
    const docPath = `rtCommunities/${communityId}`;
    const docRef = doc(db, 'rtCommunities', communityId);

    try {
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        RtSiagaStorage.saveOfficersDirectSetup(normalized);
        const updated = RtSiagaStorage.getActiveCommunity();
        if (updated) {
          return this.syncWorkspaceToCloud(updated, 'Inisialisasi pengurus >2 akun');
        }
        return { ok: true, message: 'Pengurus berhasil disiapkan.' };
      }

      await updateDoc(docRef, {
        officerEmails,
        officers: normalized,
        lastActionNote: `Penambahan pengurus awal (${officerEmails.length} akun)`,
        updatedAt: serverTimestamp(),
        updatedByUid: user.uid,
      });
      RtSiagaStorage.saveOfficersDirectSetup(normalized);
      return {
        ok: true,
        message: `Berhasil mendaftarkan ${officerEmails.length} akun pengurus di server.`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      try {
        handleFirestoreError(error, OperationType.UPDATE, docPath);
      } catch {
        // logged
      }
      return {
        ok: false,
        message: `Ditolak server (${msg.includes('permission') ? 'Gunakan menu Usulan Kuorum >=2 Pengurus jika sudah >=3 pengurus' : msg}).`,
      };
    }
  },

  async recordAppendOnlyTransaction(
    ws: RtCommunityWorkspace,
    tx: KasTransaction
  ): Promise<{ ok: boolean; message: string }> {
    const user = FirebaseSyncService.getCurrentUser();
    if (!user || !user.email || !user.emailVerified) {
      return { ok: true, message: 'Tersimpan lokal.' };
    }

    const communityId = sanitizeId(ws.id, 'comm');
    const txId = sanitizeId(tx.id, 'kas');
    const cleanEmail = user.email.trim().toLowerCase();
    const docPath = `rtCommunities/${communityId}/transactions/${txId}`;
    const commRef = doc(db, 'rtCommunities', communityId);

    try {
      const commSnap = await getDoc(commRef);
      if (!commSnap.exists()) {
        await this.syncWorkspaceToCloud(ws, 'Sinkron transaksi kas');
      }
      const freshSnap = await getDoc(commRef);
      const commData = freshSnap.data();
      const officerEmails: string[] = Array.isArray(commData?.officerEmails)
        ? commData.officerEmails
        : normalizeOfficers(RtSiagaStorage.getOfficers(ws)).map(o => o.email);

      const termPeriod = `${(ws.profile.termStartDate || '2024').slice(0, 4)}-${(ws.profile.termEndDate || '2026').slice(0, 4)}`;
      const { totalMasuk, totalKeluar, kasBalance } = computeTotals(ws.transactions || []);
      const recentTransactions = (ws.transactions || []).slice(0, 25).map(t => ({
        id: sanitizeId(t.id, 'kas'),
        type: t.type,
        category: String(t.category || 'Donasi / Kas').slice(0, 60),
        title: String(t.title || 'Transaksi Kas').slice(0, 200),
        amount: Math.max(0, Number(t.amount) || 0),
        date: String(t.date || '').slice(0, 32),
        recordedBy: String(t.recordedBy || 'Pengurus').slice(0, 100),
        recordedByEmail: String(t.recordedByEmail || cleanEmail).slice(0, 160),
        isCorrection: Boolean(t.isCorrection),
        correctsTxId: String(t.correctsTxId || '').slice(0, 128),
      }));

      const batch = writeBatch(db);
      batch.set(doc(db, 'rtCommunities', communityId, 'transactions', txId), {
        id: txId,
        type: tx.type,
        category: String(tx.category).slice(0, 60),
        title: String(tx.title).slice(0, 200),
        amount: Math.max(0, Number(tx.amount) || 0),
        date: String(tx.date).slice(0, 32),
        recordedBy: String(tx.recordedBy).slice(0, 100),
        recordedByUid: user.uid,
        recordedByEmail: cleanEmail,
        isCorrection: Boolean(tx.isCorrection),
        correctsTxId: String(tx.correctsTxId || '').slice(0, 128),
        termPeriod,
        officerEmails,
        createdAt: serverTimestamp(),
      });
      batch.update(commRef, {
        kasBalance,
        totalMasuk,
        totalKeluar,
        recentTransactions,
        lastActionNote: `Catat kas: ${tx.title.slice(0, 180)}`,
        updatedAt: serverTimestamp(),
        updatedByUid: user.uid,
      });
      await batch.commit();
      return { ok: true, message: 'Transaksi kas append-only tersimpan di server.' };
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.WRITE, docPath);
      } catch {
        // logged
      }
      return {
        ok: false,
        message: 'Server menolak perubahan kas (pastikan masa jabatan masih aktif & akun Anda pengurus sah).',
      };
    }
  },

  async proposeGovernanceAction(params: {
    ws: RtCommunityWorkspace;
    actionType: RtGovernanceActionType;
    title: string;
    note: string;
    proposedOfficers: RtOfficerAccount[];
    proposedTermStartDate: string;
    proposedTermEndDate: string;
    proposedGracePeriodDays: number;
    proposedSkNumber: string;
  }): Promise<{ ok: boolean; message: string; action?: RtGovernanceAction }> {
    const user = FirebaseSyncService.getCurrentUser();
    const localEmail = (user?.email || RtSiagaStorage.getCurrentMember()?.email || 'pengurus@wargaqu.id')
      .trim()
      .toLowerCase();
    const communityId = sanitizeId(params.ws.id, 'comm');
    const actionId = sanitizeId(`act_${Date.now()}`, 'act');
    const normalizedProposed = normalizeOfficers(params.proposedOfficers);

    const localAction: RtGovernanceAction = {
      id: actionId,
      actionType: params.actionType,
      status: 'pending',
      title: params.title.trim().slice(0, 120),
      note: params.note.trim().slice(0, 300),
      proposedByEmail: localEmail,
      proposedOfficers: normalizedProposed,
      proposedTermStartDate: params.proposedTermStartDate.slice(0, 16),
      proposedTermEndDate: params.proposedTermEndDate.slice(0, 16),
      proposedGracePeriodDays: Math.min(60, Math.max(0, params.proposedGracePeriodDays)),
      proposedSkNumber: params.proposedSkNumber.trim().slice(0, 80),
      approverEmails: [localEmail],
      createdAt: new Date().toISOString(),
    };

    RtSiagaStorage.upsertLocalGovernanceAction(params.ws.id, localAction);

    if (!user || !user.email || !user.emailVerified) {
      return {
        ok: true,
        message: 'Usulan kuorum dicatat lokal. Login Google untuk menyimpan & memverifikasi di server.',
        action: localAction,
      };
    }

    const docPath = `rtCommunities/${communityId}/governanceActions/${actionId}`;
    try {
      const commRef = doc(db, 'rtCommunities', communityId);
      let commSnap = await getDoc(commRef);
      if (!commSnap.exists()) {
        await this.syncWorkspaceToCloud(params.ws, 'Sinkron awal sebelum usulan kuorum');
        commSnap = await getDoc(commRef);
      }
      const parentOfficerEmails: string[] = Array.isArray(commSnap.data()?.officerEmails)
        ? commSnap.data()!.officerEmails
        : normalizeOfficers(RtSiagaStorage.getOfficers(params.ws)).map(o => o.email);

      const termEndTs = toEndTimestamp(localAction.proposedTermEndDate);
      const graceEndTs = toGraceTimestamp(termEndTs, localAction.proposedGracePeriodDays);

      await setDoc(doc(db, 'rtCommunities', communityId, 'governanceActions', actionId), {
        id: actionId,
        communityId,
        actionType: localAction.actionType,
        status: 'pending',
        title: localAction.title,
        note: localAction.note,
        proposedByUid: user.uid,
        proposedByEmail: localEmail,
        proposedOfficerEmails: normalizedProposed.map(o => o.email),
        proposedOfficers: normalizedProposed,
        proposedTermStartDate: localAction.proposedTermStartDate,
        proposedTermEndDate: localAction.proposedTermEndDate,
        proposedTermEndTimestamp: termEndTs,
        proposedGraceEndTimestamp: graceEndTs,
        proposedGracePeriodDays: localAction.proposedGracePeriodDays,
        proposedSkNumber: localAction.proposedSkNumber,
        officerEmails: parentOfficerEmails,
        approverEmails: [localEmail],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return {
        ok: true,
        message: 'Usulan dikirim ke server! Membutuhkan persetujuan 1 pengurus lain (Kuorum >=2).',
        action: localAction,
      };
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.WRITE, docPath);
      } catch {
        // logged
      }
      return {
        ok: false,
        message: 'Usulan ditolak server. Pastikan Anda pengurus sah dan masih dalam masa aktif/tenggang.',
      };
    }
  },

  async approveGovernanceAction(
    ws: RtCommunityWorkspace,
    action: RtGovernanceAction,
    overrideApproverEmail?: string
  ): Promise<{ ok: boolean; message: string }> {
    const user = FirebaseSyncService.getCurrentUser();
    const actorEmail = (
      overrideApproverEmail ||
      user?.email ||
      RtSiagaStorage.getCurrentMember()?.email ||
      ''
    )
      .trim()
      .toLowerCase();

    if (!actorEmail) {
      return { ok: false, message: 'Akun penyetuju tidak ditemukan.' };
    }
    if (action.approverEmails.includes(actorEmail)) {
      return {
        ok: false,
        message: 'Anti-Monopoli: Akun yang sama tidak dapat menyetujui 2 kali. Harus disetujui akun pengurus lain.',
      };
    }

    const nextApprovers = [...action.approverEmails, actorEmail];
    const nextStatus = nextApprovers.length >= 2 ? 'approved' : 'pending';
    const updatedAction: RtGovernanceAction = {
      ...action,
      approverEmails: nextApprovers,
      status: nextStatus,
    };

    if (!user || !user.email || !user.emailVerified || overrideApproverEmail) {
      RtSiagaStorage.upsertLocalGovernanceAction(ws.id, updatedAction);
      return {
        ok: true,
        message:
          nextStatus === 'approved'
            ? 'Kuorum >=2 pengurus terpenuhi! Siap dijalankan.'
            : 'Persetujuan dicatat.',
      };
    }

    const communityId = sanitizeId(ws.id, 'comm');
    const actionId = sanitizeId(action.id, 'act');
    const docPath = `rtCommunities/${communityId}/governanceActions/${actionId}`;

    try {
      await updateDoc(doc(db, 'rtCommunities', communityId, 'governanceActions', actionId), {
        approverEmails: nextApprovers,
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      RtSiagaStorage.upsertLocalGovernanceAction(ws.id, updatedAction);
      return {
        ok: true,
        message:
          nextStatus === 'approved'
            ? 'Kuorum >=2 pengurus sah di server! Klik Jalankan untuk mengesahkan.'
            : 'Persetujuan server berhasil dicatat.',
      };
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.UPDATE, docPath);
      } catch {
        // logged
      }
      return {
        ok: false,
        message: 'Server menolak persetujuan (harus dilakukan oleh akun Google pengurus berbeda yang belum menyetujui).',
      };
    }
  },

  async executeGovernanceAction(
    ws: RtCommunityWorkspace,
    action: RtGovernanceAction
  ): Promise<{ ok: boolean; message: string }> {
    if (action.status !== 'approved' || action.approverEmails.length < 2) {
      return {
        ok: false,
        message: 'Usulan belum mencapai kuorum minimal 2 pengurus berbeda.',
      };
    }

    const isSertijab = action.actionType === 'sertijab' || action.actionType === 'collective_recovery';
    const closingBalance = computeTotals(ws.transactions || []).kasBalance;
    const todayLabel = new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const oldPeriod = `${(ws.profile.termStartDate || '2024').slice(0, 4)}–${(ws.profile.termEndDate || '2026').slice(0, 4)}`;
    const outgoingEmails = RtSiagaStorage.getOfficers(ws).map(o => o.email);
    const incomingEmails = action.proposedOfficers.map(o => o.email);

    const handoverRecord: RtHandoverRecord | undefined = isSertijab
      ? {
          id: sanitizeId(`ho_${action.id}`, 'ho'),
          handoverDate: todayLabel,
          periodLabel: oldPeriod,
          outgoingOfficerEmails: outgoingEmails,
          incomingOfficerEmails: incomingEmails,
          incomingOfficers: action.proposedOfficers,
          closingBalance,
          memberCount: (ws.members || []).length,
          skNumber: action.proposedSkNumber || ws.profile.skNumber || '-',
          note: action.note || `Serah Terima Jabatan periode ${oldPeriod}`,
          approvedByEmails: action.approverEmails,
        }
      : undefined;

    const user = FirebaseSyncService.getCurrentUser();
    if (!user || !user.email || !user.emailVerified) {
      RtSiagaStorage.applyGovernanceExecution(ws.id, {
        officers: action.proposedOfficers,
        termStartDate: action.proposedTermStartDate,
        termEndDate: action.proposedTermEndDate,
        gracePeriodDays: action.proposedGracePeriodDays,
        skNumber: action.proposedSkNumber,
        actionId: action.id,
        handover: handoverRecord,
      });
      return {
        ok: true,
        message: isSertijab
          ? 'Serah Terima Jabatan (Sertijab) disahkan! Arsip periode lama dikunci.'
          : 'Keputusan kuorum berhasil diterapkan.',
      };
    }

    const communityId = sanitizeId(ws.id, 'comm');
    const actionId = sanitizeId(action.id, 'act');
    const commRef = doc(db, 'rtCommunities', communityId);
    const actionRef = doc(db, 'rtCommunities', communityId, 'governanceActions', actionId);

    try {
      const termEndTs = toEndTimestamp(action.proposedTermEndDate);
      const graceEndTs = toGraceTimestamp(termEndTs, action.proposedGracePeriodDays);
      const nextHistory = handoverRecord
        ? [
            {
              id: handoverRecord.id,
              handoverDate: handoverRecord.handoverDate,
              periodLabel: handoverRecord.periodLabel,
              outgoingOfficerEmails: handoverRecord.outgoingOfficerEmails,
              incomingOfficerEmails: handoverRecord.incomingOfficerEmails,
              incomingOfficers: handoverRecord.incomingOfficers,
              closingBalance: handoverRecord.closingBalance,
              memberCount: handoverRecord.memberCount,
              skNumber: handoverRecord.skNumber,
              note: handoverRecord.note,
              approvedByEmails: handoverRecord.approvedByEmails,
            },
            ...(ws.handovers || []),
          ].slice(0, 15)
        : (ws.handovers || []).slice(0, 15);

      const batch = writeBatch(db);
      if (handoverRecord) {
        batch.set(doc(db, 'rtCommunities', communityId, 'handovers', handoverRecord.id), {
          id: handoverRecord.id,
          communityId,
          handoverDate: handoverRecord.handoverDate,
          periodLabel: handoverRecord.periodLabel,
          outgoingOfficerEmails: handoverRecord.outgoingOfficerEmails,
          incomingOfficerEmails: handoverRecord.incomingOfficerEmails,
          incomingOfficers: handoverRecord.incomingOfficers,
          closingBalance: handoverRecord.closingBalance,
          memberCount: handoverRecord.memberCount,
          skNumber: handoverRecord.skNumber,
          note: handoverRecord.note,
          officerEmails: incomingEmails,
          approvedByEmails: handoverRecord.approvedByEmails,
          recordedByUid: user.uid,
          createdAt: serverTimestamp(),
        });
      }

      batch.update(actionRef, {
        status: 'executed',
        updatedAt: serverTimestamp(),
      });

      batch.update(commRef, {
        officerEmails: incomingEmails,
        officers: action.proposedOfficers,
        termStartDate: action.proposedTermStartDate,
        termEndDate: action.proposedTermEndDate,
        termEndTimestamp: termEndTs,
        graceEndTimestamp: graceEndTs,
        gracePeriodDays: action.proposedGracePeriodDays,
        skNumber: action.proposedSkNumber,
        handoverCount: handoverRecord ? (ws.handovers?.length || 0) + 1 : ws.handovers?.length || 0,
        handoverHistory: nextHistory,
        lastGovernanceActionId: actionId,
        lastActionNote: `${action.title} (Kuorum ${action.approverEmails.length} pengurus)`,
        updatedAt: serverTimestamp(),
        updatedByUid: user.uid,
      });

      await batch.commit();

      RtSiagaStorage.applyGovernanceExecution(ws.id, {
        officers: action.proposedOfficers,
        termStartDate: action.proposedTermStartDate,
        termEndDate: action.proposedTermEndDate,
        gracePeriodDays: action.proposedGracePeriodDays,
        skNumber: action.proposedSkNumber,
        actionId: action.id,
        handover: handoverRecord,
      });

      return {
        ok: true,
        message: isSertijab
          ? 'Sertijab disahkan di server! Hak edit pengurus lama berakhir & arsip terkunci.'
          : 'Perubahan pengurus & masa bakti disahkan di server.',
      };
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.WRITE, `rtCommunities/${communityId}`);
      } catch {
        // logged
      }
      return {
        ok: false,
        message: 'Server menolak eksekusi kuorum (cek apakah masa tenggang sudah habis atau kuorum belum sah).',
      };
    }
  },

  async fetchMyOfficerCommunities(): Promise<number> {
    const user = FirebaseSyncService.getCurrentUser();
    if (!user || !user.email || !user.emailVerified) return 0;
    const cleanEmail = user.email.trim().toLowerCase();
    const path = 'rtCommunities';

    try {
      const q = query(
        collection(db, path),
        where('officerEmails', 'array-contains', cleanEmail)
      );
      const snap = await getDocs(q);
      let count = 0;
      for (const docSnap of snap.docs) {
        const d = docSnap.data();
        const cid = docSnap.id;
        // Fetch pending/approved governance actions for this community
        let govActions: RtGovernanceAction[] = [];
        try {
          const actQ = query(
            collection(db, 'rtCommunities', cid, 'governanceActions'),
            where('officerEmails', 'array-contains', cleanEmail)
          );
          const actSnap = await getDocs(actQ);
          govActions = actSnap.docs.map(a => {
            const ad = a.data();
            return {
              id: ad.id || a.id,
              actionType: ad.actionType,
              status: ad.status,
              title: ad.title,
              note: ad.note || '',
              proposedByEmail: ad.proposedByEmail,
              proposedOfficers: Array.isArray(ad.proposedOfficers) ? ad.proposedOfficers : [],
              proposedTermStartDate: ad.proposedTermStartDate,
              proposedTermEndDate: ad.proposedTermEndDate,
              proposedGracePeriodDays: Number(ad.proposedGracePeriodDays) || 14,
              proposedSkNumber: ad.proposedSkNumber || '',
              approverEmails: Array.isArray(ad.approverEmails) ? ad.approverEmails : [],
              createdAt: toTimestampIso(ad.createdAt),
            };
          });
        } catch {
          // ignore subcollection read if rules restrict
        }

        RtSiagaStorage.mergeCloudCommunityRecord({
          communityId: cid,
          orgType: (d.orgType as OrgType) || 'RT',
          customBrandName: d.customBrandName || undefined,
          orgName: d.orgName || cid,
          areaName: d.areaName || '',
          monthlyDuesAmount: Number(d.monthlyDuesAmount) || 0,
          year: Number(d.year) || 2026,
          inviteCode: d.inviteCode || '',
          termStartDate: d.termStartDate || '2024-01-01',
          termEndDate: d.termEndDate || '2026-12-31',
          gracePeriodDays: Number(d.gracePeriodDays) || 14,
          skNumber: d.skNumber || '',
          officers: Array.isArray(d.officers) ? d.officers : [],
          recentTransactions: Array.isArray(d.recentTransactions) ? d.recentTransactions : [],
          handoverHistory: Array.isArray(d.handoverHistory) ? d.handoverHistory : [],
          governanceActions: govActions,
          lastGovernanceActionId: d.lastGovernanceActionId || undefined,
          cloudSyncedAt: toTimestampIso(d.updatedAt),
        });
        count++;
      }
      return count;
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch {
        // logged
      }
      return 0;
    }
  },

  subscribeActiveCommunity(communityId: string): Unsubscribe {
    const user = FirebaseSyncService.getCurrentUser();
    if (!user || !user.email || !user.emailVerified || !communityId) {
      return () => {};
    }
    const cid = sanitizeId(communityId, 'comm');
    const cleanEmail = user.email.trim().toLowerCase();
    const docPath = `rtCommunities/${cid}`;

    const unsubComm = onSnapshot(
      doc(db, 'rtCommunities', cid),
      snap => {
        if (!snap.exists()) return;
        const d = snap.data();
        RtSiagaStorage.mergeCloudCommunityRecord({
          communityId: cid,
          orgType: (d.orgType as OrgType) || 'RT',
          customBrandName: d.customBrandName || undefined,
          orgName: d.orgName || cid,
          areaName: d.areaName || '',
          monthlyDuesAmount: Number(d.monthlyDuesAmount) || 0,
          year: Number(d.year) || 2026,
          inviteCode: d.inviteCode || '',
          termStartDate: d.termStartDate || '2024-01-01',
          termEndDate: d.termEndDate || '2026-12-31',
          gracePeriodDays: Number(d.gracePeriodDays) || 14,
          skNumber: d.skNumber || '',
          officers: Array.isArray(d.officers) ? d.officers : [],
          recentTransactions: Array.isArray(d.recentTransactions) ? d.recentTransactions : [],
          handoverHistory: Array.isArray(d.handoverHistory) ? d.handoverHistory : [],
          lastGovernanceActionId: d.lastGovernanceActionId || undefined,
          cloudSyncedAt: toTimestampIso(d.updatedAt),
        });
      },
      error => {
        try {
          handleFirestoreError(error, OperationType.GET, docPath);
        } catch {
          // logged
        }
      }
    );

    const actionsPath = `rtCommunities/${cid}/governanceActions`;
    const actQuery = query(
      collection(db, 'rtCommunities', cid, 'governanceActions'),
      where('officerEmails', 'array-contains', cleanEmail)
    );
    const unsubActions = onSnapshot(
      actQuery,
      snap => {
        snap.docs.forEach(a => {
          const ad = a.data();
          RtSiagaStorage.upsertLocalGovernanceAction(cid, {
            id: ad.id || a.id,
            actionType: ad.actionType,
            status: ad.status,
            title: ad.title,
            note: ad.note || '',
            proposedByEmail: ad.proposedByEmail,
            proposedOfficers: Array.isArray(ad.proposedOfficers) ? ad.proposedOfficers : [],
            proposedTermStartDate: ad.proposedTermStartDate,
            proposedTermEndDate: ad.proposedTermEndDate,
            proposedGracePeriodDays: Number(ad.proposedGracePeriodDays) || 14,
            proposedSkNumber: ad.proposedSkNumber || '',
            approverEmails: Array.isArray(ad.approverEmails) ? ad.approverEmails : [],
            createdAt: toTimestampIso(ad.createdAt),
          });
        });
      },
      error => {
        try {
          handleFirestoreError(error, OperationType.LIST, actionsPath);
        } catch {
          // logged
        }
      }
    );

    return () => {
      unsubComm();
      unsubActions();
    };
  },
};

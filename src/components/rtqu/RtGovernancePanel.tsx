import React, { useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Calendar,
  CheckCircle2,
  Cloud,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  RtCommunityWorkspace,
  RtGovernanceAction,
  RtHandoverRecord,
  RtOfficerAccount,
  RtSiagaStorage,
  RtTermHealth,
} from '../../services/rtSiagaStorage';
import { RtGovernanceCloudService } from '../../services/rtGovernanceCloudService';
import { FirebaseSyncService } from '../../services/firebaseSyncService';

interface RtTenureBannerProps {
  termHealth: RtTermHealth;
  officersCount: number;
  isCurrentOfficer: boolean;
  onCreateElectionInvite: () => void;
  onCreateElectionPoll: () => void;
  onOpenGovernanceTab: () => void;
}

export const RtTenureBanner: React.FC<RtTenureBannerProps> = ({
  termHealth,
  officersCount,
  isCurrentOfficer,
  onCreateElectionInvite,
  onCreateElectionPoll,
  onOpenGovernanceTab,
}) => {
  const isUrgent =
    termHealth.status === 'expired' ||
    termHealth.status === 'grace' ||
    termHealth.status === 'warning_30';
  const isWarning = termHealth.status === 'warning_90';

  if (termHealth.status === 'active' && officersCount >= 3) {
    return (
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 text-[11px]">
        <div className="min-w-0 text-slate-600 truncate">
          <span className="font-bold text-slate-800">{termHealth.headline}</span>
          <span className="mx-1.5 text-slate-300">·</span>
          <span>{officersCount} akun pengurus aktif</span>
        </div>
        <button
          type="button"
          onClick={onOpenGovernanceTab}
          className="font-bold text-emerald-700 hover:underline shrink-0"
        >
          Kelola &amp; Sertijab
        </button>
      </div>
    );
  }

  return (
    <div
      className={`px-4 py-3 border-b space-y-2 ${
        isUrgent
          ? 'bg-rose-50/70 border-rose-200'
          : isWarning
          ? 'bg-amber-50/80 border-amber-200'
          : 'bg-slate-50 border-slate-200'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
            {termHealth.isReadOnlyLocked ? (
              <Lock className="w-4 h-4 text-rose-700 shrink-0" />
            ) : isWarning || isUrgent ? (
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            ) : (
              <Calendar className="w-4 h-4 text-emerald-700 shrink-0" />
            )}
            <span>{termHealth.headline}</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">{termHealth.detail}</p>
          {officersCount < 3 && (
            <p className="text-[11px] text-amber-800 font-semibold pt-0.5">
              Anti-Monopoli: Baru terdaftar {officersCount} akun pengurus. Tambahkan minimal 3 akun
              berbeda (Ketua, Sekretaris, Bendahara) di menu Pengurus.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        {(isWarning || isUrgent) && (
          <>
            <button
              type="button"
              onClick={onCreateElectionInvite}
              className="min-h-[34px] px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold"
            >
              Buat Undangan Rapat Pemilihan
            </button>
            <button
              type="button"
              onClick={onCreateElectionPoll}
              className="min-h-[34px] px-3 border border-emerald-700 bg-white hover:bg-emerald-50 text-emerald-700 rounded-lg text-[11px] font-bold"
            >
              Buat Polling Pemilihan
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onOpenGovernanceTab}
          className="min-h-[34px] px-3 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 rounded-lg text-[11px] font-bold"
        >
          {isCurrentOfficer && termHealth.isSertijabOnly
            ? 'Proses Sertijab Sekarang'
            : 'Lihat Masa Bakti & Pengurus'}
        </button>
      </div>
    </div>
  );
};

interface RtGovernanceManagerProps {
  workspace: RtCommunityWorkspace;
  termHealth: RtTermHealth;
  officers: RtOfficerAccount[];
  handovers: RtHandoverRecord[];
  governanceActions: RtGovernanceAction[];
  kasBalance: number;
  isPengurusMode: boolean;
  showNotification: (msg: string) => void;
  onCreateElectionInvite: () => void;
  onCreateElectionPoll: () => void;
}

export const RtGovernanceManager: React.FC<RtGovernanceManagerProps> = ({
  workspace,
  termHealth,
  officers,
  handovers,
  governanceActions,
  kasBalance,
  isPengurusMode,
  showNotification,
  onCreateElectionInvite,
  onCreateElectionPoll,
}) => {
  const cloudUser = FirebaseSyncService.getCurrentUser();
  const isCloudSignedIn = FirebaseSyncService.isCloudSignedIn();
  const currentEmail = (cloudUser?.email || '').trim().toLowerCase();

  const [isSyncing, setIsSyncing] = useState(false);
  const [activeSubForm, setActiveSubForm] = useState<
    null | 'add_officer' | 'extend_term' | 'sertijab'
  >(null);

  // Add Officer form (for initial setup <3 or proposing new officer)
  const [newOfficer, setNewOfficer] = useState({
    name: '',
    role: 'Bendahara',
    division: 'Iuran & Transparansi Kas',
    email: '',
    phone: '',
  });

  // Extend term proposal form
  const [extendEndDate, setExtendEndDate] = useState<string>(() => {
    const base = new Date(`${termHealth.termEndDate}T00:00:00`);
    if (Number.isFinite(base.getTime())) {
      base.setFullYear(base.getFullYear() + 3);
      return base.toISOString().slice(0, 10);
    }
    return '2029-12-31';
  });
  const [extendSkNumber, setExtendSkNumber] = useState(workspace.profile.skNumber || '');
  const [extendNote, setExtendNote] = useState('Perpanjangan masa bakti hasil musyawarah warga');

  // Sertijab handover form (minimum 3 incoming officers encouraged)
  const todayIso = new Date().toISOString().slice(0, 10);
  const defaultNextEnd = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 3);
    return d.toISOString().slice(0, 10);
  })();
  const [sertijabForm, setSertijabForm] = useState({
    ketuaName: '',
    ketuaEmail: '',
    ketuaPhone: '',
    sekretarisName: '',
    sekretarisEmail: '',
    sekretarisPhone: '',
    bendaharaName: '',
    bendaharaEmail: '',
    bendaharaPhone: '',
    newTermStart: todayIso,
    newTermEnd: defaultNextEnd,
    graceDays: String(termHealth.gracePeriodDays || 14),
    skNumber: '',
    note: '',
  });

  const handleCloudSignIn = async () => {
    setIsSyncing(true);
    try {
      await FirebaseSyncService.signInWithGoogle();
      const pulled = await RtGovernanceCloudService.fetchMyOfficerCommunities();
      if (pulled > 0) {
        showNotification(`Berhasil masuk & menyinkronkan ${pulled} komunitas dari server.`);
      } else {
        const res = await RtGovernanceCloudService.syncWorkspaceToCloud(
          workspace,
          'Aktivasi sinkronisasi server RTQu'
        );
        showNotification(res.message);
      }
    } catch (err) {
      showNotification(
        err instanceof Error ? err.message : 'Gagal masuk akun Google untuk sinkron server.'
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const res = await RtGovernanceCloudService.syncWorkspaceToCloud(
        workspace,
        'Sinkronisasi manual pengurus'
      );
      await RtGovernanceCloudService.fetchMyOfficerCommunities();
      showNotification(res.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddOfficerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = newOfficer.email.trim().toLowerCase();
    if (!newOfficer.name.trim() || !cleanEmail.includes('@')) {
      showNotification('Nama dan email Google pengurus wajib diisi.');
      return;
    }
    if (officers.some(o => o.email.toLowerCase() === cleanEmail)) {
      showNotification('Email pengurus tersebut sudah terdaftar.');
      return;
    }
    const added: RtOfficerAccount = {
      id: `off-${Date.now()}`,
      name: newOfficer.name.trim(),
      role: newOfficer.role.trim() || 'Pengurus',
      division: newOfficer.division.trim() || 'Pengurus Inti',
      email: cleanEmail,
      phone: newOfficer.phone.trim() || '-',
      canVerifySiaga: true,
      appointedAt: todayIso,
    };
    const nextOfficers = [...officers, added];

    setIsSyncing(true);
    try {
      if (officers.length < 3) {
        const res = await RtGovernanceCloudService.addOfficersDirectInitialSetup(
          workspace,
          nextOfficers
        );
        showNotification(res.message);
      } else {
        const res = await RtGovernanceCloudService.proposeGovernanceAction({
          ws: workspace,
          actionType: 'update_officers',
          title: `Tambah Pengurus: ${added.name} (${added.role})`,
          note: `Menambahkan akun ${cleanEmail} ke jajaran pengurus aktif.`,
          proposedOfficers: nextOfficers,
          proposedTermStartDate: termHealth.termStartDate,
          proposedTermEndDate: termHealth.termEndDate,
          proposedGracePeriodDays: termHealth.gracePeriodDays,
          proposedSkNumber: workspace.profile.skNumber || '',
        });
        showNotification(res.message);
      }
      setNewOfficer({
        name: '',
        role: 'Sekretaris',
        division: 'Administrasi & Surat Warga',
        email: '',
        phone: '',
      });
      setActiveSubForm(null);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleProposeExtendTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (officers.length < 2) {
      showNotification('Tambahkan minimal 2–3 akun pengurus terlebih dahulu untuk kuorum anti-monopoli.');
      return;
    }
    if (!extendEndDate) {
      showNotification('Tanggal akhir masa bakti wajib diisi.');
      return;
    }
    setIsSyncing(true);
    try {
      const res = await RtGovernanceCloudService.proposeGovernanceAction({
        ws: workspace,
        actionType: 'extend_term',
        title: `Perpanjang Masa Bakti s.d. ${extendEndDate}`,
        note: extendNote.trim() || 'Perpanjangan masa jabatan hasil musyawarah warga',
        proposedOfficers: officers,
        proposedTermStartDate: termHealth.termStartDate,
        proposedTermEndDate: extendEndDate,
        proposedGracePeriodDays: termHealth.gracePeriodDays,
        proposedSkNumber: extendSkNumber.trim(),
      });
      showNotification(res.message);
      if (res.ok) setActiveSubForm(null);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleProposeSertijab = async (e: React.FormEvent) => {
    e.preventDefault();
    const candidates: Array<{ name: string; email: string; phone: string; role: string; division: string }> = [
      {
        name: sertijabForm.ketuaName.trim(),
        email: sertijabForm.ketuaEmail.trim().toLowerCase(),
        phone: sertijabForm.ketuaPhone.trim() || '-',
        role: 'Ketua Baru',
        division: 'Pimpinan & Pengesahan',
      },
      {
        name: sertijabForm.sekretarisName.trim(),
        email: sertijabForm.sekretarisEmail.trim().toLowerCase(),
        phone: sertijabForm.sekretarisPhone.trim() || '-',
        role: 'Sekretaris Baru',
        division: 'Administrasi & Surat Warga',
      },
      {
        name: sertijabForm.bendaharaName.trim(),
        email: sertijabForm.bendaharaEmail.trim().toLowerCase(),
        phone: sertijabForm.bendaharaPhone.trim() || '-',
        role: 'Bendahara Baru',
        division: 'Iuran & Transparansi Kas',
      },
    ].filter(c => c.name && c.email.includes('@'));

    if (candidates.length < 3) {
      showNotification(
        'Anti-Monopoli Sertijab: Wajib isi minimal 3 akun pengurus baru berbeda (Ketua, Sekretaris, Bendahara).'
      );
      return;
    }
    const uniqueEmails = new Set(candidates.map(c => c.email));
    if (uniqueEmails.size < 3) {
      showNotification('Email Ketua, Sekretaris, dan Bendahara baru harus berbeda-beda.');
      return;
    }

    const incomingOfficers: RtOfficerAccount[] = candidates.map((c, idx) => ({
      id: `off-new-${Date.now()}-${idx + 1}`,
      name: c.name,
      role: c.role,
      division: c.division,
      email: c.email,
      phone: c.phone,
      canVerifySiaga: true,
      appointedAt: sertijabForm.newTermStart || todayIso,
    }));

    const isRecovery = termHealth.status === 'expired';
    setIsSyncing(true);
    try {
      const res = await RtGovernanceCloudService.proposeGovernanceAction({
        ws: workspace,
        actionType: isRecovery ? 'collective_recovery' : 'sertijab',
        title: `Sertijab Pengurus Baru (${sertijabForm.newTermStart.slice(0, 4)}–${sertijabForm.newTermEnd.slice(0, 4)})`,
        note:
          sertijabForm.note.trim() ||
          `Serah terima jabatan resmi & kunci saldo kas Rp ${kasBalance.toLocaleString('id-ID')}.`,
        proposedOfficers: incomingOfficers,
        proposedTermStartDate: sertijabForm.newTermStart || todayIso,
        proposedTermEndDate: sertijabForm.newTermEnd || defaultNextEnd,
        proposedGracePeriodDays: parseInt(sertijabForm.graceDays, 10) || 14,
        proposedSkNumber: sertijabForm.skNumber.trim() || `BAST-${todayIso}`,
      });
      showNotification(res.message);
      if (res.ok) setActiveSubForm(null);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleApproveAction = async (action: RtGovernanceAction) => {
    setIsSyncing(true);
    try {
      const res = await RtGovernanceCloudService.approveGovernanceAction(workspace, action);
      showNotification(res.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExecuteAction = async (action: RtGovernanceAction) => {
    setIsSyncing(true);
    try {
      const res = await RtGovernanceCloudService.executeGovernanceAction(workspace, action);
      showNotification(res.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const pendingOrApprovedActions = governanceActions.filter(
    a => a.status === 'pending' || a.status === 'approved'
  );

  return (
    <div className="divide-y divide-slate-200 border-t border-slate-200">
      {/* 1. Server Governance & Tenure Summary */}
      <section className="p-4 space-y-3 bg-slate-50/70">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <div className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Tata Kelola Server, Masa Jabatan &amp; Anti-Monopoli</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Periode <strong>{termHealth.periodLabel}</strong> · Berakhir{' '}
              <strong className="font-mono">{termHealth.termEndDate}</strong> · Masa tenggang Sertijab{' '}
              <strong>{termHealth.gracePeriodDays} hari</strong>
              {workspace.profile.skNumber ? ` · ${workspace.profile.skNumber}` : ''}.
            </p>
          </div>
          {isCloudSignedIn && (
            <button
              type="button"
              disabled={isSyncing}
              onClick={handleManualSync}
              className="min-h-[34px] px-2.5 border border-slate-300 bg-white hover:bg-slate-50 rounded-lg text-[11px] font-bold text-slate-700 flex items-center gap-1 shrink-0"
              title="Sinkronkan dengan Server"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Sinkron</span>
            </button>
          )}
        </div>

        {/* Cloud Connection Strip */}
        {!isCloudSignedIn ? (
          <div className="p-3 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="text-[11px] text-slate-600 leading-relaxed">
              <strong className="text-slate-900 block">Simpan &amp; Kunci Masa Jabatan di Server</strong>
              Login akun Google agar &gt;2 pengurus mengakses data RT yang sama dan batas masa
              jabatan dikunci otomatis oleh server.
            </div>
            <button
              type="button"
              disabled={isSyncing}
              onClick={handleCloudSignIn}
              className="min-h-[38px] px-3.5 rounded-lg border border-[#747775] bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center justify-center gap-2 shrink-0"
            >
              <Cloud className="w-3.5 h-3.5 text-emerald-700" />
              <span>Sign in with Google</span>
            </button>
          </div>
        ) : (
          <div className="text-[11px] text-emerald-800 flex items-center justify-between gap-2">
            <span>
              Terhubung ke Server sebagai <strong>{currentEmail}</strong>
              {workspace.cloudSyncedAt
                ? ` · Sinkron ${new Date(workspace.cloudSyncedAt).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : ''}
            </span>
          </div>
        )}

        {/* Quick Election Reminder Actions */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCreateElectionInvite}
            className="min-h-[36px] px-3 border border-emerald-700 text-emerald-700 bg-white hover:bg-emerald-50 rounded-lg text-[11px] font-bold"
          >
            Undangan Rapat Pemilihan
          </button>
          <button
            type="button"
            onClick={onCreateElectionPoll}
            className="min-h-[36px] px-3 border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 rounded-lg text-[11px] font-bold"
          >
            Polling Pengurus Baru
          </button>
          {isPengurusMode && (
            <>
              <button
                type="button"
                onClick={() =>
                  setActiveSubForm(prev => (prev === 'add_officer' ? null : 'add_officer'))
                }
                className="min-h-[36px] px-3 border border-slate-300 text-slate-800 bg-white hover:bg-slate-50 rounded-lg text-[11px] font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Akun Pengurus</span>
              </button>
              {!termHealth.isReadOnlyLocked && (
                <button
                  type="button"
                  onClick={() =>
                    setActiveSubForm(prev => (prev === 'extend_term' ? null : 'extend_term'))
                  }
                  className="min-h-[36px] px-3 border border-slate-300 text-slate-800 bg-white hover:bg-slate-50 rounded-lg text-[11px] font-bold"
                >
                  Ubah Masa Bakti
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveSubForm(prev => (prev === 'sertijab' ? null : 'sertijab'))}
                className="min-h-[36px] px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold"
              >
                Serah Terima Jabatan (Sertijab)
              </button>
            </>
          )}
        </div>
      </section>

      {/* 2. Conditional Sub-Forms */}
      {activeSubForm === 'add_officer' && (
        <form onSubmit={handleAddOfficerSubmit} className="p-4 space-y-2.5 bg-white">
          <div className="text-xs font-extrabold text-slate-900">
            {officers.length < 3
              ? 'Tambah Pengurus Inti (Wajib Minimal 3 Akun Berbeda)'
              : 'Usulkan Tambah Pengurus Baru (Butuh Kuorum >=2 Pengurus)'}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              required
              value={newOfficer.name}
              onChange={e => setNewOfficer(p => ({ ...p, name: e.target.value }))}
              placeholder="Nama Lengkap *"
              className="min-h-[38px] border border-slate-300 rounded-lg px-3 text-xs"
            />
            <input
              type="text"
              required
              value={newOfficer.role}
              onChange={e => setNewOfficer(p => ({ ...p, role: e.target.value }))}
              placeholder="Jabatan (Sekretaris/Bendahara)"
              className="min-h-[38px] border border-slate-300 rounded-lg px-3 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="email"
              required
              value={newOfficer.email}
              onChange={e => setNewOfficer(p => ({ ...p, email: e.target.value }))}
              placeholder="Email Google Akun Pengurus *"
              className="min-h-[38px] border border-slate-300 rounded-lg px-3 text-xs"
            />
            <input
              type="text"
              value={newOfficer.phone}
              onChange={e => setNewOfficer(p => ({ ...p, phone: e.target.value }))}
              placeholder="No. HP / WhatsApp"
              className="min-h-[38px] border border-slate-300 rounded-lg px-3 text-xs"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={isSyncing}
              className="min-h-[38px] px-4 bg-emerald-700 text-white rounded-lg text-xs font-bold"
            >
              {officers.length < 3 ? 'Simpan Pengurus' : 'Ajukan Usulan Kuorum'}
            </button>
            <button
              type="button"
              onClick={() => setActiveSubForm(null)}
              className="min-h-[38px] px-3 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {activeSubForm === 'extend_term' && (
        <form onSubmit={handleProposeExtendTerm} className="p-4 space-y-2.5 bg-white">
          <div className="text-xs font-extrabold text-slate-900">
            Usulan Perpanjangan Masa Bakti (Kuorum &gt;=2 Pengurus)
          </div>
          <p className="text-[11px] text-slate-600">
            Demi mencegah monopoli, 1 pengurus tidak dapat memperpanjang masa jabatannya sendiri.
            Usulan wajib disetujui minimal 1 akun pengurus lain.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Berakhir Tanggal Baru
              </label>
              <input
                type="date"
                required
                value={extendEndDate}
                onChange={e => setExtendEndDate(e.target.value)}
                className="w-full min-h-[38px] border border-slate-300 rounded-lg px-2.5 text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Nomor SK / Berita Acara
              </label>
              <input
                type="text"
                value={extendSkNumber}
                onChange={e => setExtendSkNumber(e.target.value)}
                placeholder="SK-03/RW05/2027"
                className="w-full min-h-[38px] border border-slate-300 rounded-lg px-2.5 text-xs"
              />
            </div>
          </div>
          <input
            type="text"
            value={extendNote}
            onChange={e => setExtendNote(e.target.value)}
            placeholder="Catatan musyawarah warga"
            className="w-full min-h-[38px] border border-slate-300 rounded-lg px-3 text-xs"
          />
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={isSyncing}
              className="min-h-[38px] px-4 bg-emerald-700 text-white rounded-lg text-xs font-bold"
            >
              Ajukan Usulan Kuorum
            </button>
            <button
              type="button"
              onClick={() => setActiveSubForm(null)}
              className="min-h-[38px] px-3 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {activeSubForm === 'sertijab' && (
        <form onSubmit={handleProposeSertijab} className="p-4 space-y-3 bg-white">
          <div className="space-y-0.5">
            <div className="text-xs font-extrabold text-slate-900">
              Berita Acara Serah Terima Jabatan (Sertijab)
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Mengunci saldo akhir kas periode {termHealth.periodLabel} (
              <strong>Rp {kasBalance.toLocaleString('id-ID')}</strong>) ke Arsip Resmi, menurunkan
              hak edit pengurus lama, dan menyerahkan kendali ke <strong>3 akun pengurus baru</strong>.
            </p>
          </div>

          <div className="space-y-2 border-t border-slate-200 pt-2">
            <div className="text-[11px] font-bold text-slate-700">1. Ketua Baru</div>
            <div className="grid grid-cols-3 gap-1.5">
              <input
                type="text"
                required
                value={sertijabForm.ketuaName}
                onChange={e => setSertijabForm(p => ({ ...p, ketuaName: e.target.value }))}
                placeholder="Nama *"
                className="min-h-[36px] border border-slate-300 rounded-lg px-2 text-xs"
              />
              <input
                type="email"
                required
                value={sertijabForm.ketuaEmail}
                onChange={e => setSertijabForm(p => ({ ...p, ketuaEmail: e.target.value }))}
                placeholder="Email Google *"
                className="min-h-[36px] border border-slate-300 rounded-lg px-2 text-xs"
              />
              <input
                type="text"
                value={sertijabForm.ketuaPhone}
                onChange={e => setSertijabForm(p => ({ ...p, ketuaPhone: e.target.value }))}
                placeholder="No HP"
                className="min-h-[36px] border border-slate-300 rounded-lg px-2 text-xs"
              />
            </div>

            <div className="text-[11px] font-bold text-slate-700">2. Sekretaris Baru</div>
            <div className="grid grid-cols-3 gap-1.5">
              <input
                type="text"
                required
                value={sertijabForm.sekretarisName}
                onChange={e => setSertijabForm(p => ({ ...p, sekretarisName: e.target.value }))}
                placeholder="Nama *"
                className="min-h-[36px] border border-slate-300 rounded-lg px-2 text-xs"
              />
              <input
                type="email"
                required
                value={sertijabForm.sekretarisEmail}
                onChange={e => setSertijabForm(p => ({ ...p, sekretarisEmail: e.target.value }))}
                placeholder="Email Google *"
                className="min-h-[36px] border border-slate-300 rounded-lg px-2 text-xs"
              />
              <input
                type="text"
                value={sertijabForm.sekretarisPhone}
                onChange={e => setSertijabForm(p => ({ ...p, sekretarisPhone: e.target.value }))}
                placeholder="No HP"
                className="min-h-[36px] border border-slate-300 rounded-lg px-2 text-xs"
              />
            </div>

            <div className="text-[11px] font-bold text-slate-700">3. Bendahara Baru</div>
            <div className="grid grid-cols-3 gap-1.5">
              <input
                type="text"
                required
                value={sertijabForm.bendaharaName}
                onChange={e => setSertijabForm(p => ({ ...p, bendaharaName: e.target.value }))}
                placeholder="Nama *"
                className="min-h-[36px] border border-slate-300 rounded-lg px-2 text-xs"
              />
              <input
                type="email"
                required
                value={sertijabForm.bendaharaEmail}
                onChange={e => setSertijabForm(p => ({ ...p, bendaharaEmail: e.target.value }))}
                placeholder="Email Google *"
                className="min-h-[36px] border border-slate-300 rounded-lg px-2 text-xs"
              />
              <input
                type="text"
                value={sertijabForm.bendaharaPhone}
                onChange={e => setSertijabForm(p => ({ ...p, bendaharaPhone: e.target.value }))}
                placeholder="No HP"
                className="min-h-[36px] border border-slate-300 rounded-lg px-2 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-bold text-slate-600 block mb-1">Mulai Baru</label>
              <input
                type="date"
                required
                value={sertijabForm.newTermStart}
                onChange={e => setSertijabForm(p => ({ ...p, newTermStart: e.target.value }))}
                className="w-full min-h-[36px] border border-slate-300 rounded-lg px-2 text-[11px] font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-600 block mb-1">Selesai Baru</label>
              <input
                type="date"
                required
                value={sertijabForm.newTermEnd}
                onChange={e => setSertijabForm(p => ({ ...p, newTermEnd: e.target.value }))}
                className="w-full min-h-[36px] border border-slate-300 rounded-lg px-2 text-[11px] font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-600 block mb-1">Tenggang (Hari)</label>
              <input
                type="number"
                min={0}
                max={60}
                value={sertijabForm.graceDays}
                onChange={e => setSertijabForm(p => ({ ...p, graceDays: e.target.value }))}
                className="w-full min-h-[36px] border border-slate-300 rounded-lg px-2 text-[11px] font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={sertijabForm.skNumber}
              onChange={e => setSertijabForm(p => ({ ...p, skNumber: e.target.value }))}
              placeholder="No. SK / Berita Acara"
              className="min-h-[38px] border border-slate-300 rounded-lg px-2.5 text-xs"
            />
            <input
              type="text"
              value={sertijabForm.note}
              onChange={e => setSertijabForm(p => ({ ...p, note: e.target.value }))}
              placeholder="Catatan Sertijab & Inventaris"
              className="min-h-[38px] border border-slate-300 rounded-lg px-2.5 text-xs"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSyncing}
              className="min-h-[40px] px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold"
            >
              Ajukan Sertijab (Kuorum &gt;=2)
            </button>
            <button
              type="button"
              onClick={() => setActiveSubForm(null)}
              className="min-h-[40px] px-3 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {/* 3. Pending / Approved Quorum Proposals */}
      {pendingOrApprovedActions.length > 0 && (
        <section className="divide-y divide-slate-200">
          <div className="px-4 py-2 bg-amber-50/70 text-[11px] font-bold text-amber-900">
            Persetujuan Kuorum Pengurus ({pendingOrApprovedActions.length})
          </div>
          {pendingOrApprovedActions.map(act => {
            const alreadyApproved = currentEmail ? act.approverEmails.includes(currentEmail) : false;
            const quorumReady = act.approverEmails.length >= 2 && act.status === 'approved';
            return (
              <div key={act.id} className="px-4 py-3 space-y-2 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900">{act.title}</div>
                    <div className="text-[11px] text-slate-600 mt-0.5">{act.note}</div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Pengusul: {act.proposedByEmail} · Disetujui ({act.approverEmails.length}/2):{' '}
                      <span className="font-mono">{act.approverEmails.join(', ')}</span>
                    </div>
                  </div>
                  <span
                    className={`text-[11px] font-bold shrink-0 ${
                      quorumReady ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {quorumReady ? 'Kuorum Sah' : 'Menunggu +1'}
                  </span>
                </div>

                {isPengurusMode && (
                  <div className="flex flex-wrap gap-2">
                    {act.status === 'pending' && !alreadyApproved && (
                      <button
                        type="button"
                        disabled={isSyncing}
                        onClick={() => handleApproveAction(act)}
                        className="min-h-[34px] px-3 bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Setujui Usulan (Kuorum)</span>
                      </button>
                    )}
                    {act.status === 'pending' && alreadyApproved && (
                      <span className="text-[11px] text-slate-500 py-1.5">
                        Anda sudah menyetujui — menunggu 1 akun pengurus lain untuk login &amp;
                        menyetujui.
                      </span>
                    )}
                    {quorumReady && (
                      <button
                        type="button"
                        disabled={isSyncing}
                        onClick={() => handleExecuteAction(act)}
                        className="min-h-[34px] px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Sahkan &amp; Terapkan Sekarang</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* 4. Registered Officer Accounts (>2 People) */}
      <section className="divide-y divide-slate-200">
        <div className="px-4 py-2 bg-slate-50 flex items-center justify-between text-[11px] font-bold text-slate-600">
          <span className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span>Akun Pemegang Hak Pengurus ({officers.length} Orang)</span>
          </span>
          <span className={officers.length >= 3 ? 'text-emerald-700' : 'text-amber-700'}>
            {officers.length >= 3 ? 'Kuorum Anti-Monopoli Aktif' : 'Minimal 3 Akun Disarankan'}
          </span>
        </div>
        {officers.map(off => (
          <div key={off.id} className="px-4 py-3 flex items-center justify-between gap-2 text-xs">
            <div className="min-w-0">
              <div className="font-bold text-slate-900">
                {off.name} · <span className="text-emerald-700">{off.role}</span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono truncate">
                {off.email} · {off.phone}
              </div>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 shrink-0">
              Sejak {off.appointedAt}
            </span>
          </div>
        ))}
      </section>

      {/* 5. Immutable Sertijab Handover History */}
      <section className="divide-y divide-slate-200">
        <div className="px-4 py-2 bg-slate-50 text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
          <Archive className="w-3.5 h-3.5 text-slate-500" />
          <span>Riwayat Serah Terima Jabatan (Sertijab · Permanen)</span>
        </div>
        {handovers.length === 0 ? (
          <div className="px-4 py-3 text-[11px] text-slate-500">
            Belum ada riwayat Sertijab tercatat. Saat pergantian pengurus disahkan, Berita Acara
            dan saldo akhir kas otomatis terkunci di sini.
          </div>
        ) : (
          handovers.map(ho => (
            <div key={ho.id} className="px-4 py-3 space-y-1 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-900">
                  Sertijab Periode {ho.periodLabel} · {ho.handoverDate}
                </span>
                <span className="font-mono font-bold text-emerald-700 shrink-0">
                  Kas Rp {ho.closingBalance.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="text-[11px] text-slate-600">
                SK/BAST: {ho.skNumber} · {ho.note}
              </div>
              <div className="text-[11px] text-slate-500">
                Pengurus Baru: {ho.incomingOfficerEmails.join(', ')} · Kuorum Sah:{' '}
                {ho.approvedByEmails.join(', ')}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
};

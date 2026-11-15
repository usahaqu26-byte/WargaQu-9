import React, { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  KeyRound,
  Send,
  Upload,
  UserCheck,
  Archive,
  RefreshCw,
} from 'lucide-react';
import {
  CommunityInvitation,
  InvitationEventType,
  PaguyubanProfile,
  RtSiagaStorage,
  WargaMember,
} from '../../services/rtSiagaStorage';
import { RtExcelService, SmartExcelPreview } from '../../services/rtExcelService';

export type ExtraSheetType =
  | 'import_excel'
  | 'klaim_profil'
  | 'buat_undangan'
  | 'arsip_tahunan';

interface RtExcelAndClaimSheetProps {
  sheetType: ExtraSheetType;
  profile: PaguyubanProfile;
  brandTitle: string;
  currentUser: WargaMember;
  members: WargaMember[];
  onClose: () => void;
  showNotification: (msg: string) => void;
}

export const RtExcelAndClaimSheet: React.FC<RtExcelAndClaimSheetProps> = ({
  sheetType,
  profile,
  brandTitle,
  currentUser,
  members,
  onClose,
  showNotification,
}) => {
  // --- Smart Excel Import State ---
  const [preview, setPreview] = useState<SmartExcelPreview | null>(null);
  const [importMode, setImportMode] = useState<'fresh_2026' | 'merge'>('fresh_2026');
  const [openingBalanceInput, setOpeningBalanceInput] = useState<string>('12420000');
  const [openingNoteInput, setOpeningNoteInput] = useState<string>(
    `Saldo Awal Lembaran Baru ${profile.year}`
  );
  const [includeArchives, setIncludeArchives] = useState<boolean>(true);
  const [isParsing, setIsParsing] = useState<boolean>(false);

  // --- Claim Profile State ---
  const [claimCode, setClaimCode] = useState<string>('');
  const [phoneLast4, setPhoneLast4] = useState<string>('');

  // --- Create Invitation State ---
  const [invForm, setInvForm] = useState<{
    eventType: InvitationEventType;
    title: string;
    dateTime: string;
    location: string;
    targetAudience: string;
    agenda: string;
  }>({
    eventType: 'Rapat Warga',
    title: '',
    dateTime: '',
    location: 'Balai Warga',
    targetAudience: `Seluruh Warga ${profile.orgName}`,
    agenda: '',
  });

  // --- Add Historical Archive Year State ---
  const [archiveForm, setArchiveForm] = useState({
    year: '2025',
    totalIncome: '',
    totalExpense: '',
    endingBalance: '',
    note: '',
  });
  const [freshBalance, setFreshBalance] = useState('12420000');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsing(true);
    try {
      const result = await RtExcelService.parseSmartExcelFile(file);
      setPreview(result);
      if (result.detectedOpeningBalance > 0) {
        setOpeningBalanceInput(String(result.detectedOpeningBalance));
        setOpeningNoteInput(result.detectedOpeningNote);
      }
      showNotification(
        `Berhasil membaca ${result.detectedMembers.length} warga & poin penting dari Excel.`
      );
    } catch {
      showNotification('File Excel tidak terbaca. Gunakan format .xlsx, .xls, atau .csv.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleLoadSampleExcel = () => {
    const sample = RtExcelService.buildSampleSmartPreview(profile);
    setPreview(sample);
    setOpeningBalanceInput(String(sample.detectedOpeningBalance));
    setOpeningNoteInput(sample.detectedOpeningNote);
    showNotification('Contoh pembacaan pintar Excel 2020–2025 siap ditinjau.');
  };

  const handleApplyImport = () => {
    if (!preview) return;
    const balanceNum = parseInt(openingBalanceInput.replace(/\D/g, ''), 10) || 0;
    RtSiagaStorage.applySmartExcelImport({
      mode: importMode,
      openingBalance: balanceNum,
      openingBalanceNote: openingNoteInput,
      importedMembers: preview.detectedMembers,
      importedArchives: includeArchives ? preview.detectedArchives : [],
    });
    showNotification(
      `Impor selesai: ${preview.detectedMembers.length} warga pra-terdaftar siap diundang & diklaim!`
    );
    onClose();
  };

  const handleClaimSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = RtSiagaStorage.claimMemberProfile(claimCode, phoneLast4);
    showNotification(res.message);
    if (res.ok) {
      onClose();
    }
  };

  const handleInvitationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invForm.title.trim() || !invForm.dateTime.trim()) {
      showNotification('Judul acara dan waktu wajib diisi.');
      return;
    }
    const payload: Omit<CommunityInvitation, 'id' | 'createdAt' | 'rsvps'> = {
      eventType: invForm.eventType,
      title: invForm.title.trim(),
      dateTime: invForm.dateTime.trim(),
      location: invForm.location.trim() || profile.orgName,
      targetAudience: invForm.targetAudience.trim() || 'Seluruh Warga',
      agenda: invForm.agenda.trim() || 'Sesuai susunan acara pengurus.',
      senderName: `${currentUser.name} (${profile.orgName})`,
    };
    RtSiagaStorage.addInvitation(payload);
    showNotification('Undangan warga diterbitkan & siap dibagikan!');
    onClose();
  };

  const handleAddArchiveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const yr = parseInt(archiveForm.year, 10);
    const inc = parseInt(archiveForm.totalIncome.replace(/\D/g, ''), 10) || 0;
    const exp = parseInt(archiveForm.totalExpense.replace(/\D/g, ''), 10) || 0;
    const end = parseInt(archiveForm.endingBalance.replace(/\D/g, ''), 10) || Math.max(0, inc - exp);
    if (!yr || yr < 2010 || yr > 2030) {
      showNotification('Masukkan tahun arsip yang valid (misal 2020 - 2025).');
      return;
    }
    RtSiagaStorage.addArchive({
      year: yr,
      totalIncome: inc,
      totalExpense: exp,
      endingBalance: end,
      note: archiveForm.note.trim() || `Rekap tutup buku ${yr}`,
      source: 'Manual',
    });
    showNotification(`Arsip ringkas tahun ${yr} disimpan.`);
    setArchiveForm({
      year: String(yr - 1),
      totalIncome: '',
      totalExpense: '',
      endingBalance: '',
      note: '',
    });
  };

  const handleStartFresh2026 = () => {
    const num = parseInt(freshBalance.replace(/\D/g, ''), 10) || 0;
    RtSiagaStorage.startFreshYear2026(num, `Saldo Awal Pindahan Lembaran Baru ${profile.year}`);
    showNotification(`Lembaran Baru ${profile.year} dimulai dengan Saldo Awal Rp ${num.toLocaleString('id-ID')}`);
    onClose();
  };

  if (sheetType === 'import_excel') {
    return (
      <div className="space-y-3.5 text-xs">
        <p className="text-[11px] text-slate-600 leading-relaxed">
          Unggah file Excel lama pengurus (`.xlsx` / `.xls` / `.csv`). Sistem hanya mengambil{' '}
          <strong>poin pentingnya saja</strong> (Daftar Warga + Saldo Awal {profile.year} + Rekap
          Tahunan) agar lembaran baru {profile.year} langsung bersih dan warga bisa dikirimi Kode Klaim.
        </p>

        <div className="flex flex-wrap gap-2">
          <label className="flex-1 min-h-[42px] px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>{isParsing ? 'Membaca File...' : 'Pilih File Excel'}</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
          <button
            type="button"
            onClick={() => RtExcelService.downloadTemplateExcel(profile)}
            className="min-h-[42px] px-3 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-bold flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Template</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleLoadSampleExcel}
          className="w-full py-2 text-[11px] font-bold text-emerald-700 border border-dashed border-emerald-400 rounded-lg hover:bg-emerald-50"
        >
          Simulasi Uji: Baca Contoh Excel 2020–2025 → Lembaran Baru {profile.year}
        </button>

        {preview && (
          <div className="border-t border-slate-200 pt-3 space-y-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-900 flex items-center gap-1.5 truncate">
                <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
                <span className="truncate">{preview.fileName}</span>
              </span>
              {preview.ignoredHistoricalRowsCount > 0 && (
                <span className="text-slate-500 shrink-0">
                  {preview.ignoredHistoricalRowsCount} baris lama dilewati
                </span>
              )}
            </div>

            <div className="divide-y divide-slate-200 border-y border-slate-200">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-600">Warga Pra-Terdaftar Terbaca</span>
                <strong className="text-emerald-700 font-mono">
                  {preview.detectedMembers.length} KK (Status: Belum Klaim)
                </strong>
              </div>
              <div className="py-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-600 font-semibold">
                    Saldo Awal {profile.year} (Rp)
                  </label>
                  <input
                    type="number"
                    value={openingBalanceInput}
                    onChange={e => setOpeningBalanceInput(e.target.value)}
                    className="w-36 min-h-[34px] border border-slate-300 rounded-lg px-2 text-right font-mono font-bold"
                  />
                </div>
                <input
                  type="text"
                  value={openingNoteInput}
                  onChange={e => setOpeningNoteInput(e.target.value)}
                  className="w-full min-h-[34px] border border-slate-300 rounded-lg px-2.5 text-[11px]"
                />
              </div>
              {preview.detectedArchives.length > 0 && (
                <label className="py-2.5 flex items-center justify-between gap-2 cursor-pointer">
                  <span className="text-slate-600">
                    Simpan {preview.detectedArchives.length} rekap arsip tahun lalu (
                    {preview.detectedArchives.map(a => a.year).join(', ')})
                  </span>
                  <input
                    type="checkbox"
                    checked={includeArchives}
                    onChange={e => setIncludeArchives(e.target.checked)}
                    className="w-4 h-4 accent-emerald-700"
                  />
                </label>
              )}
            </div>

            {preview.detectedMembers.length > 0 && (
              <div className="space-y-1">
                <div className="text-[11px] font-bold text-slate-500 uppercase">
                  Pratinjau Warga Terbaca:
                </div>
                <div className="divide-y divide-slate-100 max-h-28 overflow-y-auto border-y border-slate-100">
                  {preview.detectedMembers.slice(0, 6).map((m, i) => (
                    <div key={i} className="py-1.5 flex items-center justify-between text-[11px]">
                      <span className="truncate font-semibold text-slate-800">
                        {m.name} · {m.block}
                      </span>
                      <span className="text-slate-500 font-mono shrink-0">
                        Lunas {m.paidMonthsCount} bln
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-700">Metode Penerapan:</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setImportMode('fresh_2026')}
                  className={`p-2 rounded-lg border text-left text-[11px] ${
                    importMode === 'fresh_2026'
                      ? 'border-emerald-700 bg-emerald-50/50 text-emerald-900 font-bold'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <div>Lembaran Baru {profile.year}</div>
                  <div className="text-[10px] font-normal text-slate-500">
                    Reset kas ke Saldo Awal
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('merge')}
                  className={`p-2 rounded-lg border text-left text-[11px] ${
                    importMode === 'merge'
                      ? 'border-emerald-700 bg-emerald-50/50 text-emerald-900 font-bold'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <div>Gabung Data Sekarang</div>
                  <div className="text-[10px] font-normal text-slate-500">
                    Tambah warga baru saja
                  </div>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleApplyImport}
              className="w-full min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold"
            >
              Terapkan ke {brandTitle}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (sheetType === 'klaim_profil') {
    return (
      <div className="space-y-4 text-xs">
        <p className="text-[11px] text-slate-600 leading-relaxed">
          Jika nama Anda sudah didaftarkan pengurus dari Excel, masukkan{' '}
          <strong>Kode Klaim</strong> dari pesan WhatsApp pengurus dan{' '}
          <strong>4 digit terakhir No HP</strong> Anda untuk menghubungkan kartu iuran & akses{' '}
          {brandTitle}.
        </p>

        <form onSubmit={handleClaimSubmit} className="space-y-3">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Kode Klaim Undangan</label>
            <input
              type="text"
              required
              value={claimCode}
              onChange={e => setClaimCode(e.target.value.toUpperCase())}
              placeholder="Contoh: RT03-B09-5588"
              className="w-full min-h-[42px] border border-slate-300 rounded-lg px-3 font-mono uppercase tracking-wider"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Verifikasi 4 Digit Terakhir No HP
            </label>
            <input
              type="text"
              maxLength={4}
              required
              value={phoneLast4}
              onChange={e => setPhoneLast4(e.target.value.replace(/\D/g, ''))}
              placeholder="Contoh: 5588"
              className="w-full min-h-[42px] border border-slate-300 rounded-lg px-3 font-mono tracking-widest"
            />
          </div>
          <button
            type="submit"
            className="w-full min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold flex items-center justify-center gap-1.5"
          >
            <KeyRound className="w-4 h-4" />
            <span>Klaim & Hubungkan Profil Saya</span>
          </button>
        </form>

        <div className="border-t border-slate-200 pt-3 space-y-2">
          <div className="text-[11px] font-bold text-slate-500 uppercase">
            Simulasi Uji Klaim / Ganti Warga Aktif
          </div>
          <div className="divide-y divide-slate-200 border-y border-slate-200">
            {members.map(m => {
              const last4 = m.phone.replace(/\D/g, '').slice(-4) || '0000';
              return (
                <div key={m.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">
                      {m.name} {m.isCurrentUser ? '(Aktif Sekarang)' : ''}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {m.block} · Kode: {m.claimCode} · HP: ••••{last4}
                    </div>
                  </div>
                  {m.claimStatus !== 'claimed' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setClaimCode(m.claimCode || '');
                        setPhoneLast4(last4);
                      }}
                      className="px-2.5 py-1.5 border border-emerald-700 text-emerald-700 rounded-lg text-[11px] font-bold shrink-0"
                    >
                      Isi Kode
                    </button>
                  ) : !m.isCurrentUser ? (
                    <button
                      type="button"
                      onClick={() => {
                        RtSiagaStorage.switchCurrentUser(m.id);
                        showNotification(`Beralih ke akun ${m.name} (${m.block}).`);
                        onClose();
                      }}
                      className="px-2.5 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-[11px] font-semibold shrink-0 flex items-center gap-1"
                    >
                      <UserCheck className="w-3 h-3" />
                      <span>Pakai</span>
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (sheetType === 'buat_undangan') {
    return (
      <form onSubmit={handleInvitationSubmit} className="space-y-3 text-xs">
        <div>
          <label className="font-bold text-slate-700 block mb-1">Jenis Acara</label>
          <select
            value={invForm.eventType}
            onChange={e =>
              setInvForm(prev => ({
                ...prev,
                eventType: e.target.value as InvitationEventType,
              }))
            }
            className="w-full min-h-[40px] border border-slate-300 rounded-lg px-2.5"
          >
            <option value="Rapat Warga">Rapat Warga</option>
            <option value="Kerja Bakti">Kerja Bakti</option>
            <option value="Acara Lingkungan">Acara Lingkungan / Syukuran</option>
            <option value="Rapat Pengurus">Rapat Pengurus</option>
          </select>
        </div>
        <div>
          <label className="font-bold text-slate-700 block mb-1">Judul Undangan</label>
          <input
            type="text"
            required
            value={invForm.title}
            onChange={e => setInvForm(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Contoh: Undangan Rapat Bulanan & Laporan Kas"
            className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Hari & Jam</label>
            <input
              type="text"
              required
              value={invForm.dateTime}
              onChange={e => setInvForm(prev => ({ ...prev, dateTime: e.target.value }))}
              placeholder="Sabtu, 21 Nov · 19:30"
              className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1">Lokasi</label>
            <input
              type="text"
              value={invForm.location}
              onChange={e => setInvForm(prev => ({ ...prev, location: e.target.value }))}
              placeholder="Balai Warga"
              className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3"
            />
          </div>
        </div>
        <div>
          <label className="font-bold text-slate-700 block mb-1">Tujuan Undangan</label>
          <input
            type="text"
            value={invForm.targetAudience}
            onChange={e => setInvForm(prev => ({ ...prev, targetAudience: e.target.value }))}
            className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3"
          />
        </div>
        <div>
          <label className="font-bold text-slate-700 block mb-1">Agenda / Catatan</label>
          <textarea
            rows={3}
            value={invForm.agenda}
            onChange={e => setInvForm(prev => ({ ...prev, agenda: e.target.value }))}
            placeholder="Tuliskan agenda singkat atau perlengkapan yang dibawa..."
            className="w-full border border-slate-300 rounded-lg p-3"
          />
        </div>
        <button
          type="submit"
          className="w-full min-h-[44px] bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5"
        >
          <Send className="w-4 h-4" />
          <span>Terbitkan Undangan + RSVP</span>
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-4 text-xs">
      <div className="space-y-2 border-b border-slate-200 pb-4">
        <div className="font-bold text-slate-900 flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5 text-emerald-700" />
          <span>Mulai Lembaran Baru Tahun {profile.year}</span>
        </div>
        <p className="text-[11px] text-slate-600">
          Tidak perlu memindahkan rincian harian tahun 2020–2025. Cukup masukkan{' '}
          <strong>Saldo Akhir</strong> kemarin sebagai Saldo Awal {profile.year}.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={freshBalance}
            onChange={e => setFreshBalance(e.target.value)}
            placeholder="Saldo Awal Rp"
            className="flex-1 min-h-[40px] border border-slate-300 rounded-lg px-3 font-mono"
          />
          <button
            type="button"
            onClick={handleStartFresh2026}
            className="min-h-[40px] px-3 bg-emerald-700 text-white rounded-lg font-bold shrink-0"
          >
            Reset ke {profile.year}
          </button>
        </div>
      </div>

      <form onSubmit={handleAddArchiveSubmit} className="space-y-2.5">
        <div className="font-bold text-slate-900 flex items-center gap-1.5">
          <Archive className="w-3.5 h-3.5 text-slate-600" />
          <span>Catat Rekap Ringkas Tahun Lalu (1 Baris / Tahun)</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Tahun</label>
            <input
              type="number"
              required
              value={archiveForm.year}
              onChange={e => setArchiveForm(prev => ({ ...prev, year: e.target.value }))}
              placeholder="2020"
              className="w-full min-h-[38px] border border-slate-300 rounded-lg px-3 font-mono"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1">Saldo Akhir (Rp)</label>
            <input
              type="number"
              value={archiveForm.endingBalance}
              onChange={e => setArchiveForm(prev => ({ ...prev, endingBalance: e.target.value }))}
              placeholder="9650000"
              className="w-full min-h-[38px] border border-slate-300 rounded-lg px-3 font-mono"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Total Pemasukan</label>
            <input
              type="number"
              value={archiveForm.totalIncome}
              onChange={e => setArchiveForm(prev => ({ ...prev, totalIncome: e.target.value }))}
              placeholder="24800000"
              className="w-full min-h-[38px] border border-slate-300 rounded-lg px-3 font-mono"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1">Total Pengeluaran</label>
            <input
              type="number"
              value={archiveForm.totalExpense}
              onChange={e => setArchiveForm(prev => ({ ...prev, totalExpense: e.target.value }))}
              placeholder="18450000"
              className="w-full min-h-[38px] border border-slate-300 rounded-lg px-3 font-mono"
            />
          </div>
        </div>
        <div>
          <label className="font-bold text-slate-700 block mb-1">Catatan Tutup Buku</label>
          <input
            type="text"
            value={archiveForm.note}
            onChange={e => setArchiveForm(prev => ({ ...prev, note: e.target.value }))}
            placeholder="Contoh: Rekap manual buku bendahara 2023"
            className="w-full min-h-[38px] border border-slate-300 rounded-lg px-3"
          />
        </div>
        <button
          type="submit"
          className="w-full min-h-[42px] border border-emerald-700 text-emerald-700 hover:bg-emerald-50 rounded-xl font-bold"
        >
          Simpan ke Arsip Tahunan
        </button>
      </form>
    </div>
  );
};

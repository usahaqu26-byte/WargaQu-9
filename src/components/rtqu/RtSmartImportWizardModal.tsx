import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  ImagePlus,
  Layers,
  Plus,
  RefreshCw,
  Sparkles,
  Table2,
  Trash2,
  Upload,
  UserCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  KasCategory,
  MONTHS_12,
  OrgType,
  RtCommunityWorkspace,
  RtSiagaStorage,
} from '../../services/rtSiagaStorage';
import {
  RtExcelService,
  SmartCommunityImportDraft,
  SmartImportedKasRow,
  SmartImportedOfficerRow,
  SmartImportedWargaRow,
} from '../../services/rtExcelService';
import { AuthService } from '../../services/authService';
import { InviteRelayService } from '../../services/inviteRelayService';
import { RtGovernanceCloudService } from '../../services/rtGovernanceCloudService';
import { RtInviteQrBlock } from './RtInviteQrBlock';

interface RtSmartImportWizardModalProps {
  open: boolean;
  initialOrgType?: OrgType;
  targetMode: 'create_new' | 'merge_active' | 'replace_active';
  onClose: () => void;
  onCompleted: (community: RtCommunityWorkspace, isPengurus: boolean) => void;
  showNotification: (msg: string) => void;
}

interface QueuedFileItem {
  id: string;
  file: File;
  kind: 'excel' | 'image' | 'pdf';
}

type ReviewTab = 'profil_pengurus' | 'warga_iuran' | 'kas_transaksi';

const KAS_CATEGORIES: KasCategory[] = [
  'Iuran Warga',
  'Donasi / Kas',
  'Gaji Keamanan',
  'Petugas Sampah',
  'Listrik & Pos Ronda',
  'Perbaikan Fasilitas',
];

function sanitizeOrgType(raw: unknown, fallback: OrgType): OrgType {
  const s = String(raw || '').toLowerCase();
  if (s.includes('paguyuban') || s.includes('cluster')) return 'Paguyuban';
  if (s.includes('sosial') || s.includes('dkm') || s.includes('masjid') || s.includes('panti')) {
    return 'Sosial';
  }
  if (s.includes('organisasi') || s.includes('ormas') || s.includes('alumni') || s.includes('karang')) {
    return 'Organisasi';
  }
  if (s.includes('rt') || s.includes('rw')) return 'RT';
  return fallback;
}

function sanitizeKasCategory(rawCat: unknown, title: string, type: 'masuk' | 'keluar'): KasCategory {
  const s = `${String(rawCat || '')} ${title}`.toLowerCase();
  const exact = KAS_CATEGORIES.find(c => c.toLowerCase() === String(rawCat || '').trim().toLowerCase());
  if (exact) return exact;
  if (s.includes('keamanan') || s.includes('satpam') || s.includes('sekuriti')) {
    return type === 'keluar' ? 'Gaji Keamanan' : 'Iuran Warga';
  }
  if (s.includes('sampah') || s.includes('kebersihan')) return 'Petugas Sampah';
  if (s.includes('listrik') || s.includes('pos') || s.includes('pln')) return 'Listrik & Pos Ronda';
  if (s.includes('iuran') || s.includes('bulanan')) return 'Iuran Warga';
  if (type === 'masuk') return 'Donasi / Kas';
  return 'Perbaikan Fasilitas';
}

async function compressImageToBase64(file: File): Promise<{ mimeType: string; base64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca gambar.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar tidak valid.'));
      img.onload = () => {
        const maxDim = 1600;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas tidak tersedia.'));
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.84);
        const b64 = dataUrl.split(',')[1] || '';
        resolve({ mimeType: 'image/jpeg', base64: b64 });
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

async function fileToRawBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Gagal membaca ${file.name}`));
    reader.onload = () => {
      const res = String(reader.result || '');
      resolve(res.includes('base64,') ? res.split('base64,')[1] || '' : res);
    };
    reader.readAsDataURL(file);
  });
}

export const RtSmartImportWizardModal: React.FC<RtSmartImportWizardModalProps> = ({
  open,
  initialOrgType = 'RT',
  targetMode,
  onClose,
  onCompleted,
  showNotification,
}) => {
  const acc = AuthService.getAccount();
  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload');
  const [orgTypeHint, setOrgTypeHint] = useState<OrgType>(initialOrgType);
  const [queuedFiles, setQueuedFiles] = useState<QueuedFileItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeStatusText, setAnalyzeStatusText] = useState('');
  const [analyzeError, setAnalyzeError] = useState('');

  const [draft, setDraft] = useState<SmartCommunityImportDraft>({
    profile: {
      orgType: initialOrgType,
      customBrandName: '',
      orgName: '',
      areaName: '',
      monthlyDuesAmount: 50000,
      year: new Date().getFullYear(),
      openingBalance: 0,
      openingBalanceNote: '',
    },
    officers: [],
    members: [],
    transactions: [],
    archives: [],
  });

  const [reviewTab, setReviewTab] = useState<ReviewTab>('warga_iuran');
  const [creatorKind, setCreatorKind] = useState<'warga_perintis' | 'pengurus'>('warga_perintis');
  const [creatorName, setCreatorName] = useState<string>(() =>
    acc ? AuthService.getDisplayName(acc) : ''
  );
  const [creatorBlock, setCreatorBlock] = useState<string>('');
  const [creatorPhone, setCreatorPhone] = useState<string>(acc?.phone || '');
  const [applyMode, setApplyMode] = useState<'create_new' | 'merge_active' | 'replace_active'>(
    targetMode
  );

  // Step 3 (Done + Barcode QR)
  const [generatedCommunity, setGeneratedCommunity] = useState<RtCommunityWorkspace | null>(null);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string>('');
  const [generatedCompactToken, setGeneratedCompactToken] = useState<string>('');

  useEffect(() => {
    if (open) {
      setStep('upload');
      setOrgTypeHint(initialOrgType);
      setApplyMode(targetMode);
      setQueuedFiles([]);
      setAnalyzeError('');
      setAnalyzeStatusText('');
      setGeneratedCommunity(null);
      setGeneratedInviteUrl('');
      setGeneratedCompactToken('');
    }
  }, [open, initialOrgType, targetMode]);

  const kasTotals = useMemo(() => {
    let masuk = 0;
    let keluar = 0;
    draft.transactions.forEach(t => {
      if (t.type === 'masuk') masuk += Number(t.amount) || 0;
      else keluar += Number(t.amount) || 0;
    });
    const opening = Number(draft.profile.openingBalance) || 0;
    return { masuk, keluar, saldo: opening + masuk - keluar };
  }, [draft.transactions, draft.profile.openingBalance]);

  if (!open) return null;

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    e.target.value = '';
    if (fileList.length === 0) return;

    const added: QueuedFileItem[] = [];
    for (const file of fileList) {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) {
        added.push({ id: `f-${Date.now()}-${Math.random()}`, file, kind: 'excel' });
      } else if (file.type === 'application/pdf' || lower.endsWith('.pdf')) {
        added.push({ id: `f-${Date.now()}-${Math.random()}`, file, kind: 'pdf' });
      } else if (file.type.startsWith('image/')) {
        added.push({ id: `f-${Date.now()}-${Math.random()}`, file, kind: 'image' });
      }
    }
    if (added.length === 0) {
      setAnalyzeError('Format belum didukung. Pilih Excel (.xlsx/.xls/.csv), Foto/SS, atau PDF.');
      return;
    }
    setAnalyzeError('');
    setQueuedFiles(prev => [...prev, ...added].slice(0, 12));
  };

  const normalizeAiDraft = (raw: Record<string, unknown>): SmartCommunityImportDraft => {
    const rawProf = (raw.profile || {}) as Record<string, unknown>;
    const normalizedType = sanitizeOrgType(rawProf.orgType, orgTypeHint);
    const yearVal = Number(rawProf.year) || new Date().getFullYear();

    const officers: SmartImportedOfficerRow[] = Array.isArray(raw.officers)
      ? raw.officers
          .map(o => {
            const r = o as Record<string, unknown>;
            return {
              name: String(r.name || '').trim(),
              role: String(r.role || 'Pengurus').trim(),
              division: String(r.division || 'Pengurus Inti').trim(),
              phone: String(r.phone || '-').trim(),
              email: String(r.email || '').trim().toLowerCase(),
            };
          })
          .filter(o => o.name.length > 0)
      : [];

    const members: SmartImportedWargaRow[] = Array.isArray(raw.members)
      ? raw.members
          .map((m, idx) => {
            const r = m as Record<string, unknown>;
            const rawPaidArr = Array.isArray(r.paidMonths)
              ? r.paidMonths
                  .map(n => Number(n))
                  .filter(n => Number.isInteger(n) && n >= 1 && n <= 12)
              : [];
            const rawCount = Math.max(0, Math.min(12, Math.round(Number(r.paidMonthsCount) || 0)));
            const paidMonths =
              rawPaidArr.length > 0
                ? Array.from(new Set(rawPaidArr)).sort((a, b) => a - b)
                : Array.from({ length: rawCount }, (_, i) => i + 1);
            const resTypeStr = String(r.residentType || '').toLowerCase();
            return {
              name: String(r.name || '').trim(),
              block: String(r.block || '').trim() || `Unit ${idx + 1}`,
              phone: String(r.phone || '-').trim(),
              residentType: resTypeStr.includes('kontrak') ? ('Kontrak' as const) : ('Tetap' as const),
              paidMonthsCount: paidMonths.length,
              paidMonths,
              priorArrears: Math.max(0, Math.round(Number(r.priorArrears) || 0)),
              priorArrearsNote: r.priorArrearsNote ? String(r.priorArrearsNote).trim() : undefined,
            };
          })
          .filter(m => m.name.length > 0)
      : [];

    const transactions: SmartImportedKasRow[] = Array.isArray(raw.transactions)
      ? raw.transactions
          .map(t => {
            const r = t as Record<string, unknown>;
            const typeVal: 'masuk' | 'keluar' =
              String(r.type || '').toLowerCase().includes('keluar') ? 'keluar' : 'masuk';
            const title = String(r.title || '').trim();
            return {
              date: String(r.date || `2026`).trim(),
              type: typeVal,
              category: sanitizeKasCategory(r.category, title, typeVal),
              title,
              amount: Math.max(0, Math.round(Number(r.amount) || 0)),
              recordedBy: String(r.recordedBy || 'Smart Import').trim(),
            };
          })
          .filter(t => t.title.length > 0 && t.amount > 0)
      : [];

    const archives = Array.isArray(raw.archives)
      ? raw.archives
          .map(a => {
            const r = a as Record<string, unknown>;
            return {
              year: Math.round(Number(r.year) || 2025),
              totalIncome: Math.max(0, Math.round(Number(r.totalIncome) || 0)),
              totalExpense: Math.max(0, Math.round(Number(r.totalExpense) || 0)),
              endingBalance: Math.max(0, Math.round(Number(r.endingBalance) || 0)),
              note: String(r.note || '').trim(),
            };
          })
          .filter(a => a.year >= 2015 && a.year <= 2035)
      : [];

    return {
      profile: {
        orgType: normalizedType,
        customBrandName: rawProf.customBrandName ? String(rawProf.customBrandName).trim() : '',
        orgName:
          String(rawProf.orgName || '').trim() ||
          (normalizedType === 'Paguyuban' ? 'Paguyuban Warga' : 'RT 01 / RW 01'),
        areaName: String(rawProf.areaName || '').trim() || 'Lingkungan Warga',
        monthlyDuesAmount: Math.max(0, Math.round(Number(rawProf.monthlyDuesAmount) || 0)),
        year: yearVal,
        openingBalance: Math.max(0, Math.round(Number(rawProf.openingBalance) || 0)),
        openingBalanceNote: String(rawProf.openingBalanceNote || '').trim(),
      },
      officers,
      members,
      transactions,
      archives,
      summaryNotes: raw.summaryNotes ? String(raw.summaryNotes) : undefined,
    };
  };

  const handleAnalyzeFiles = async (forceAiForExcel = false) => {
    if (queuedFiles.length === 0) {
      setAnalyzeError('Pilih minimal 1 file Excel, Foto/Screenshot, atau PDF.');
      return;
    }

    setIsAnalyzing(true);
    setAnalyzeError('');
    try {
      const excelFiles = queuedFiles.filter(q => q.kind === 'excel');
      const mediaFiles = queuedFiles.filter(q => q.kind === 'image' || q.kind === 'pdf');

      // Pure Excel fast local parse first
      if (mediaFiles.length === 0 && !forceAiForExcel) {
        setAnalyzeStatusText('Membaca struktur tabel Excel...');
        const previews = [];
        for (const item of excelFiles) {
          previews.push(await RtExcelService.parseSmartExcelFile(item.file));
        }
        const localDraft = RtExcelService.mergeExcelPreviewsIntoDraft(previews, orgTypeHint);
        const hasRichLocal =
          localDraft.members.length > 0 ||
          localDraft.transactions.length > 0 ||
          localDraft.officers.length > 0;

        if (hasRichLocal) {
          setDraft(localDraft);
          setReviewTab(
            localDraft.members.length > 0
              ? 'warga_iuran'
              : localDraft.transactions.length > 0
              ? 'kas_transaksi'
              : 'profil_pengurus'
          );
          setStep('review');
          showNotification(
            `Excel terbaca: ${localDraft.members.length} warga, ${localDraft.officers.length} pengurus, ${localDraft.transactions.length} kas.`
          );
          return;
        }
        // Fallback to AI if Excel columns were completely non-standard
      }

      setAnalyzeStatusText('Menyiapkan dokumen foto, screenshot, PDF & tabel...');
      const encodedMedia: Array<{ name: string; mimeType: string; base64: string }> = [];
      for (const item of mediaFiles) {
        if (item.kind === 'image') {
          const compressed = await compressImageToBase64(item.file);
          encodedMedia.push({
            name: item.file.name,
            mimeType: compressed.mimeType,
            base64: compressed.base64,
          });
        } else {
          if (item.file.size > 9 * 1024 * 1024) {
            throw new Error(`File PDF "${item.file.name}" terlalu besar (>9MB).`);
          }
          const b64 = await fileToRawBase64(item.file);
          encodedMedia.push({
            name: item.file.name,
            mimeType: 'application/pdf',
            base64: b64,
          });
        }
      }

      const textTables: Array<{ fileName: string; sheetName: string; csvText: string }> = [];
      for (const item of excelFiles) {
        const sheets = await RtExcelService.extractExcelSheetTables(item.file);
        textTables.push(...sheets);
      }

      setAnalyzeStatusText('Membaca nama warga, iuran, pengurus & mutasi kas dengan Smart AI...');
      const resp = await fetch('/api/rtqu/smart-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: encodedMedia,
          textTables,
          orgTypeHint,
          yearHint: new Date().getFullYear(),
        }),
      });

      const data = (await resp.json()) as {
        ok?: boolean;
        draft?: Record<string, unknown>;
        error?: string;
      };

      if (!resp.ok || !data?.draft) {
        throw new Error(data?.error || 'Gagal menganalisa dokumen.');
      }

      const cleanDraft = normalizeAiDraft(data.draft);
      setDraft(cleanDraft);
      setReviewTab(
        cleanDraft.members.length > 0
          ? 'warga_iuran'
          : cleanDraft.transactions.length > 0
          ? 'kas_transaksi'
          : 'profil_pengurus'
      );
      setStep('review');
      showNotification('Dokumen berhasil dibaca! Silakan cek & revisi di tabel Excel sebelum disimpan.');
    } catch (err) {
      setAnalyzeError(
        err instanceof Error ? err.message : 'Terjadi kesalahan saat membaca dokumen.'
      );
    } finally {
      setIsAnalyzing(false);
      setAnalyzeStatusText('');
    }
  };

  const handleLoadEmptyReviewTable = () => {
    setDraft({
      profile: {
        orgType: orgTypeHint,
        customBrandName: '',
        orgName: orgTypeHint === 'Paguyuban' ? 'Paguyuban Warga' : 'RT 01 / RW 01',
        areaName: 'Lingkungan Warga',
        monthlyDuesAmount: 50000,
        year: new Date().getFullYear(),
        openingBalance: 0,
        openingBalanceNote: '',
      },
      officers: [
        { name: '', role: 'Ketua', division: 'Pimpinan & Pengesahan', phone: '', email: '' },
        { name: '', role: 'Bendahara', division: 'Iuran & Transparansi Kas', phone: '', email: '' },
      ],
      members: [
        {
          name: '',
          block: 'Blok A1',
          phone: '',
          residentType: 'Tetap',
          paidMonthsCount: 0,
          paidMonths: [],
          priorArrears: 0,
        },
      ],
      transactions: [],
      archives: [],
    });
    setReviewTab('profil_pengurus');
    setStep('review');
  };

  const toggleMemberMonth = (memberIdx: number, monthNum: number) => {
    setDraft(prev => ({
      ...prev,
      members: prev.members.map((m, idx) => {
        if (idx !== memberIdx) return m;
        const current = new Set(
          m.paidMonths && m.paidMonths.length > 0
            ? m.paidMonths
            : Array.from({ length: m.paidMonthsCount || 0 }, (_, i) => i + 1)
        );
        if (current.has(monthNum)) current.delete(monthNum);
        else current.add(monthNum);
        const sorted = Array.from(current).sort((a, b) => a - b);
        return {
          ...m,
          paidMonths: sorted,
          paidMonthsCount: sorted.length,
        };
      }),
    }));
  };

  const handleSaveAndGenerateAll = async () => {
    if (!draft.profile.orgName.trim()) {
      setReviewTab('profil_pengurus');
      showNotification('Isi Nama RT / Paguyuban / Komunitas terlebih dahulu.');
      return;
    }

    const createdWs = RtSiagaStorage.applyFullSmartCommunityImport({
      targetMode: applyMode,
      creatorKind,
      creatorName: creatorName.trim() || 'Perintis Warga',
      creatorBlock: creatorBlock.trim() || 'Warga',
      creatorPhone: creatorPhone.trim() || '-',
      draft,
    });

    if (RtGovernanceCloudService.isCloudReady()) {
      void RtGovernanceCloudService.syncWorkspaceToCloud(
        createdWs,
        'Smart Import komunitas & data awal'
      );
    }

    // Build & publish live Barcode QR + short invite link immediately
    const { url } = InviteRelayService.buildTitleInviteUrl(
      'rt',
      createdWs.profile.orgName,
      createdWs.profile.orgType
    );
    setGeneratedInviteUrl(url);
    setGeneratedCommunity(createdWs);
    setStep('done');

    try {
      const tok = await RtSiagaStorage.encodeCommunityInviteCompact(
        createdWs,
        creatorName.trim() || createdWs.profile.creatorName || 'Perintis'
      );
      setGeneratedCompactToken(tok);
      await InviteRelayService.publishRoomSnapshot({
        kind: 'rt',
        title: createdWs.profile.orgName,
        inviter: creatorName.trim() || createdWs.profile.creatorName || 'Perintis',
        snapshot: tok,
      });
    } catch {
      const fallback = RtSiagaStorage.encodeCommunityInvite(
        createdWs,
        creatorName.trim() || 'Perintis'
      );
      setGeneratedCompactToken(fallback);
    }

    showNotification(
      `Berhasil generate ${createdWs.profile.orgName}: ${createdWs.members.length} warga, ${createdWs.transactions.length} kas, ${RtSiagaStorage.getOfficers(createdWs).length} pengurus!`
    );
  };

  const brandPreview =
    draft.profile.orgType === 'Organisasi'
      ? draft.profile.customBrandName?.trim() || 'OrganisasiQu'
      : draft.profile.orgType === 'Sosial'
      ? draft.profile.customBrandName?.trim() || 'SosialQu'
      : draft.profile.orgType === 'Paguyuban'
      ? 'PaguyubanQu'
      : 'RTQu';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white w-full max-w-3xl max-h-[94vh] rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden text-slate-800">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-emerald-950 text-white shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-700 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-emerald-200" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-extrabold truncate">
                Smart Import RTQu / PaguyubanQu
              </h2>
              <p className="text-[11px] text-emerald-200 truncate">
                {step === 'upload' && 'Unggah Excel, Foto Catatan, Screenshot WA, atau PDF'}
                {step === 'review' && 'Revisi hasil baca gaya Tabel Excel sebelum generate menu'}
                {step === 'done' && 'Semua menu terisi otomatis · Bagikan Barcode QR undangan'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-emerald-100"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* ==================== STEP 1: MULTI-FILE UPLOAD ==================== */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1.5">
                  1. Pilih Jenis Komunitas / Modul:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {(
                    [
                      { id: 'RT', label: 'RTQu', desc: 'RT / RW resmi' },
                      { id: 'Paguyuban', label: 'PaguyubanQu', desc: 'Cluster / Perumahan' },
                      { id: 'Organisasi', label: 'Organisasi', desc: 'Alumni / Ormas' },
                      { id: 'Sosial', label: 'Sosial / DKM', desc: 'Masjid / Yayasan' },
                    ] as Array<{ id: OrgType; label: string; desc: string }>
                  ).map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setOrgTypeHint(opt.id)}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        orgTypeHint === opt.id
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-extrabold">{opt.label}</div>
                      <div
                        className={`text-[10px] ${
                          orgTypeHint === opt.id ? 'text-emerald-100' : 'text-slate-500'
                        }`}
                      >
                        {opt.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-extrabold text-slate-700 block">
                  2. Unggah Dokumen (Bisa Gabung Beberapa Foto, Screenshot, PDF, atau Excel):
                </label>
                <label className="block border-2 border-dashed border-emerald-400 bg-emerald-50/50 hover:bg-emerald-50 rounded-2xl p-5 text-center cursor-pointer transition">
                  <Upload className="w-7 h-7 text-emerald-700 mx-auto mb-2" />
                  <div className="text-xs font-extrabold text-emerald-950">
                    Ketuk untuk pilih banyak file sekaligus
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Mendukung <strong>Excel (.xlsx/.xls/.csv)</strong>,{' '}
                    <strong>Banyak Foto / Screenshot</strong> tabel iuran/kas/WA, dan{' '}
                    <strong>PDF</strong>.
                  </p>
                  <input
                    type="file"
                    multiple
                    accept=".xlsx,.xls,.csv,.pdf,image/*"
                    onChange={handleFilesSelected}
                    className="hidden"
                  />
                </label>

                {queuedFiles.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                      <span>{queuedFiles.length} file siap dianalisa:</span>
                      <button
                        type="button"
                        onClick={() => setQueuedFiles([])}
                        className="text-rose-600 hover:underline"
                      >
                        Hapus Semua
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {queuedFiles.map(item => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {item.kind === 'excel' ? (
                              <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
                            ) : item.kind === 'pdf' ? (
                              <FileText className="w-4 h-4 text-rose-700 shrink-0" />
                            ) : (
                              <ImagePlus className="w-4 h-4 text-sky-700 shrink-0" />
                            )}
                            <span className="truncate font-semibold text-[11px] text-slate-800">
                              {item.file.name}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setQueuedFiles(prev => prev.filter(f => f.id !== item.id))
                            }
                            className="p-1 text-slate-400 hover:text-rose-600 shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {analyzeError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-semibold">
                  {analyzeError}
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600 space-y-1">
                <div className="font-bold text-slate-800">Yang akan terisi otomatis setelah revisi:</div>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Nama RT / Paguyuban, wilayah, iuran bulanan &amp; tahun buku</li>
                  <li>Daftar Pengurus (Ketua, Sekretaris, Bendahara) siap <strong>Klaim Akun</strong></li>
                  <li>Daftar Warga beserta bulan iuran yang sudah dibayar</li>
                  <li>Pemasukan &amp; Pengeluaran Kas langsung masuk ke Buku Transparansi</li>
                  <li>Langsung jadi <strong>Barcode QR Undangan</strong> (bisa dibuat warga perintis)</li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  disabled={isAnalyzing || queuedFiles.length === 0}
                  onClick={() => void handleAnalyzeFiles(false)}
                  className="flex-1 min-h-[44px] px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl font-extrabold flex items-center justify-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{analyzeStatusText || 'Menganalisa...'}</span>
                    </>
                  ) : (
                    <>
                      <Table2 className="w-4 h-4" />
                      <span>Analisa &amp; Tampilkan Tabel Excel</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  disabled={isAnalyzing}
                  onClick={handleLoadEmptyReviewTable}
                  className="min-h-[44px] px-3.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-[11px]"
                >
                  Isi Tabel Kosong Manual
                </button>
              </div>
            </div>
          )}

          {/* ==================== STEP 2: EXCEL-LIKE REVIEW & REVISION ==================== */}
          {step === 'review' && (
            <div className="space-y-3">
              {draft.summaryNotes && (
                <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 flex items-start justify-between gap-2">
                  <span>{draft.summaryNotes}</span>
                  <button
                    type="button"
                    onClick={() => setStep('upload')}
                    className="font-bold text-emerald-700 hover:underline shrink-0"
                  >
                    Unggah Ulang
                  </button>
                </div>
              )}

              {/* Spreadsheet Sheet Tabs */}
              <div className="flex items-center gap-1 border-b border-slate-300 overflow-x-auto no-scrollbar">
                {[
                  {
                    id: 'profil_pengurus' as ReviewTab,
                    label: `1. Profil & Pengurus (${draft.officers.length})`,
                    icon: Layers,
                  },
                  {
                    id: 'warga_iuran' as ReviewTab,
                    label: `2. Warga & Iuran (${draft.members.length})`,
                    icon: Users,
                  },
                  {
                    id: 'kas_transaksi' as ReviewTab,
                    label: `3. Kas Masuk/Keluar (${draft.transactions.length})`,
                    icon: Wallet,
                  },
                ].map(t => {
                  const Icon = t.icon;
                  const active = reviewTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setReviewTab(t.id)}
                      className={`px-3 py-2 text-[11px] font-extrabold border border-b-0 rounded-t-lg flex items-center gap-1.5 whitespace-nowrap transition ${
                        active
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* TAB 1: PROFIL & DAFTAR PENGURUS */}
              {reviewTab === 'profil_pengurus' && (
                <div className="space-y-3">
                  <div className="border border-slate-300 rounded-xl overflow-hidden">
                    <div className="bg-slate-100 px-3 py-1.5 text-[11px] font-extrabold text-slate-700 border-b border-slate-300">
                      Identitas RT / Paguyuban / Komunitas (Bisa Revisi Langsung)
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 bg-white">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                          Kategori Modul
                        </label>
                        <select
                          value={draft.profile.orgType}
                          onChange={e =>
                            setDraft(prev => ({
                              ...prev,
                              profile: { ...prev.profile, orgType: e.target.value as OrgType },
                            }))
                          }
                          className="w-full h-8 border border-slate-300 rounded px-2 text-xs font-bold"
                        >
                          <option value="RT">RTQu (Rukun Tetangga)</option>
                          <option value="Paguyuban">PaguyubanQu</option>
                          <option value="Organisasi">Organisasi</option>
                          <option value="Sosial">Sosial / DKM</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                          Nama RT / Paguyuban *
                        </label>
                        <input
                          type="text"
                          value={draft.profile.orgName}
                          onChange={e =>
                            setDraft(prev => ({
                              ...prev,
                              profile: { ...prev.profile, orgName: e.target.value },
                            }))
                          }
                          placeholder="RT 03 / RW 05"
                          className="w-full h-8 border border-slate-300 rounded px-2 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                          Wilayah / Perumahan
                        </label>
                        <input
                          type="text"
                          value={draft.profile.areaName}
                          onChange={e =>
                            setDraft(prev => ({
                              ...prev,
                              profile: { ...prev.profile, areaName: e.target.value },
                            }))
                          }
                          className="w-full h-8 border border-slate-300 rounded px-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                          Iuran / Bulan (Rp)
                        </label>
                        <input
                          type="number"
                          value={draft.profile.monthlyDuesAmount}
                          onChange={e =>
                            setDraft(prev => ({
                              ...prev,
                              profile: {
                                ...prev.profile,
                                monthlyDuesAmount: Math.max(0, parseInt(e.target.value, 10) || 0),
                              },
                            }))
                          }
                          className="w-full h-8 border border-slate-300 rounded px-2 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                          Tahun Buku
                        </label>
                        <input
                          type="number"
                          value={draft.profile.year}
                          onChange={e =>
                            setDraft(prev => ({
                              ...prev,
                              profile: {
                                ...prev.profile,
                                year: parseInt(e.target.value, 10) || new Date().getFullYear(),
                              },
                            }))
                          }
                          className="w-full h-8 border border-slate-300 rounded px-2 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                          Saldo Awal Buku (Rp)
                        </label>
                        <input
                          type="number"
                          value={draft.profile.openingBalance}
                          onChange={e =>
                            setDraft(prev => ({
                              ...prev,
                              profile: {
                                ...prev.profile,
                                openingBalance: Math.max(0, parseInt(e.target.value, 10) || 0),
                              },
                            }))
                          }
                          className="w-full h-8 border border-slate-300 rounded px-2 text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Spreadsheet Table: Pengurus */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold text-slate-700">
                        Tabel Pengurus (Tinggal Klaim Akun Setelah Barcode Dibagikan)
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft(prev => ({
                            ...prev,
                            officers: [
                              ...prev.officers,
                              {
                                name: '',
                                role: 'Koordinator',
                                division: 'Pengurus Inti',
                                phone: '',
                                email: '',
                              },
                            ],
                          }))
                        }
                        className="px-2.5 py-1 bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Tambah Pengurus</span>
                      </button>
                    </div>
                    <div className="overflow-x-auto border border-slate-300 rounded-xl">
                      <table className="w-full border-collapse text-[11px] min-w-[540px]">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-extrabold">
                            <th className="border-b border-r border-slate-300 px-2 py-1.5 w-8 text-center">
                              #
                            </th>
                            <th className="border-b border-r border-slate-300 px-2 py-1.5 text-left">
                              Nama Pengurus
                            </th>
                            <th className="border-b border-r border-slate-300 px-2 py-1.5 text-left">
                              Jabatan
                            </th>
                            <th className="border-b border-r border-slate-300 px-2 py-1.5 text-left">
                              Divisi
                            </th>
                            <th className="border-b border-r border-slate-300 px-2 py-1.5 text-left">
                              No HP / WA
                            </th>
                            <th className="border-b border-r border-slate-300 px-2 py-1.5 text-left">
                              Email (Opsional)
                            </th>
                            <th className="border-b border-slate-300 px-1.5 py-1.5 w-8" />
                          </tr>
                        </thead>
                        <tbody>
                          {draft.officers.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-3 text-center text-slate-400">
                                Belum ada baris pengurus terdeteksi. Klik &ldquo;Tambah Pengurus&rdquo; jika perlu.
                              </td>
                            </tr>
                          ) : (
                            draft.officers.map((off, idx) => (
                              <tr key={idx} className="odd:bg-white even:bg-slate-50/50">
                                <td className="border-b border-r border-slate-200 px-2 py-1 text-center font-mono text-slate-400">
                                  {idx + 1}
                                </td>
                                <td className="border-b border-r border-slate-200 p-0.5">
                                  <input
                                    type="text"
                                    value={off.name}
                                    onChange={e =>
                                      setDraft(prev => ({
                                        ...prev,
                                        officers: prev.officers.map((o, i) =>
                                          i === idx ? { ...o, name: e.target.value } : o
                                        ),
                                      }))
                                    }
                                    className="w-full px-1.5 py-1 bg-transparent focus:bg-emerald-50 outline-hidden font-semibold"
                                    placeholder="Nama lengkap"
                                  />
                                </td>
                                <td className="border-b border-r border-slate-200 p-0.5">
                                  <input
                                    type="text"
                                    value={off.role}
                                    onChange={e =>
                                      setDraft(prev => ({
                                        ...prev,
                                        officers: prev.officers.map((o, i) =>
                                          i === idx ? { ...o, role: e.target.value } : o
                                        ),
                                      }))
                                    }
                                    className="w-full px-1.5 py-1 bg-transparent focus:bg-emerald-50 outline-hidden"
                                    placeholder="Ketua / Bendahara"
                                  />
                                </td>
                                <td className="border-b border-r border-slate-200 p-0.5">
                                  <input
                                    type="text"
                                    value={off.division}
                                    onChange={e =>
                                      setDraft(prev => ({
                                        ...prev,
                                        officers: prev.officers.map((o, i) =>
                                          i === idx ? { ...o, division: e.target.value } : o
                                        ),
                                      }))
                                    }
                                    className="w-full px-1.5 py-1 bg-transparent focus:bg-emerald-50 outline-hidden"
                                  />
                                </td>
                                <td className="border-b border-r border-slate-200 p-0.5">
                                  <input
                                    type="text"
                                    value={off.phone}
                                    onChange={e =>
                                      setDraft(prev => ({
                                        ...prev,
                                        officers: prev.officers.map((o, i) =>
                                          i === idx ? { ...o, phone: e.target.value } : o
                                        ),
                                      }))
                                    }
                                    className="w-full px-1.5 py-1 bg-transparent focus:bg-emerald-50 outline-hidden font-mono"
                                  />
                                </td>
                                <td className="border-b border-r border-slate-200 p-0.5">
                                  <input
                                    type="text"
                                    value={off.email}
                                    onChange={e =>
                                      setDraft(prev => ({
                                        ...prev,
                                        officers: prev.officers.map((o, i) =>
                                          i === idx ? { ...o, email: e.target.value } : o
                                        ),
                                      }))
                                    }
                                    className="w-full px-1.5 py-1 bg-transparent focus:bg-emerald-50 outline-hidden"
                                    placeholder="opsional"
                                  />
                                </td>
                                <td className="border-b border-slate-200 text-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDraft(prev => ({
                                        ...prev,
                                        officers: prev.officers.filter((_, i) => i !== idx),
                                      }))
                                    }
                                    className="p-1 text-slate-400 hover:text-rose-600"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: DAFTAR WARGA & BULAN IURAN */}
              {reviewTab === 'warga_iuran' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-600">
                      Edit sel tabel seperti Excel. Klik bulan (J–D) untuk menandai lunas.
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft(prev => ({
                          ...prev,
                          members: [
                            ...prev.members,
                            {
                              name: '',
                              block: `Unit ${prev.members.length + 1}`,
                              phone: '',
                              residentType: 'Tetap',
                              paidMonthsCount: 0,
                              paidMonths: [],
                              priorArrears: 0,
                            },
                          ],
                        }))
                      }
                      className="px-2.5 py-1 bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Tambah Warga</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-slate-300 rounded-xl max-h-[300px]">
                    <table className="w-full border-collapse text-[11px] min-w-[720px]">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-100 text-slate-700 font-extrabold">
                          <th className="border-b border-r border-slate-300 px-2 py-1.5 w-8 text-center">
                            #
                          </th>
                          <th className="border-b border-r border-slate-300 px-2 py-1.5 text-left">
                            Nama Warga / KK
                          </th>
                          <th className="border-b border-r border-slate-300 px-2 py-1.5 text-left w-28">
                            Blok / No
                          </th>
                          <th className="border-b border-r border-slate-300 px-2 py-1.5 text-left w-28">
                            No HP
                          </th>
                          <th className="border-b border-r border-slate-300 px-2 py-1.5 text-left w-20">
                            Hunian
                          </th>
                          <th className="border-b border-r border-slate-300 px-2 py-1.5 text-left">
                            Bulan Lunas ({draft.profile.year})
                          </th>
                          <th className="border-b border-r border-slate-300 px-2 py-1.5 text-right w-24">
                            Tunggakan Rp
                          </th>
                          <th className="border-b border-slate-300 px-1.5 py-1.5 w-8" />
                        </tr>
                      </thead>
                      <tbody>
                        {draft.members.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="p-4 text-center text-slate-400">
                              Belum ada data warga. Klik &ldquo;Tambah Warga&rdquo;.
                            </td>
                          </tr>
                        ) : (
                          draft.members.map((m, idx) => {
                            const paidSet = new Set(
                              m.paidMonths && m.paidMonths.length > 0
                                ? m.paidMonths
                                : Array.from({ length: m.paidMonthsCount || 0 }, (_, i) => i + 1)
                            );
                            return (
                              <tr key={idx} className="odd:bg-white even:bg-slate-50/50">
                                <td className="border-b border-r border-slate-200 px-2 py-1 text-center font-mono text-slate-400">
                                  {idx + 1}
                                </td>
                                <td className="border-b border-r border-slate-200 p-0.5">
                                  <input
                                    type="text"
                                    value={m.name}
                                    onChange={e =>
                                      setDraft(prev => ({
                                        ...prev,
                                        members: prev.members.map((row, i) =>
                                          i === idx ? { ...row, name: e.target.value } : row
                                        ),
                                      }))
                                    }
                                    className="w-full px-1.5 py-1 bg-transparent focus:bg-emerald-50 outline-hidden font-semibold"
                                    placeholder="Nama warga"
                                  />
                                </td>
                                <td className="border-b border-r border-slate-200 p-0.5">
                                  <input
                                    type="text"
                                    value={m.block}
                                    onChange={e =>
                                      setDraft(prev => ({
                                        ...prev,
                                        members: prev.members.map((row, i) =>
                                          i === idx ? { ...row, block: e.target.value } : row
                                        ),
                                      }))
                                    }
                                    className="w-full px-1.5 py-1 bg-transparent focus:bg-emerald-50 outline-hidden"
                                  />
                                </td>
                                <td className="border-b border-r border-slate-200 p-0.5">
                                  <input
                                    type="text"
                                    value={m.phone}
                                    onChange={e =>
                                      setDraft(prev => ({
                                        ...prev,
                                        members: prev.members.map((row, i) =>
                                          i === idx ? { ...row, phone: e.target.value } : row
                                        ),
                                      }))
                                    }
                                    className="w-full px-1.5 py-1 bg-transparent focus:bg-emerald-50 outline-hidden font-mono"
                                  />
                                </td>
                                <td className="border-b border-r border-slate-200 p-0.5">
                                  <select
                                    value={m.residentType}
                                    onChange={e =>
                                      setDraft(prev => ({
                                        ...prev,
                                        members: prev.members.map((row, i) =>
                                          i === idx
                                            ? {
                                                ...row,
                                                residentType: e.target.value as 'Tetap' | 'Kontrak',
                                              }
                                            : row
                                        ),
                                      }))
                                    }
                                    className="w-full px-1 py-1 bg-transparent outline-hidden"
                                  >
                                    <option value="Tetap">Tetap</option>
                                    <option value="Kontrak">Kontrak</option>
                                  </select>
                                </td>
                                <td className="border-b border-r border-slate-200 px-1.5 py-1">
                                  <div className="flex items-center gap-0.5 flex-wrap">
                                    {MONTHS_12.map((mo, moIdx) => {
                                      const monthNum = moIdx + 1;
                                      const active = paidSet.has(monthNum);
                                      return (
                                        <button
                                          key={mo.key}
                                          type="button"
                                          onClick={() => toggleMemberMonth(idx, monthNum)}
                                          title={`${mo.full} (${active ? 'Lunas' : 'Belum'})`}
                                          className={`w-5 h-5 rounded text-[9px] font-extrabold transition ${
                                            active
                                              ? 'bg-emerald-700 text-white'
                                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                          }`}
                                        >
                                          {mo.short.slice(0, 1)}
                                        </button>
                                      );
                                    })}
                                    <span className="ml-1 font-mono text-[10px] font-bold text-emerald-700">
                                      {paidSet.size}/12
                                    </span>
                                  </div>
                                </td>
                                <td className="border-b border-r border-slate-200 p-0.5">
                                  <input
                                    type="number"
                                    value={m.priorArrears || 0}
                                    onChange={e =>
                                      setDraft(prev => ({
                                        ...prev,
                                        members: prev.members.map((row, i) =>
                                          i === idx
                                            ? {
                                                ...row,
                                                priorArrears: Math.max(
                                                  0,
                                                  parseInt(e.target.value, 10) || 0
                                                ),
                                              }
                                            : row
                                        ),
                                      }))
                                    }
                                    className="w-full px-1.5 py-1 bg-transparent text-right font-mono outline-hidden"
                                  />
                                </td>
                                <td className="border-b border-slate-200 text-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDraft(prev => ({
                                        ...prev,
                                        members: prev.members.filter((_, i) => i !== idx),
                                      }))
                                    }
                                    className="p-1 text-slate-400 hover:text-rose-600"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: PEMASUKAN & PENGELUARAN KAS */}
              {reviewTab === 'kas_transaksi' && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px]">
                    <div className="flex flex-wrap items-center gap-3 font-mono">
                      <span>
                        Masuk:{' '}
                        <strong className="text-emerald-700">
                          +Rp {kasTotals.masuk.toLocaleString('id-ID')}
                        </strong>
                      </span>
                      <span>
                        Keluar:{' '}
                        <strong className="text-rose-700">
                          -Rp {kasTotals.keluar.toLocaleString('id-ID')}
                        </strong>
                      </span>
                      <span>
                        Saldo Akhir:{' '}
                        <strong className="text-slate-900">
                          Rp {kasTotals.saldo.toLocaleString('id-ID')}
                        </strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft(prev => ({
                          ...prev,
                          transactions: [
                            ...prev.transactions,
                            {
                              date: new Date().toLocaleDateString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              }),
                              type: 'masuk',
                              category: 'Iuran Warga',
                              title: '',
                              amount: 0,
                              recordedBy: 'Smart Import',
                            },
                          ],
                        }))
                      }
                      className="px-2.5 py-1 bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Tambah Transaksi</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-slate-300 rounded-xl max-h-[300px]">
                    <table className="w-full border-collapse text-[11px] min-w-[660px]">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-100 text-slate-700 font-extrabold">
                          <th className="border-b border-r border-slate-300 px-2 py-1.5 w-8 text-center">
                            #
                          </th>
                          <th className="border-b border-r border-slate-300 px-2 py-1.5 text-left w-24">
                            Tanggal
                          </th>
                          <th className="border-b border-r border-slate-300 px-2 py-1.5 text-left w-24">
                            Arus
                          </th>
                          <th className="border-b border-r border-slate-300 px-2 py-1.5 text-left w-36">
                            Kategori
                          </th>
                          <th className="border-b border-r border-slate-300 px-2 py-1.5 text-left">
                            Keterangan / Uraian
                          </th>
                          <th className="border-b border-r border-slate-300 px-2 py-1.5 text-right w-28">
                            Nominal (Rp)
                          </th>
                          <th className="border-b border-slate-300 px-1.5 py-1.5 w-8" />
                        </tr>
                      </thead>
                      <tbody>
                        {draft.transactions.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-4 text-center text-slate-400">
                              Belum ada transaksi kas terdeteksi. Klik &ldquo;Tambah Transaksi&rdquo; jika perlu.
                            </td>
                          </tr>
                        ) : (
                          draft.transactions.map((tx, idx) => (
                            <tr key={idx} className="odd:bg-white even:bg-slate-50/50">
                              <td className="border-b border-r border-slate-200 px-2 py-1 text-center font-mono text-slate-400">
                                {idx + 1}
                              </td>
                              <td className="border-b border-r border-slate-200 p-0.5">
                                <input
                                  type="text"
                                  value={tx.date}
                                  onChange={e =>
                                    setDraft(prev => ({
                                      ...prev,
                                      transactions: prev.transactions.map((r, i) =>
                                        i === idx ? { ...r, date: e.target.value } : r
                                      ),
                                    }))
                                  }
                                  className="w-full px-1.5 py-1 bg-transparent outline-hidden"
                                />
                              </td>
                              <td className="border-b border-r border-slate-200 p-0.5">
                                <select
                                  value={tx.type}
                                  onChange={e =>
                                    setDraft(prev => ({
                                      ...prev,
                                      transactions: prev.transactions.map((r, i) =>
                                        i === idx
                                          ? { ...r, type: e.target.value as 'masuk' | 'keluar' }
                                          : r
                                      ),
                                    }))
                                  }
                                  className={`w-full px-1 py-1 bg-transparent font-extrabold outline-hidden ${
                                    tx.type === 'masuk' ? 'text-emerald-700' : 'text-rose-700'
                                  }`}
                                >
                                  <option value="masuk">Masuk (+)</option>
                                  <option value="keluar">Keluar (-)</option>
                                </select>
                              </td>
                              <td className="border-b border-r border-slate-200 p-0.5">
                                <select
                                  value={tx.category}
                                  onChange={e =>
                                    setDraft(prev => ({
                                      ...prev,
                                      transactions: prev.transactions.map((r, i) =>
                                        i === idx
                                          ? { ...r, category: e.target.value as KasCategory }
                                          : r
                                      ),
                                    }))
                                  }
                                  className="w-full px-1 py-1 bg-transparent outline-hidden"
                                >
                                  {KAS_CATEGORIES.map(c => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="border-b border-r border-slate-200 p-0.5">
                                <input
                                  type="text"
                                  value={tx.title}
                                  onChange={e =>
                                    setDraft(prev => ({
                                      ...prev,
                                      transactions: prev.transactions.map((r, i) =>
                                        i === idx ? { ...r, title: e.target.value } : r
                                      ),
                                    }))
                                  }
                                  className="w-full px-1.5 py-1 bg-transparent focus:bg-emerald-50 outline-hidden font-semibold"
                                  placeholder="Uraian kas"
                                />
                              </td>
                              <td className="border-b border-r border-slate-200 p-0.5">
                                <input
                                  type="number"
                                  value={tx.amount}
                                  onChange={e =>
                                    setDraft(prev => ({
                                      ...prev,
                                      transactions: prev.transactions.map((r, i) =>
                                        i === idx
                                          ? {
                                              ...r,
                                              amount: Math.max(
                                                0,
                                                parseInt(e.target.value, 10) || 0
                                              ),
                                            }
                                          : r
                                      ),
                                    }))
                                  }
                                  className="w-full px-1.5 py-1 bg-transparent text-right font-mono font-bold outline-hidden"
                                />
                              </td>
                              <td className="border-b border-slate-200 text-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDraft(prev => ({
                                      ...prev,
                                      transactions: prev.transactions.filter((_, i) => i !== idx),
                                    }))
                                  }
                                  className="p-1 text-slate-400 hover:text-rose-600"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Creator / Pioneer Identity + Target Mode */}
              <div className="border border-emerald-200 bg-emerald-50/50 rounded-xl p-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold text-emerald-950 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Peran Anda Saat Membuat ({brandPreview} · {draft.profile.orgName || 'Komunitas'})</span>
                  </span>
                  {targetMode !== 'create_new' && (
                    <select
                      value={applyMode}
                      onChange={e =>
                        setApplyMode(
                          e.target.value as 'create_new' | 'merge_active' | 'replace_active'
                        )
                      }
                      className="h-7 border border-emerald-300 bg-white rounded-lg px-2 text-[10px] font-bold text-emerald-900"
                    >
                      <option value="create_new">Buat Komunitas Baru</option>
                      <option value="merge_active">Gabung ke Komunitas Aktif</option>
                      <option value="replace_active">Timpa Data Komunitas Aktif</option>
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreatorKind('warga_perintis')}
                    className={`p-2 rounded-lg border text-left transition ${
                      creatorKind === 'warga_perintis'
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    <div className="text-[11px] font-extrabold">
                      Warga Perintis (Siapa Saja Boleh Buat)
                    </div>
                    <div
                      className={`text-[10px] ${
                        creatorKind === 'warga_perintis' ? 'text-emerald-100' : 'text-slate-500'
                      }`}
                    >
                      Pengurus terdaftar tinggal scan barcode &amp; klaim akunnya
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatorKind('pengurus')}
                    className={`p-2 rounded-lg border text-left transition ${
                      creatorKind === 'pengurus'
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    <div className="text-[11px] font-extrabold">Saya Pengurus / Ketua</div>
                    <div
                      className={`text-[10px] ${
                        creatorKind === 'pengurus' ? 'text-emerald-100' : 'text-slate-500'
                      }`}
                    >
                      Langsung aktifkan Mode Pengurus pada akun saya
                    </div>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={creatorName}
                    onChange={e => setCreatorName(e.target.value)}
                    placeholder="Nama Anda *"
                    className="h-8 border border-slate-300 bg-white rounded-lg px-2.5 text-xs"
                  />
                  <input
                    type="text"
                    value={creatorBlock}
                    onChange={e => setCreatorBlock(e.target.value)}
                    placeholder="Blok / No Rumah"
                    className="h-8 border border-slate-300 bg-white rounded-lg px-2.5 text-xs"
                  />
                  <input
                    type="text"
                    value={creatorPhone}
                    onChange={e => setCreatorPhone(e.target.value)}
                    placeholder="No HP / WA"
                    className="h-8 border border-slate-300 bg-white rounded-lg px-2.5 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="min-h-[44px] px-4 border border-slate-300 text-slate-700 rounded-xl font-bold"
                >
                  Kembali
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveAndGenerateAll()}
                  className="flex-1 min-h-[44px] px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-extrabold flex items-center justify-center gap-2 shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan &amp; Generate Semua Menu + Barcode QR</span>
                </button>
              </div>
            </div>
          )}

          {/* ==================== STEP 3: SUCCESS + QR BARCODE INVITE ==================== */}
          {step === 'done' && generatedCommunity && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
                <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-xs">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                  <span>
                    {generatedCommunity.profile.orgName} Berhasil Digenerate Otomatis!
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="bg-white rounded-xl border border-emerald-200 p-2">
                    <div className="text-base font-extrabold text-emerald-700 font-mono">
                      {generatedCommunity.members.length}
                    </div>
                    <div className="text-[10px] text-slate-600 font-semibold">Warga &amp; Iuran</div>
                  </div>
                  <div className="bg-white rounded-xl border border-emerald-200 p-2">
                    <div className="text-base font-extrabold text-emerald-700 font-mono">
                      {generatedCommunity.transactions.length}
                    </div>
                    <div className="text-[10px] text-slate-600 font-semibold">Mutasi Kas</div>
                  </div>
                  <div className="bg-white rounded-xl border border-emerald-200 p-2">
                    <div className="text-base font-extrabold text-emerald-700 font-mono">
                      {RtSiagaStorage.getOfficers(generatedCommunity).length}
                    </div>
                    <div className="text-[10px] text-slate-600 font-semibold">Pengurus Siap Klaim</div>
                  </div>
                </div>
              </div>

              <RtInviteQrBlock
                orgName={generatedCommunity.profile.orgName}
                brandTitle={brandPreview}
                memberCount={generatedCommunity.members.length}
                officerCount={RtSiagaStorage.getOfficers(generatedCommunity).length}
                inviteUrl={generatedInviteUrl}
                compactToken={generatedCompactToken}
                inviterName={creatorName || generatedCommunity.profile.creatorName || 'Perintis'}
                showNotification={showNotification}
              />

              <button
                type="button"
                onClick={() => {
                  onCompleted(generatedCommunity, creatorKind === 'pengurus');
                  onClose();
                }}
                className="w-full min-h-[44px] bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-extrabold"
              >
                Buka Menu {generatedCommunity.profile.orgName} Sekarang
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

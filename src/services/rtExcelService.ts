import * as XLSX from 'xlsx';
import {
  HistoricalArchiveYear,
  KasCategory,
  KasTransaction,
  MONTHS_12,
  OrgType,
  PaguyubanProfile,
  WargaMember,
} from './rtSiagaStorage';

export interface SmartImportedWargaRow {
  name: string;
  block: string;
  phone: string;
  residentType: 'Tetap' | 'Kontrak';
  paidMonthsCount: number;
  paidMonths?: number[];
  priorArrears: number;
  priorArrearsNote?: string;
}

export interface SmartImportedOfficerRow {
  name: string;
  role: string;
  division: string;
  phone: string;
  email: string;
}

export interface SmartImportedKasRow {
  date: string;
  type: 'masuk' | 'keluar';
  category: KasCategory;
  title: string;
  amount: number;
  recordedBy: string;
}

export interface SmartImportedArchiveRow {
  year: number;
  totalIncome: number;
  totalExpense: number;
  endingBalance: number;
  note: string;
}

export interface SmartCommunityImportDraft {
  profile: {
    orgType: OrgType;
    customBrandName?: string;
    orgName: string;
    areaName: string;
    monthlyDuesAmount: number;
    year: number;
    openingBalance: number;
    openingBalanceNote: string;
  };
  officers: SmartImportedOfficerRow[];
  members: SmartImportedWargaRow[];
  transactions: SmartImportedKasRow[];
  archives: SmartImportedArchiveRow[];
  summaryNotes?: string;
}

export interface SmartExcelPreview {
  fileName: string;
  sheetNames: string[];
  detectedMembers: SmartImportedWargaRow[];
  detectedOfficers: SmartImportedOfficerRow[];
  detectedTransactions: SmartImportedKasRow[];
  detectedOpeningBalance: number;
  detectedOpeningNote: string;
  detectedOrgName?: string;
  detectedOrgType?: OrgType;
  detectedAreaName?: string;
  detectedMonthlyDues?: number;
  detectedYear?: number;
  detectedArchives: SmartImportedArchiveRow[];
  ignoredHistoricalRowsCount: number;
}

function parseNumber(val: unknown): number {
  if (typeof val === 'number' && Number.isFinite(val)) return Math.round(val);
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^0-9-]/g, '');
    const parsed = parseInt(cleaned, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeHeader(h: unknown): string {
  return String(h || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function findColumnIndex(headers: string[], keywords: string[]): number {
  return headers.findIndex(h => keywords.some(k => h.includes(k)));
}

function mapKasCategory(rawCategory: string, rawTitle: string, type: 'masuk' | 'keluar'): KasCategory {
  const txt = `${rawCategory} ${rawTitle}`.toLowerCase();
  if (txt.includes('keamanan') || txt.includes('satpam') || txt.includes('sekuriti') || txt.includes('ronda')) {
    return type === 'keluar' ? 'Gaji Keamanan' : 'Iuran Warga';
  }
  if (txt.includes('sampah') || txt.includes('kebersihan') || txt.includes('petugas')) {
    return 'Petugas Sampah';
  }
  if (txt.includes('listrik') || txt.includes('pos') || txt.includes('pln') || txt.includes('air') || txt.includes('pam')) {
    return 'Listrik & Pos Ronda';
  }
  if (txt.includes('perbaikan') || txt.includes('lampu') || txt.includes('jalan') || txt.includes('renovasi') || txt.includes('fasilitas') || txt.includes('servis')) {
    return 'Perbaikan Fasilitas';
  }
  if (txt.includes('iuran') || txt.includes('bulanan') || txt.includes('warga')) {
    return 'Iuran Warga';
  }
  return type === 'masuk' ? 'Donasi / Kas' : 'Perbaikan Fasilitas';
}

const MONTH_ALIASES: Array<{ monthNum: number; tokens: string[] }> = [
  { monthNum: 1, tokens: ['jan', 'januari', 'bln 1', 'bulan 1'] },
  { monthNum: 2, tokens: ['feb', 'peb', 'februari', 'bln 2', 'bulan 2'] },
  { monthNum: 3, tokens: ['mar', 'maret', 'bln 3', 'bulan 3'] },
  { monthNum: 4, tokens: ['apr', 'april', 'bln 4', 'bulan 4'] },
  { monthNum: 5, tokens: ['mei', 'may', 'bln 5', 'bulan 5'] },
  { monthNum: 6, tokens: ['jun', 'juni', 'bln 6', 'bulan 6'] },
  { monthNum: 7, tokens: ['jul', 'juli', 'bln 7', 'bulan 7'] },
  { monthNum: 8, tokens: ['agu', 'agt', 'agustus', 'aug', 'bln 8', 'bulan 8'] },
  { monthNum: 9, tokens: ['sep', 'sept', 'september', 'bln 9', 'bulan 9'] },
  { monthNum: 10, tokens: ['okt', 'oct', 'oktober', 'bln 10', 'bulan 10'] },
  { monthNum: 11, tokens: ['nov', 'november', 'bln 11', 'bulan 11'] },
  { monthNum: 12, tokens: ['des', 'dec', 'desember', 'bln 12', 'bulan 12'] },
];

function isCellPaidTruthy(val: unknown): boolean {
  if (typeof val === 'number') return val > 0;
  const s = String(val || '').trim().toLowerCase();
  if (!s || s === '-' || s === '0' || s === 'belum' || s === 'x' || s === 'tidak') return false;
  if (
    s.includes('lunas') ||
    s.includes('v') ||
    s.includes('✓') ||
    s.includes('✔') ||
    s.includes('ok') ||
    s.includes('ya') ||
    s.includes('bayar') ||
    s.includes('sudah')
  ) {
    return true;
  }
  const num = parseNumber(s);
  return num >= 1000;
}

export const RtExcelService = {
  downloadTemplateExcel(profile: PaguyubanProfile) {
    const wb = XLSX.utils.book_new();

    const wargaRows = [
      [
        'Nama Warga',
        'Blok / No Rumah',
        'No HP / WA',
        'Status Tinggal',
        'Bulan Lunas 2026 (0-12)',
        'Tunggakan Lalu (Rp)',
        'Catatan',
      ],
      ['Bpk. Wahyu Hidayat', 'Blok D No. 02', '0812-7700-1122', 'Tetap', 10, 0, 'Lunas s/d Okt 2026'],
      ['Ibu Siti Aminah', 'Blok D No. 05', '0813-4455-8899', 'Kontrak', 8, 50000, 'Sisa 1 bln thn 2025'],
    ];
    const wsWarga = XLSX.utils.aoa_to_sheet(wargaRows);
    XLSX.utils.book_append_sheet(wb, wsWarga, 'Daftar_Warga');

    const saldoRows = [
      ['Keterangan', 'Nominal (Rp)', 'Tanggal Cut-Off'],
      [`Saldo Akhir Pindahan ke ${profile.year}`, 12420000, `01 Jan ${profile.year}`],
    ];
    const wsSaldo = XLSX.utils.aoa_to_sheet(saldoRows);
    XLSX.utils.book_append_sheet(wb, wsSaldo, 'Saldo_Awal_2026');

    const arsipRows = [
      ['Tahun', 'Total Pemasukan (Rp)', 'Total Pengeluaran (Rp)', 'Saldo Akhir (Rp)', 'Catatan'],
      [2023, 21500000, 18200000, 6500000, 'Rekap tutup buku 2023'],
      [2024, 24800000, 18450000, 9650000, 'Rekap tutup buku 2024'],
      [2025, 26400000, 23630000, 12420000, 'Saldo akhir dipindahkan ke 2026'],
    ];
    const wsArsip = XLSX.utils.aoa_to_sheet(arsipRows);
    XLSX.utils.book_append_sheet(wb, wsArsip, 'Arsip_Tahunan');

    const safeOrg = profile.orgName.replace(/[^A-Za-z0-9]+/g, '_');
    XLSX.writeFile(wb, `Template_RTQu_${safeOrg}_${profile.year}.xlsx`);
  },

  exportRtQuExcel(
    profile: PaguyubanProfile,
    members: WargaMember[],
    transactions: KasTransaction[],
    archives: HistoricalArchiveYear[]
  ) {
    const wb = XLSX.utils.book_new();

    const totalMasuk = transactions
      .filter(t => t.type === 'masuk')
      .reduce((s, t) => s + t.amount, 0);
    const totalKeluar = transactions
      .filter(t => t.type === 'keluar')
      .reduce((s, t) => s + t.amount, 0);
    const saldo = totalMasuk - totalKeluar;

    const kasHeaderRows: Array<Array<string | number>> = [
      [`LAPORAN TRANSPARANSI KAS ${profile.orgName.toUpperCase()} (${profile.year})`],
      ['Wilayah', profile.areaName],
      ['Saldo Kas Aktif', saldo],
      ['Total Pemasukan', totalMasuk],
      ['Total Pengeluaran', totalKeluar],
      [],
      ['Tanggal', 'Tipe', 'Kategori', 'Keterangan', 'Nominal (Rp)', 'Dicatat Oleh'],
      ...transactions.map(tx => [
        tx.date,
        tx.type === 'masuk' ? 'Pemasukan' : 'Pengeluaran',
        tx.category,
        tx.title,
        tx.amount,
        tx.recordedBy,
      ]),
    ];
    const wsKas = XLSX.utils.aoa_to_sheet(kasHeaderRows);
    XLSX.utils.book_append_sheet(wb, wsKas, `Kas_${profile.year}`);

    const kartuHeader = [
      'ID Warga',
      'Nama Warga',
      'Blok / Rumah',
      'Status Akun',
      'Kode Klaim',
      ...MONTHS_12.map(m => m.short),
      'Total Bulan Lunas',
      'Tunggakan Lalu (Rp)',
    ];
    const kartuRows = members.map(m => {
      const monthCells = MONTHS_12.map(mo => (m.monthlyPayments[mo.key]?.paid ? 'LUNAS' : '-'));
      const paidCount = monthCells.filter(c => c === 'LUNAS').length;
      const claimLabel =
        m.claimStatus === 'claimed'
          ? 'Aktif / Terklaim'
          : m.claimStatus === 'invited'
          ? 'Sudah Diundang'
          : 'Belum Klaim';
      return [
        m.wargaId,
        m.name,
        m.block,
        claimLabel,
        m.claimCode || '-',
        ...monthCells,
        paidCount,
        m.priorArrears || 0,
      ];
    });
    const wsKartu = XLSX.utils.aoa_to_sheet([kartuHeader, ...kartuRows]);
    XLSX.utils.book_append_sheet(wb, wsKartu, `Kartu_Iuran_${profile.year}`);

    const wargaRows = [
      ['ID Warga', 'Nama', 'Blok', 'No HP', 'Tinggal', 'Status Akun', 'Kode Klaim', 'Status SiagaQu'],
      ...members.map(m => [
        m.wargaId,
        m.name,
        m.block,
        m.phone,
        m.residentType,
        m.claimStatus || 'claimed',
        m.claimCode || '-',
        m.siagaStatus,
      ]),
    ];
    const wsWarga = XLSX.utils.aoa_to_sheet(wargaRows);
    XLSX.utils.book_append_sheet(wb, wsWarga, 'Daftar_Warga');

    if (archives.length > 0) {
      const archiveRows = [
        ['Tahun', 'Total Pemasukan (Rp)', 'Total Pengeluaran (Rp)', 'Saldo Akhir (Rp)', 'Catatan'],
        ...archives.map(a => [a.year, a.totalIncome, a.totalExpense, a.endingBalance, a.note]),
      ];
      const wsArsip = XLSX.utils.aoa_to_sheet(archiveRows);
      XLSX.utils.book_append_sheet(wb, wsArsip, 'Arsip_Tahunan');
    }

    const safeOrg = profile.orgName.replace(/[^A-Za-z0-9]+/g, '_');
    const dateStamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Laporan_${safeOrg}_${profile.year}_${dateStamp}.xlsx`);
  },

  async extractExcelSheetTables(
    file: File
  ): Promise<Array<{ fileName: string; sheetName: string; csvText: string }>> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    return workbook.SheetNames.slice(0, 6).map(sheetName => ({
      fileName: file.name,
      sheetName,
      csvText: XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName], { blankrows: false }).slice(0, 28000),
    }));
  },

  async parseSmartExcelFile(file: File): Promise<SmartExcelPreview> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    const detectedMembers: SmartImportedWargaRow[] = [];
    const detectedOfficers: SmartImportedOfficerRow[] = [];
    const detectedTransactions: SmartImportedKasRow[] = [];
    const detectedArchives: SmartImportedArchiveRow[] = [];
    let detectedOpeningBalance = 0;
    let detectedOpeningNote = '';
    let detectedOrgName: string | undefined;
    let detectedOrgType: OrgType | undefined;
    let detectedAreaName: string | undefined;
    let detectedMonthlyDues: number | undefined;
    let detectedYear: number | undefined;
    let ignoredHistoricalRowsCount = 0;

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const matrix = XLSX.utils.sheet_to_json<Array<string | number>>(sheet, {
        header: 1,
        defval: '',
      });
      if (matrix.length === 0) continue;

      // Scan top lines for RT / Paguyuban metadata, dues amount & summary balance
      for (let r = 0; r < Math.min(10, matrix.length); r++) {
        const row = matrix[r];
        const joinedRaw = row.map(c => String(c || '')).join(' ').trim();
        const joined = joinedRaw.toLowerCase();

        if (!detectedOrgName) {
          const rtMatch = joinedRaw.match(/\b(RT\.?\s*\d{1,3}(?:\s*[/\-]\s*RW\.?\s*\d{1,3})?)/i);
          const paguyubanMatch = joinedRaw.match(/(Paguyuban\s+[A-Za-z0-9\s\-]{2,35})/i);
          const dkmMatch = joinedRaw.match(/(DKM\s+[A-Za-z0-9\s\-]{2,35}|Yayasan\s+[A-Za-z0-9\s\-]{2,35})/i);
          if (paguyubanMatch) {
            detectedOrgName = paguyubanMatch[1].trim();
            detectedOrgType = 'Paguyuban';
          } else if (rtMatch) {
            detectedOrgName = rtMatch[1].replace(/\s+/g, ' ').trim();
            detectedOrgType = 'RT';
          } else if (dkmMatch) {
            detectedOrgName = dkmMatch[1].trim();
            detectedOrgType = 'Sosial';
          }
        }

        if (!detectedAreaName && (joined.includes('wilayah') || joined.includes('kelurahan') || joined.includes('perumahan') || joined.includes('cluster'))) {
          const val = String(row[1] || row[2] || '').trim();
          if (val && val.length >= 3 && val.length <= 60) detectedAreaName = val;
        }

        if (!detectedMonthlyDues && (joined.includes('iuran/bln') || joined.includes('iuran bulanan') || joined.includes('nominal iuran'))) {
          const nums = row.map(parseNumber).filter(n => n >= 5000 && n <= 2000000);
          if (nums.length > 0) detectedMonthlyDues = nums[0];
        }

        if (!detectedYear) {
          const yrMatch = joinedRaw.match(/\b(202[4-9])\b/);
          if (yrMatch) detectedYear = parseInt(yrMatch[1], 10);
        }
      }

      for (const row of matrix) {
        const joined = row.map(c => String(c || '')).join(' ').toLowerCase();
        if (
          joined.includes('saldo akhir') ||
          joined.includes('saldo awal') ||
          joined.includes('saldo pindahan') ||
          joined.includes('sisa kas')
        ) {
          const numericCells = row.map(parseNumber).filter(n => n > 0);
          if (numericCells.length > 0) {
            const candidate = numericCells[numericCells.length - 1];
            if (candidate > detectedOpeningBalance) {
              detectedOpeningBalance = candidate;
              detectedOpeningNote = String(row[0] || 'Saldo Awal Pindahan (Excel)').trim();
            }
          }
        }
      }

      // Detect header row (first row within top 10 rows that matches known columns)
      let headerRowIdx = -1;
      let headers: string[] = [];
      for (let i = 0; i < Math.min(10, matrix.length); i++) {
        const candidateHeaders = matrix[i].map(normalizeHeader);
        const hasName = findColumnIndex(candidateHeaders, ['nama', 'warga', 'kk', 'kepala keluarga']) >= 0;
        const hasRole = findColumnIndex(candidateHeaders, ['jabatan', 'pengurus', 'divisi', 'posisi']) >= 0;
        const hasKasDesc =
          findColumnIndex(candidateHeaders, ['keterangan', 'uraian', 'transaksi', 'keperluan']) >= 0 &&
          findColumnIndex(candidateHeaders, ['nominal', 'jumlah', 'pemasukan', 'pengeluaran', 'masuk', 'keluar', 'kredit', 'debit']) >= 0;
        const hasYear = findColumnIndex(candidateHeaders, ['tahun']) >= 0;
        const hasSaldo = findColumnIndex(candidateHeaders, ['saldo', 'pemasukan', 'pengeluaran']) >= 0;
        if (hasName || hasRole || hasKasDesc || (hasYear && hasSaldo)) {
          headerRowIdx = i;
          headers = candidateHeaders;
          break;
        }
      }

      if (headerRowIdx < 0) continue;

      const idxTahun = findColumnIndex(headers, ['tahun']);
      const idxMasuk = findColumnIndex(headers, ['pemasukan', 'masuk', 'pendapatan', 'kredit']);
      const idxKeluar = findColumnIndex(headers, ['pengeluaran', 'keluar', 'biaya', 'debit']);
      const idxSaldo = findColumnIndex(headers, ['saldo akhir', 'saldo']);
      const idxNama = findColumnIndex(headers, ['nama', 'warga', 'kepala keluarga', 'kk']);
      const idxJabatan = findColumnIndex(headers, ['jabatan', 'role', 'posisi', 'tugas']);
      const idxDivisi = findColumnIndex(headers, ['divisi', 'bidang', 'seksi']);
      const idxEmail = findColumnIndex(headers, ['email', 'mail', 'gmail']);
      const idxBlok = findColumnIndex(headers, ['blok', 'rumah', 'alamat', 'unit', 'no rumah']);
      const idxHp = findColumnIndex(headers, ['hp', 'wa', 'telepon', 'telp', 'kontak']);
      const idxStatus = findColumnIndex(headers, ['tinggal', 'status tinggal', 'hunian']);
      const idxPaidMonths = findColumnIndex(headers, ['bulan lunas', 'total bulan', 'lunas']);
      const idxTunggakan = findColumnIndex(headers, ['tunggakan', 'sisa', 'hutang']);
      const idxNote = findColumnIndex(headers, ['catatan', 'keterangan', 'uraian', 'ket', 'transaksi']);
      const idxTgl = findColumnIndex(headers, ['tanggal', 'tgl', 'waktu', 'date']);
      const idxTipe = findColumnIndex(headers, ['tipe', 'jenis', 'arus']);
      const idxKategori = findColumnIndex(headers, ['kategori', 'pos']);
      const idxNominal = findColumnIndex(headers, ['nominal', 'jumlah', 'nilai', 'rupiah', 'rp']);
      const idxPencatat = findColumnIndex(headers, ['dicatat', 'oleh', 'petugas', 'bendahara']);

      // Detect individual month columns Jan..Des
      const monthColumns: Array<{ colIdx: number; monthNum: number }> = [];
      headers.forEach((h, colIdx) => {
        const foundMonth = MONTH_ALIASES.find(ma => ma.tokens.some(tok => h === tok || h.startsWith(`${tok} `) || h.includes(tok)));
        if (foundMonth && !monthColumns.some(mc => mc.monthNum === foundMonth.monthNum)) {
          monthColumns.push({ colIdx, monthNum: foundMonth.monthNum });
        }
      });

      // 1. Archive summary sheet detection
      if (idxTahun >= 0 && (idxSaldo >= 0 || idxMasuk >= 0) && idxNama < 0 && idxNote !== idxNama) {
        for (let r = headerRowIdx + 1; r < matrix.length; r++) {
          const row = matrix[r];
          const yearVal = parseNumber(row[idxTahun]);
          if (yearVal >= 2015 && yearVal <= 2030) {
            const totalIncome = idxMasuk >= 0 ? parseNumber(row[idxMasuk]) : 0;
            const totalExpense = idxKeluar >= 0 ? parseNumber(row[idxKeluar]) : 0;
            const endingBalance = idxSaldo >= 0 ? parseNumber(row[idxSaldo]) : totalIncome - totalExpense;
            const note = idxNote >= 0 ? String(row[idxNote] || '').trim() : '';
            detectedArchives.push({
              year: yearVal,
              totalIncome,
              totalExpense,
              endingBalance,
              note: note || `Rekap tahun ${yearVal}`,
            });
            if (endingBalance > 0 && yearVal < (detectedYear || 2026)) {
              detectedOpeningBalance = endingBalance;
              detectedOpeningNote = `Saldo akhir ${yearVal} dipindahkan`;
            }
          }
        }
        continue;
      }

      // 2. Pengurus / Struktur Organisasi sheet detection
      if (idxJabatan >= 0 && idxNama >= 0) {
        for (let r = headerRowIdx + 1; r < matrix.length; r++) {
          const row = matrix[r];
          const rawName = String(row[idxNama] || '').trim();
          const rawRole = String(row[idxJabatan] || '').trim();
          if (!rawName || !rawRole) continue;
          detectedOfficers.push({
            name: rawName,
            role: rawRole,
            division: idxDivisi >= 0 ? String(row[idxDivisi] || '').trim() || 'Pengurus Inti' : 'Pengurus Inti',
            phone: idxHp >= 0 ? String(row[idxHp] || '').trim() || '-' : '-',
            email: idxEmail >= 0 ? String(row[idxEmail] || '').trim().toLowerCase() : '',
          });
        }
        continue;
      }

      // 3. Kas Transactions sheet detection (Pemasukan & Pengeluaran)
      const looksLikeKasSheet =
        sheetName.toLowerCase().includes('kas') ||
        sheetName.toLowerCase().includes('keuangan') ||
        sheetName.toLowerCase().includes('mutasi') ||
        ((idxTgl >= 0 || idxKategori >= 0) && (idxNominal >= 0 || idxMasuk >= 0 || idxKeluar >= 0) && idxBlok < 0);

      if (looksLikeKasSheet && (idxNote >= 0 || idxNama >= 0)) {
        for (let r = headerRowIdx + 1; r < matrix.length; r++) {
          const row = matrix[r];
          const desc = String((idxNote >= 0 ? row[idxNote] : row[idxNama]) || '').trim();
          if (!desc) continue;
          const lower = desc.toLowerCase();
          if (lower.startsWith('total') || lower.startsWith('jumlah') || lower === 'saldo akhir') continue;

          const rawDate = idxTgl >= 0 ? String(row[idxTgl] || '').trim() : '';
          const rawCat = idxKategori >= 0 ? String(row[idxKategori] || '').trim() : '';
          const rawRec = idxPencatat >= 0 ? String(row[idxPencatat] || '').trim() : 'Impor Excel';

          const valMasuk = idxMasuk >= 0 ? Math.max(0, parseNumber(row[idxMasuk])) : 0;
          const valKeluar = idxKeluar >= 0 ? Math.max(0, parseNumber(row[idxKeluar])) : 0;
          const valNominal = idxNominal >= 0 ? Math.max(0, parseNumber(row[idxNominal])) : 0;

          let txType: 'masuk' | 'keluar' = 'masuk';
          let amount = valNominal;

          if (valMasuk > 0 && valKeluar === 0) {
            txType = 'masuk';
            amount = valMasuk;
          } else if (valKeluar > 0 && valMasuk === 0) {
            txType = 'keluar';
            amount = valKeluar;
          } else if (idxTipe >= 0) {
            const tipeStr = String(row[idxTipe] || '').toLowerCase();
            txType =
              tipeStr.includes('keluar') || tipeStr.includes('biaya') || tipeStr.includes('beban') || tipeStr.includes('debit')
                ? 'keluar'
                : 'masuk';
          } else if (
            lower.includes('gaji') ||
            lower.includes('bayar') ||
            lower.includes('beli') ||
            lower.includes('perbaikan') ||
            lower.includes('listrik') ||
            lower.includes('sampah')
          ) {
            txType = 'keluar';
          }

          if (amount <= 0) continue;
          detectedTransactions.push({
            date: rawDate || `2026`,
            type: txType,
            category: mapKasCategory(rawCat, desc, txType),
            title: desc,
            amount,
            recordedBy: rawRec || 'Impor Excel',
          });
        }
        continue;
      }

      // 4. Warga directory & Kartu Iuran detection
      if (idxNama >= 0) {
        for (let r = headerRowIdx + 1; r < matrix.length; r++) {
          const row = matrix[r];
          const rawName = String(row[idxNama] || '').trim();
          if (!rawName) continue;
          const lower = rawName.toLowerCase();
          if (lower.startsWith('total') || lower.startsWith('jumlah') || lower.startsWith('saldo')) {
            continue;
          }

          const hasYearTag = /\b20(1[89]|2[0-5])\b/.test(row.map(String).join(' '));
          const blockVal = idxBlok >= 0 ? String(row[idxBlok] || '').trim() : '';
          const phoneVal = idxHp >= 0 ? String(row[idxHp] || '').trim() : '';
          if (hasYearTag && !blockVal && !phoneVal) {
            ignoredHistoricalRowsCount += 1;
            continue;
          }

          const rawStatus = idxStatus >= 0 ? String(row[idxStatus] || '').toLowerCase() : '';
          const residentType: 'Tetap' | 'Kontrak' =
            rawStatus.includes('kontrak') || rawStatus.includes('sewa') ? 'Kontrak' : 'Tetap';

          const paidMonths: number[] = [];
          if (monthColumns.length > 0) {
            monthColumns.forEach(mc => {
              if (isCellPaidTruthy(row[mc.colIdx])) {
                paidMonths.push(mc.monthNum);
              }
            });
          }

          const countFromCol =
            idxPaidMonths >= 0 ? Math.min(12, Math.max(0, parseNumber(row[idxPaidMonths]))) : 0;
          const paidMonthsCount = paidMonths.length > 0 ? paidMonths.length : countFromCol;
          const resolvedPaidMonths =
            paidMonths.length > 0
              ? paidMonths
              : Array.from({ length: paidMonthsCount }, (_, i) => i + 1);

          const priorArrears = idxTunggakan >= 0 ? Math.max(0, parseNumber(row[idxTunggakan])) : 0;
          const noteVal = idxNote >= 0 ? String(row[idxNote] || '').trim() : undefined;

          detectedMembers.push({
            name: rawName,
            block: blockVal || `No. ${detectedMembers.length + 1}`,
            phone: phoneVal || '-',
            residentType,
            paidMonthsCount,
            paidMonths: resolvedPaidMonths,
            priorArrears,
            priorArrearsNote: noteVal,
          });
        }
      } else {
        ignoredHistoricalRowsCount += Math.max(0, matrix.length - 1);
      }
    }

    return {
      fileName: file.name,
      sheetNames: workbook.SheetNames,
      detectedMembers,
      detectedOfficers,
      detectedTransactions,
      detectedOpeningBalance,
      detectedOpeningNote: detectedOpeningNote || 'Saldo Awal Pindahan (Excel)',
      detectedOrgName,
      detectedOrgType,
      detectedAreaName,
      detectedMonthlyDues,
      detectedYear,
      detectedArchives,
      ignoredHistoricalRowsCount,
    };
  },

  mergeExcelPreviewsIntoDraft(
    previews: SmartExcelPreview[],
    fallbackOrgType: OrgType = 'RT'
  ): SmartCommunityImportDraft {
    const first = previews[0];
    const allMembers: SmartImportedWargaRow[] = [];
    const seenMembers = new Set<string>();
    const allOfficers: SmartImportedOfficerRow[] = [];
    const seenOfficers = new Set<string>();
    const allTransactions: SmartImportedKasRow[] = [];
    const allArchives: SmartImportedArchiveRow[] = [];

    let openingBalance = 0;
    let openingBalanceNote = '';
    let orgName = '';
    let orgType: OrgType = fallbackOrgType;
    let areaName = '';
    let monthlyDuesAmount = 50000;
    let year = new Date().getFullYear();

    for (const p of previews) {
      if (!orgName && p.detectedOrgName) orgName = p.detectedOrgName;
      if (p.detectedOrgType) orgType = p.detectedOrgType;
      if (!areaName && p.detectedAreaName) areaName = p.detectedAreaName;
      if (p.detectedMonthlyDues) monthlyDuesAmount = p.detectedMonthlyDues;
      if (p.detectedYear) year = p.detectedYear;
      if (p.detectedOpeningBalance > openingBalance) {
        openingBalance = p.detectedOpeningBalance;
        openingBalanceNote = p.detectedOpeningNote;
      }
      for (const m of p.detectedMembers) {
        const key = `${m.name.toLowerCase()}::${m.block.toLowerCase()}`;
        if (!seenMembers.has(key)) {
          seenMembers.add(key);
          allMembers.push(m);
        }
      }
      for (const o of p.detectedOfficers) {
        const key = `${o.name.toLowerCase()}::${o.role.toLowerCase()}`;
        if (!seenOfficers.has(key)) {
          seenOfficers.add(key);
          allOfficers.push(o);
        }
      }
      allTransactions.push(...p.detectedTransactions);
      allArchives.push(...p.detectedArchives);
    }

    return {
      profile: {
        orgType,
        orgName: orgName || (orgType === 'Paguyuban' ? 'Paguyuban Warga Baru' : 'RT 01 / RW 01'),
        areaName: areaName || 'Lingkungan Warga',
        monthlyDuesAmount,
        year,
        openingBalance,
        openingBalanceNote: openingBalanceNote || `Saldo Awal ${year}`,
      },
      officers: allOfficers,
      members: allMembers,
      transactions: allTransactions,
      archives: allArchives,
      summaryNotes: first
        ? `Dibaca dari ${previews.length} file Excel (${allMembers.length} warga, ${allOfficers.length} pengurus, ${allTransactions.length} mutasi kas).`
        : undefined,
    };
  },

  buildSampleSmartPreview(profile: PaguyubanProfile): SmartExcelPreview {
    return {
      fileName: `Rekap_Bendahara_2020_2025_${profile.orgName.replace(/\s+/g, '_')}.xlsx`,
      sheetNames: ['Daftar_Warga', 'Kas_2020_2025', 'Rekap_Tahunan'],
      detectedOfficers: [
        {
          name: 'Bpk. H. Suryanto',
          role: 'Ketua RT',
          division: 'Pimpinan & Pengesahan',
          phone: '0812-8800-1122',
          email: '',
        },
        {
          name: 'Ibu Ratna Dewi',
          role: 'Bendahara',
          division: 'Iuran & Transparansi Kas',
          phone: '0813-9900-3344',
          email: '',
        },
      ],
      detectedMembers: [
        {
          name: 'Bpk. Wahyu Hidayat',
          block: 'Blok D No. 02',
          phone: '0812-7700-1122',
          residentType: 'Tetap',
          paidMonthsCount: 10,
          paidMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          priorArrears: 0,
          priorArrearsNote: 'Pindah data dari Excel Bendahara',
        },
        {
          name: 'Ibu Siti Aminah',
          block: 'Blok D No. 05',
          phone: '0813-4455-8899',
          residentType: 'Kontrak',
          paidMonthsCount: 8,
          paidMonths: [1, 2, 3, 4, 5, 6, 7, 8],
          priorArrears: 50000,
          priorArrearsNote: 'Sisa iuran Des 2025',
        },
        {
          name: 'Bpk. Hendro Kusumo',
          block: 'Blok D No. 08',
          phone: '0857-6611-9900',
          residentType: 'Tetap',
          paidMonthsCount: 10,
          paidMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          priorArrears: 0,
        },
      ],
      detectedTransactions: [
        {
          date: '05 Okt 2026',
          type: 'masuk',
          category: 'Iuran Warga',
          title: 'Kolektif Iuran Warga Blok D',
          amount: 1450000,
          recordedBy: 'Bendahara',
        },
        {
          date: '10 Okt 2026',
          type: 'keluar',
          category: 'Gaji Keamanan',
          title: 'Honor Satpam Malam Bulan Oktober',
          amount: 900000,
          recordedBy: 'Bendahara',
        },
      ],
      detectedOpeningBalance: 12420000,
      detectedOpeningNote: 'Saldo akhir 31 Des 2025 (cut-off lembaran baru 2026)',
      detectedArchives: [
        {
          year: 2023,
          totalIncome: 21500000,
          totalExpense: 18200000,
          endingBalance: 6500000,
          note: 'Rekap tahunan 2023 (diambil totalnya saja)',
        },
        {
          year: 2024,
          totalIncome: 24800000,
          totalExpense: 18450000,
          endingBalance: 9650000,
          note: 'Rekap tahunan 2024 (diambil totalnya saja)',
        },
        {
          year: 2025,
          totalIncome: 26400000,
          totalExpense: 23630000,
          endingBalance: 12420000,
          note: 'Saldo akhir dipindahkan ke saldo awal 2026',
        },
      ],
      ignoredHistoricalRowsCount: 342,
    };
  },
};

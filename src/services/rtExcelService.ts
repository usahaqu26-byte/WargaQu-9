import * as XLSX from 'xlsx';
import {
  HistoricalArchiveYear,
  KasTransaction,
  MONTHS_12,
  PaguyubanProfile,
  WargaMember,
} from './rtSiagaStorage';

export interface SmartImportedWargaRow {
  name: string;
  block: string;
  phone: string;
  residentType: 'Tetap' | 'Kontrak';
  paidMonthsCount: number;
  priorArrears: number;
  priorArrearsNote?: string;
}

export interface SmartImportedArchiveRow {
  year: number;
  totalIncome: number;
  totalExpense: number;
  endingBalance: number;
  note: string;
}

export interface SmartExcelPreview {
  fileName: string;
  sheetNames: string[];
  detectedMembers: SmartImportedWargaRow[];
  detectedOpeningBalance: number;
  detectedOpeningNote: string;
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

  async parseSmartExcelFile(file: File): Promise<SmartExcelPreview> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    const detectedMembers: SmartImportedWargaRow[] = [];
    const detectedArchives: SmartImportedArchiveRow[] = [];
    let detectedOpeningBalance = 0;
    let detectedOpeningNote = '';
    let ignoredHistoricalRowsCount = 0;

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const matrix = XLSX.utils.sheet_to_json<Array<string | number>>(sheet, {
        header: 1,
        defval: '',
      });
      if (matrix.length === 0) continue;

      // Scan for summary keywords like "Saldo Akhir" or "Saldo Awal" anywhere in small tables
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

      // Detect header row (first row within top 8 rows that matches known columns)
      let headerRowIdx = -1;
      let headers: string[] = [];
      for (let i = 0; i < Math.min(8, matrix.length); i++) {
        const candidateHeaders = matrix[i].map(normalizeHeader);
        const hasName = findColumnIndex(candidateHeaders, ['nama', 'warga', 'kk', 'kepala keluarga']) >= 0;
        const hasYear = findColumnIndex(candidateHeaders, ['tahun']) >= 0;
        const hasSaldo = findColumnIndex(candidateHeaders, ['saldo', 'pemasukan', 'pengeluaran']) >= 0;
        if (hasName || (hasYear && hasSaldo)) {
          headerRowIdx = i;
          headers = candidateHeaders;
          break;
        }
      }

      if (headerRowIdx < 0) continue;

      const idxTahun = findColumnIndex(headers, ['tahun']);
      const idxMasuk = findColumnIndex(headers, ['pemasukan', 'masuk', 'pendapatan']);
      const idxKeluar = findColumnIndex(headers, ['pengeluaran', 'keluar', 'biaya']);
      const idxSaldo = findColumnIndex(headers, ['saldo akhir', 'saldo']);
      const idxNama = findColumnIndex(headers, ['nama', 'warga', 'kepala keluarga', 'kk']);
      const idxBlok = findColumnIndex(headers, ['blok', 'rumah', 'alamat', 'unit', 'no rumah']);
      const idxHp = findColumnIndex(headers, ['hp', 'wa', 'telepon', 'telp', 'kontak']);
      const idxStatus = findColumnIndex(headers, ['tinggal', 'status tinggal', 'hunian']);
      const idxPaidMonths = findColumnIndex(headers, ['bulan lunas', 'lunas', 'bulan']);
      const idxTunggakan = findColumnIndex(headers, ['tunggakan', 'sisa', 'hutang']);
      const idxNote = findColumnIndex(headers, ['catatan', 'keterangan', 'ket']);

      // Archive summary sheet detection
      if (idxTahun >= 0 && (idxSaldo >= 0 || idxMasuk >= 0)) {
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
            if (endingBalance > 0 && yearVal < 2026) {
              detectedOpeningBalance = endingBalance;
              detectedOpeningNote = `Saldo akhir ${yearVal} dipindahkan ke 2026`;
            }
          }
        }
        continue;
      }

      // Warga directory detection
      if (idxNama >= 0) {
        for (let r = headerRowIdx + 1; r < matrix.length; r++) {
          const row = matrix[r];
          const rawName = String(row[idxNama] || '').trim();
          if (!rawName) continue;
          const lower = rawName.toLowerCase();
          if (lower.startsWith('total') || lower.startsWith('jumlah') || lower.startsWith('saldo')) {
            continue;
          }

          // Skip old transaction detail rows if the sheet mixes dates from 2020-2025 without block/phone
          const hasYearTag = /\b20(1[89]|2[0-5])\b/.test(row.map(String).join(' '));
          const blockVal = idxBlok >= 0 ? String(row[idxBlok] || '').trim() : '';
          const phoneVal = idxHp >= 0 ? String(row[idxHp] || '').trim() : '';
          if (hasYearTag && !blockVal && !phoneVal) {
            ignoredHistoricalRowsCount += 1;
            continue;
          }

          const rawStatus = idxStatus >= 0 ? String(row[idxStatus] || '').toLowerCase() : '';
          const residentType: 'Tetap' | 'Kontrak' = rawStatus.includes('kontrak') || rawStatus.includes('sewa')
            ? 'Kontrak'
            : 'Tetap';

          const paidMonthsCount = idxPaidMonths >= 0 ? Math.min(12, Math.max(0, parseNumber(row[idxPaidMonths]))) : 0;
          const priorArrears = idxTunggakan >= 0 ? Math.max(0, parseNumber(row[idxTunggakan])) : 0;
          const noteVal = idxNote >= 0 ? String(row[idxNote] || '').trim() : undefined;

          detectedMembers.push({
            name: rawName,
            block: blockVal || `No. ${detectedMembers.length + 1}`,
            phone: phoneVal || '-',
            residentType,
            paidMonthsCount,
            priorArrears,
            priorArrearsNote: noteVal,
          });
        }
      } else {
        // Count non-empty rows in unrecognized historical sheets as skipped noisy rows
        ignoredHistoricalRowsCount += Math.max(0, matrix.length - 1);
      }
    }

    return {
      fileName: file.name,
      sheetNames: workbook.SheetNames,
      detectedMembers,
      detectedOpeningBalance,
      detectedOpeningNote: detectedOpeningNote || 'Saldo Awal Pindahan (Excel)',
      detectedArchives,
      ignoredHistoricalRowsCount,
    };
  },

  buildSampleSmartPreview(profile: PaguyubanProfile): SmartExcelPreview {
    return {
      fileName: `Rekap_Bendahara_2020_2025_${profile.orgName.replace(/\s+/g, '_')}.xlsx`,
      sheetNames: ['Daftar_Warga', 'Kas_2020_2025', 'Rekap_Tahunan'],
      detectedMembers: [
        {
          name: 'Bpk. Wahyu Hidayat',
          block: 'Blok D No. 02',
          phone: '0812-7700-1122',
          residentType: 'Tetap',
          paidMonthsCount: 10,
          priorArrears: 0,
          priorArrearsNote: 'Pindah data dari Excel Bendahara',
        },
        {
          name: 'Ibu Siti Aminah',
          block: 'Blok D No. 05',
          phone: '0813-4455-8899',
          residentType: 'Kontrak',
          paidMonthsCount: 8,
          priorArrears: 50000,
          priorArrearsNote: 'Sisa iuran Des 2025',
        },
        {
          name: 'Bpk. Hendro Kusumo',
          block: 'Blok D No. 08',
          phone: '0857-6611-9900',
          residentType: 'Tetap',
          paidMonthsCount: 10,
          priorArrears: 0,
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

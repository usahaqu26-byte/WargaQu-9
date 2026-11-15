import React, { useRef, useState } from 'react';
import { Lock, Download, Upload, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { BackupScope, EncryptedBackupService } from '../../services/encryptedBackupService';

interface EncryptedBackupPanelProps {
  scope: BackupScope;
  title?: string;
  description?: string;
  showNotification: (msg: string) => void;
  onRestored?: () => void;
}

export const EncryptedBackupPanel: React.FC<EncryptedBackupPanelProps> = ({
  scope,
  title = 'Cadangan Terenkripsi Kata Sandi (.wqbak)',
  description = 'Data dikunci dengan AES-256-GCM + kata sandi sebelum disimpan ke Google Drive / memori HP agar aman jika HP rusak total.',
  showNotification,
  onRestored,
}) => {
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    if (password.trim().length < 4) {
      showNotification('Masukkan kata sandi enkripsi minimal 4 karakter terlebih dahulu.');
      return;
    }
    setIsBusy(true);
    try {
      const res = await EncryptedBackupService.exportAndDownload(scope, password);
      showNotification(
        `Backup terenkripsi (${res.keyCount} bagian data) diunduh: ${res.filename}`
      );
    } catch (err) {
      showNotification(
        err instanceof Error ? err.message : 'Gagal membuat cadangan terenkripsi.'
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!password.trim()) {
      showNotification('Masukkan kata sandi cadangan di kolom atas sebelum memilih file.');
      return;
    }
    setIsBusy(true);
    try {
      const res = await EncryptedBackupService.restoreFromEncryptedFile(file, password);
      showNotification(
        `Berhasil mendekripsi & memulihkan ${res.restoredKeys} data (${res.ownerEmail})!`
      );
      if (onRestored) onRestored();
    } catch (err) {
      showNotification(
        err instanceof Error ? err.message : 'Gagal memulihkan file terenkripsi.'
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="border border-slate-200 rounded-xl p-3.5 space-y-2.5 bg-white text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Lock className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <div className="font-extrabold text-slate-900">{title}</div>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{description}</p>
          </div>
        </div>
        <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
      </div>

      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Kata sandi enkripsi / dekripsi (min. 4 karakter)"
          className="w-full min-h-[40px] border border-slate-300 rounded-xl pl-3 pr-10 text-xs"
        />
        <button
          type="button"
          onClick={() => setShowPassword(p => !p)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
          title={showPassword ? 'Sembunyikan sandi' : 'Lihat sandi'}
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      <input
        ref={restoreInputRef}
        type="file"
        accept=".json,.wqbak,application/json"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={isBusy}
          onClick={handleExport}
          className="min-h-[40px] bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-xl font-bold flex items-center justify-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Ekspor Enkripsi</span>
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => restoreInputRef.current?.click()}
          className="min-h-[40px] border border-slate-300 hover:bg-slate-50 disabled:opacity-60 text-slate-800 rounded-xl font-bold flex items-center justify-center gap-1.5"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Pulihkan File</span>
        </button>
      </div>
    </div>
  );
};

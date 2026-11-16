import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {
  Camera,
  CheckCircle2,
  Copy,
  Download,
  ImageUp,
  QrCode,
  RefreshCw,
  ScanLine,
  Share2,
  X,
} from 'lucide-react';

interface RtInviteQrBlockProps {
  orgName: string;
  brandTitle: string;
  memberCount: number;
  officerCount: number;
  inviteUrl: string;
  compactToken?: string;
  inviterName: string;
  showNotification: (msg: string) => void;
}

export const RtInviteQrBlock: React.FC<RtInviteQrBlockProps> = ({
  orgName,
  brandTitle,
  memberCount,
  officerCount,
  inviteUrl,
  compactToken,
  inviterName,
  showNotification,
}) => {
  const [qrMode, setQrMode] = useState<'link' | 'offline'>('link');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrError, setQrError] = useState<string>('');

  const payload =
    qrMode === 'offline' && compactToken
      ? compactToken
      : inviteUrl || compactToken || '';

  useEffect(() => {
    let cancelled = false;
    if (!payload) {
      setQrDataUrl('');
      return;
    }
    const level = payload.length > 900 ? 'L' : 'M';
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: level,
      margin: 2,
      width: 300,
      color: {
        dark: '#064e3b',
        light: '#ffffff',
      },
    })
      .then(url => {
        if (!cancelled) {
          setQrDataUrl(url);
          setQrError('');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl('');
          setQrError('Payload terlalu panjang untuk QR offline — gunakan Mode Link Judul.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [payload]);

  const handleDownloadQrPng = () => {
    if (!qrDataUrl) return;
    const img = new Image();
    img.onload = () => {
      const width = 440;
      const height = 560;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#065f46';
      ctx.fillRect(0, 0, width, 98);

      ctx.fillStyle = '#a7f3d0';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`BARCODE UNDANGAN ${brandTitle.toUpperCase()}`, width / 2, 32);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      const titleTrim = orgName.length > 28 ? `${orgName.slice(0, 27)}…` : orgName;
      ctx.fillText(titleTrim, width / 2, 62);

      ctx.fillStyle = '#d1fae5';
      ctx.font = '12px sans-serif';
      ctx.fillText(
        `${memberCount} Warga · ${officerCount} Pengurus Siap Klaim Akun`,
        width / 2,
        84
      );

      ctx.strokeStyle = '#d1fae5';
      ctx.lineWidth = 3;
      ctx.strokeRect(58, 120, 324, 324);
      ctx.drawImage(img, 70, 132, 300, 300);

      ctx.fillStyle = '#064e3b';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('Scan Barcode ini via Kamera HP untuk Bergabung', width / 2, 476);

      ctx.fillStyle = '#475569';
      ctx.font = '11px sans-serif';
      ctx.fillText('Pengurus & Warga tinggal Klaim Akun setelah masuk', width / 2, 498);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText(`Dibuat oleh ${inviterName} · WargaQu`, width / 2, 532);

      const link = document.createElement('a');
      const slug = orgName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'komunitas';
      link.download = `barcode-undangan-${slug}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showNotification('Gambar Barcode QR Undangan berhasil diunduh!');
    };
    img.src = qrDataUrl;
  };

  const handleCopyWa = async () => {
    const targetUrl = inviteUrl || compactToken;
    if (!targetUrl) return;
    const waText = `Halo Bapak/Ibu Pengurus & Warga *${orgName}* (${brandTitle}),\n\nRuang digital warga sudah dibuat di aplikasi *WargaQu* (daftar warga, kartu iuran, & transparansi kas sudah terisi).\n\n👉 Klik link berikut atau scan Barcode QR yang terlampir untuk langsung masuk & *Klaim Akun* masing-masing:\n${targetUrl}\n\nSalam,\n${inviterName}`;
    try {
      await navigator.clipboard.writeText(waText);
      showNotification('Pesan undangan WhatsApp disalin! Kirim beserta gambar QR-nya.');
    } catch {
      showNotification('Gagal menyalin pesan WhatsApp.');
    }
  };

  return (
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50/80 to-white p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-emerald-900">
          <QrCode className="w-4 h-4 text-emerald-700 shrink-0" />
          <span className="text-xs font-extrabold">Barcode QR Undangan</span>
        </div>
        {compactToken && (
          <div className="inline-flex rounded-lg border border-emerald-200 bg-white p-0.5 text-[10px] font-bold">
            <button
              type="button"
              onClick={() => setQrMode('link')}
              className={`px-2 py-0.5 rounded-md transition ${
                qrMode === 'link' ? 'bg-emerald-700 text-white' : 'text-slate-600'
              }`}
            >
              Link Judul
            </button>
            <button
              type="button"
              onClick={() => setQrMode('offline')}
              className={`px-2 py-0.5 rounded-md transition ${
                qrMode === 'offline' ? 'bg-emerald-700 text-white' : 'text-slate-600'
              }`}
            >
              Token Penuh
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center text-center gap-2">
        {qrError ? (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
            {qrError}
          </div>
        ) : qrDataUrl ? (
          <div className="p-2.5 bg-white rounded-2xl border-2 border-emerald-200 shadow-xs inline-block">
            <img
              src={qrDataUrl}
              alt={`Barcode QR ${orgName}`}
              className="w-44 h-44 object-contain block"
            />
          </div>
        ) : (
          <div className="py-10 flex flex-col items-center gap-2 text-slate-400 text-[11px]">
            <RefreshCw className="w-5 h-5 animate-spin text-emerald-700" />
            <span>Menyiapkan Barcode QR...</span>
          </div>
        )}
        <p className="text-[11px] text-slate-600 leading-snug max-w-xs">
          Ketua RT, Bendahara, Sekretaris &amp; warga cukup scan barcode ini untuk masuk &amp;{' '}
          <strong>Klaim Akun</strong> masing-masing.
        </p>
      </div>

      {inviteUrl && (
        <div className="p-2 rounded-xl border border-slate-200 bg-slate-50 font-mono text-[10px] text-slate-700 break-all">
          {inviteUrl}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!qrDataUrl}
          onClick={handleDownloadQrPng}
          className="min-h-[40px] px-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Unduh Barcode QR</span>
        </button>
        <button
          type="button"
          disabled={!inviteUrl && !compactToken}
          onClick={handleCopyWa}
          className="min-h-[40px] px-3 border border-emerald-700 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Salin Undangan WA</span>
        </button>
      </div>

      {inviteUrl && (
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(inviteUrl);
              showNotification('Link undangan disalin!');
            } catch {
              showNotification('Gagal menyalin link.');
            }
          }}
          className="w-full min-h-[36px] border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5"
        >
          <Copy className="w-3.5 h-3.5" />
          <span>Salin Link Saja</span>
        </button>
      )}
    </div>
  );
};

interface RtQrScannerModalProps {
  open: boolean;
  onClose: () => void;
  onDetectedPayload: (rawPayload: string) => Promise<void>;
  showNotification: (msg: string) => void;
}

export const RtQrScannerModal: React.FC<RtQrScannerModalProps> = ({
  open,
  onClose,
  onDetectedPayload,
  showNotification,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const processingRef = useRef<boolean>(false);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [scanSuccess, setScanSuccess] = useState('');

  const stopCamera = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (!open) {
      stopCamera();
      setCameraError('');
      setScanSuccess('');
      processingRef.current = false;
    }
    return () => stopCamera();
  }, [open]);

  if (!open) return null;

  const handleDecoded = async (raw: string) => {
    if (processingRef.current || !raw.trim()) return;
    processingRef.current = true;
    stopCamera();
    setScanSuccess('Barcode QR terbaca! Menyinkronkan data komunitas...');
    try {
      await onDetectedPayload(raw.trim());
      onClose();
    } finally {
      processingRef.current = false;
    }
  };

  const startCamera = async () => {
    setCameraError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Kamera langsung tidak tersedia. Gunakan Unggah Gambar Barcode QR.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
          let lastTs = 0;
          const tick = (ts: number) => {
            if (!streamRef.current || processingRef.current) return;
            const v = videoRef.current;
            const c = canvasRef.current;
            if (v && c && v.readyState >= 2 && ts - lastTs > 180) {
              lastTs = ts;
              const scale = Math.min(1, 680 / Math.max(v.videoWidth || 1, v.videoHeight || 1));
              const cw = Math.max(1, Math.round((v.videoWidth || 320) * scale));
              const ch = Math.max(1, Math.round((v.videoHeight || 240) * scale));
              c.width = cw;
              c.height = ch;
              const ctx = c.getContext('2d', { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(v, 0, 0, cw, ch);
                const imgData = ctx.getImageData(0, 0, cw, ch);
                const decoded = jsQR(imgData.data, cw, ch, { inversionAttempts: 'attemptBoth' });
                if (decoded?.data) {
                  void handleDecoded(decoded.data);
                  return;
                }
              }
            }
            rafRef.current = requestAnimationFrame(tick);
          };
          rafRef.current = requestAnimationFrame(tick);
        }
      }, 60);
    } catch {
      setCameraError('Izin kamera ditolak. Silakan unggah gambar QR dari galeri.');
      setCameraActive(false);
    }
  };

  const handleUploadQrImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const tryDim = (maxDim: number): string | null => {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const off = document.createElement('canvas');
          off.width = w;
          off.height = h;
          const ctx = off.getContext('2d', { willReadFrequently: true });
          if (!ctx) return null;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const data = ctx.getImageData(0, 0, w, h);
          return jsQR(data.data, w, h, { inversionAttempts: 'attemptBoth' })?.data || null;
        };
        const found = tryDim(1200) || tryDim(700) || tryDim(420);
        if (found) {
          void handleDecoded(found);
        } else {
          showNotification('Barcode QR tidak terbaca di gambar tersebut.');
        }
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-4 space-y-3 border border-slate-200 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-emerald-700" />
            <h3 className="text-sm font-extrabold text-slate-900">Scan Barcode QR Komunitas</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {scanSuccess && (
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{scanSuccess}</span>
          </div>
        )}

        <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
          {cameraActive ? (
            <div className="relative aspect-video bg-black">
              <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={stopCamera}
                className="absolute bottom-2 right-2 px-3 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold"
              >
                Tutup Kamera
              </button>
            </div>
          ) : (
            <div className="p-4 text-center space-y-2.5 text-white">
              <QrCode className="w-8 h-8 text-emerald-300 mx-auto" />
              <p className="text-[11px] text-slate-300">
                Scan barcode undangan RTQu / PaguyubanQu atau unggah gambar QR dari WhatsApp.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Kamera</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-2 rounded-xl bg-white text-slate-900 font-bold text-xs flex items-center gap-1.5"
                >
                  <ImageUp className="w-3.5 h-3.5" />
                  <span>Unggah Gambar QR</span>
                </button>
              </div>
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUploadQrImage}
            className="hidden"
          />
        </div>

        {cameraError && (
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
            {cameraError}
          </div>
        )}
      </div>
    </div>
  );
};


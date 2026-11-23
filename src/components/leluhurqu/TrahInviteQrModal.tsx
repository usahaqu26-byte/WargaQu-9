import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {
  Camera,
  CheckCircle2,
  Download,
  ImageUp,
  Link2,
  QrCode,
  RefreshCw,
  ScanLine,
  X,
} from 'lucide-react';

interface TrahQrCodeCardProps {
  trahName: string;
  memberCount: number;
  qrPayload: string;
  isSelfContained: boolean;
  roleLabel?: string;
  expiryLabel?: string;
  onNotify: (msg: string) => void;
  onAfterDownload?: () => void;
}

export const TrahQrCodeCard: React.FC<TrahQrCodeCardProps> = ({
  trahName,
  memberCount,
  qrPayload,
  isSelfContained,
  roleLabel,
  expiryLabel,
  onNotify,
  onAfterDownload,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrError, setQrError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    if (!qrPayload) {
      setQrDataUrl('');
      return;
    }

    const errorLevel = qrPayload.length > 1400 ? 'L' : 'M';
    QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: errorLevel,
      margin: 2,
      width: 340,
      color: {
        dark: '#064e3b',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (!cancelled) {
          setQrDataUrl(url);
          setQrError('');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl('');
          setQrError('Data terlalu panjang untuk QR langsung. Gunakan Mode Link Singkat.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [qrPayload]);

  const handleDownloadQrCard = () => {
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

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Top header banner
      ctx.fillStyle = '#065f46';
      ctx.fillRect(0, 0, width, 96);

      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BARCODE UNDANGAN SILSILAH NASABQU', width / 2, 34);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      const safeTitle = trahName.length > 30 ? `${trahName.slice(0, 29)}…` : trahName;
      ctx.fillText(safeTitle, width / 2, 64);

      ctx.fillStyle = '#a7f3d0';
      ctx.font = '12px sans-serif';
      const subParts = [`${memberCount} Anggota Tercatat`];
      if (roleLabel) subParts.push(`Akses: ${roleLabel}`);
      if (expiryLabel) subParts.push(expiryLabel);
      ctx.fillText(subParts.join(' • '), width / 2, 84);

      // QR frame
      ctx.strokeStyle = '#d1fae5';
      ctx.lineWidth = 3;
      ctx.strokeRect(48, 118, 344, 344);
      ctx.drawImage(img, 50, 120, 340, 340);

      // Footer instruction
      ctx.fillStyle = '#064e3b';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('Scan dari Kamera HP atau Menu Scan QR NasabQu', width / 2, 494);

      ctx.fillStyle = '#57534e';
      ctx.font = '11px sans-serif';
      ctx.fillText(
        isSelfContained
          ? 'Mode Mandiri: Silsilah langsung terbuka meski offline / beda server'
          : 'Mode Sinkronisasi: Buka link saat perangkat keluarga online',
        width / 2,
        516
      );

      ctx.fillStyle = '#78716c';
      ctx.font = '10px sans-serif';
      ctx.fillText('WargaQu • NasabQu Keluarga Nusantara', width / 2, 540);

      const link = document.createElement('a');
      const fileSlug = trahName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'trah';
      link.download = `qr-undangan-${fileSlug}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      onNotify('Gambar Barcode QR Undangan berhasil diunduh! Siap dikirim ke keluarga.');
      onAfterDownload?.();
    };
    img.src = qrDataUrl;
  };

  return (
    <div className="bg-gradient-to-b from-emerald-50 to-white p-3.5 rounded-2xl border border-emerald-200 space-y-3 text-center">
      <div className="flex items-center justify-between gap-2 text-left">
        <div className="flex items-center gap-1.5">
          <QrCode className="w-4 h-4 text-emerald-700 shrink-0" />
          <span className="text-[11px] font-extrabold text-emerald-950 uppercase tracking-wide">
            Barcode / QR Undangan
          </span>
        </div>
        <div className="flex items-center gap-1 flex-wrap justify-end">
          {roleLabel && (
            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full border bg-sky-100 text-sky-800 border-sky-300">
              {roleLabel}
            </span>
          )}
          {expiryLabel && (
            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full border bg-stone-100 text-stone-700 border-stone-300">
              {expiryLabel}
            </span>
          )}
          <span
            className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${
              isSelfContained
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : 'bg-amber-100 text-amber-800 border-amber-300'
            }`}
          >
            {isSelfContained ? 'Mandiri Offline' : 'Sinkronisasi'}
          </span>
        </div>
      </div>

      {qrError ? (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
          {qrError}
        </div>
      ) : qrDataUrl ? (
        <div className="flex flex-col items-center gap-2">
          <div className="p-2.5 bg-white rounded-2xl border-2 border-emerald-200 shadow-sm inline-block">
            <img
              src={qrDataUrl}
              alt={`QR Code Undangan ${trahName}`}
              className="w-48 h-48 sm:w-52 sm:h-52 object-contain block"
            />
          </div>
          <p className="text-[10px] text-stone-600 leading-snug max-w-xs">
            Saudara cukup <strong>scan barcode ini</strong> lewat kamera HP atau tombol{' '}
            <strong>Scan QR</strong> di NasabQu (atau unggah gambar QR ini dari galeri).
          </p>
        </div>
      ) : (
        <div className="py-10 flex flex-col items-center justify-center text-stone-400 text-xs gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
          <span>Menyiapkan Barcode QR...</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!qrDataUrl}
          onClick={handleDownloadQrCard}
          className="py-2 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-extrabold text-[11px] flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Unduh Gambar QR</span>
        </button>
        <button
          type="button"
          disabled={!qrPayload}
          onClick={() => {
            navigator.clipboard.writeText(qrPayload);
            onNotify('Data link/kode QR disalin ke clipboard!');
          }}
          className="py-2 px-3 rounded-xl bg-white hover:bg-stone-50 disabled:opacity-50 text-emerald-900 border border-emerald-300 font-extrabold text-[11px] flex items-center justify-center gap-1.5 active:scale-95 transition"
        >
          <Link2 className="w-3.5 h-3.5" />
          <span>Salin Isi QR</span>
        </button>
      </div>
    </div>
  );
};

interface TrahQrScannerModalProps {
  open: boolean;
  onClose: () => void;
  onDetectedPayload: (rawPayload: string) => Promise<boolean>;
  onNotify: (msg: string) => void;
}

export const TrahQrScannerModal: React.FC<TrahQrScannerModalProps> = ({
  open,
  onClose,
  onDetectedPayload,
  onNotify,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const processingRef = useRef<boolean>(false);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string>('');
  const [manualInput, setManualInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scanSuccessText, setScanSuccessText] = useState<string>('');

  const stopCamera = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
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
      setScanSuccessText('');
      processingRef.current = false;
    }
    return () => {
      stopCamera();
    };
  }, [open]);

  const handleDecodedValue = async (rawValue: string) => {
    if (processingRef.current) return;
    const clean = (rawValue || '').trim();
    if (!clean) return;
    processingRef.current = true;
    stopCamera();
    setScanSuccessText('Barcode terbaca! Memuat silsilah Trah...');
    setIsSubmitting(true);
    try {
      const ok = await onDetectedPayload(clean);
      if (ok) {
        onClose();
      } else {
        setScanSuccessText('');
        processingRef.current = false;
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const startCameraScan = async () => {
    setCameraError('');
    setScanSuccessText('');
    processingRef.current = false;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Browser atau perangkat ini tidak mendukung akses kamera langsung. Gunakan Unggah Gambar QR.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);

      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
          scheduleFrameScan();
        }
      }, 60);
    } catch {
      setCameraError(
        'Izin kamera ditolak atau kamera sedang dipakai aplikasi lain. Silakan unggah gambar QR atau tempel link undangan.'
      );
      setCameraActive(false);
    }
  };

  const scheduleFrameScan = () => {
    const NativeDetector = (
      window as unknown as {
        BarcodeDetector?: new (opts?: { formats?: string[] }) => {
          detect: (src: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
        };
      }
    ).BarcodeDetector;
    const detector = NativeDetector ? new NativeDetector({ formats: ['qr_code'] }) : null;

    let lastCheck = 0;
    const tick = async (ts: number) => {
      if (!streamRef.current || processingRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState >= 2 && ts - lastCheck > 180) {
        lastCheck = ts;
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (vw > 0 && vh > 0) {
          if (detector) {
            try {
              const found = await detector.detect(video);
              const val = found?.[0]?.rawValue;
              if (val) {
                void handleDecodedValue(val);
                return;
              }
            } catch {
              // fall back to jsQR below
            }
          }

          const maxDim = 720;
          const scale = Math.min(1, maxDim / Math.max(vw, vh));
          const cw = Math.max(1, Math.round(vw * scale));
          const ch = Math.max(1, Math.round(vh * scale));
          canvas.width = cw;
          canvas.height = ch;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, cw, ch);
            const imgData = ctx.getImageData(0, 0, cw, ch);
            const decoded = jsQR(imgData.data, cw, ch, {
              inversionAttempts: 'attemptBoth',
            });
            if (decoded?.data) {
              void handleDecodedValue(decoded.data);
              return;
            }
          }
        }
      }

      rafRef.current = requestAnimationFrame((nextTs) => {
        void tick(nextTs);
      });
    };

    rafRef.current = requestAnimationFrame((ts) => {
      void tick(ts);
    });
  };

  const handleUploadQrImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const tryDecodeAtMaxDim = (maxDim: number): string | null => {
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
          const res = jsQR(data.data, w, h, { inversionAttempts: 'attemptBoth' });
          return res?.data || null;
        };

        const found = tryDecodeAtMaxDim(1200) || tryDecodeAtMaxDim(700) || tryDecodeAtMaxDim(420);
        if (found) {
          void handleDecodedValue(found);
        } else {
          onNotify('Barcode QR tidak terdeteksi pada gambar tersebut. Pastikan gambar QR jelas & tidak terpotong.');
        }
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    setIsSubmitting(true);
    try {
      const ok = await onDetectedPayload(manualInput.trim());
      if (ok) {
        setManualInput('');
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-stone-200 relative text-stone-800 max-h-[92vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-stone-700 bg-stone-100 transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow">
            <ScanLine className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-stone-900">
              Gabung Trah via Barcode / Link
            </h3>
            <p className="text-[11px] text-stone-500">
              Scan kamera, unggah gambar QR dari WhatsApp, atau tempel kode undangan
            </p>
          </div>
        </div>

        {scanSuccessText && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{scanSuccessText}</span>
          </div>
        )}

        {/* Kamera Live Scanner */}
        <div className="bg-stone-900 rounded-2xl overflow-hidden border border-stone-700 relative">
          {cameraActive ? (
            <div className="relative aspect-video bg-black flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-40 h-40 border-2 border-amber-400 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
              </div>
              <button
                type="button"
                onClick={stopCamera}
                className="absolute bottom-2 right-2 px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold shadow"
              >
                Matikan Kamera
              </button>
            </div>
          ) : (
            <div className="p-4 text-center space-y-2.5 text-white">
              <QrCode className="w-8 h-8 text-amber-300 mx-auto" />
              <p className="text-xs text-stone-300">
                Arahkan kamera ke Barcode QR Undangan di HP saudara atau poster Trah.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  type="button"
                  onClick={() => void startCameraScan()}
                  className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-extrabold text-xs flex items-center gap-1.5 shadow active:scale-95 transition"
                >
                  <Camera className="w-4 h-4" />
                  <span>Buka Kamera Scan QR</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold text-xs flex items-center gap-1.5 shadow active:scale-95 transition"
                >
                  <ImageUp className="w-4 h-4" />
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

        {cameraActive && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 font-extrabold text-xs flex items-center justify-center gap-1.5 transition"
          >
            <ImageUp className="w-4 h-4" />
            <span>Atau Unggah Gambar QR dari Galeri</span>
          </button>
        )}

        {/* Tempel Link / Kode Manual */}
        <form onSubmit={handleManualSubmit} className="pt-2 border-t border-stone-200 space-y-2">
          <label className="text-[11px] font-extrabold text-stone-700 flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5 text-emerald-700" />
            <span>Atau Tempel Link / Kode Offline Undangan</span>
          </label>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Tempel link (?trah=... / ?t=LQH2_...) atau kode..."
              className="flex-1 min-w-0 px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:border-emerald-600 focus:bg-white outline-hidden"
            />
            <button
              type="submit"
              disabled={isSubmitting || !manualInput.trim()}
              className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-extrabold text-xs shrink-0 transition"
            >
              {isSubmitting ? 'Memuat...' : 'Gabung'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

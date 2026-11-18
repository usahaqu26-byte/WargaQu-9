import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {
  Camera,
  CheckCircle2,
  Copy,
  ImageUp,
  Laptop,
  Lock,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Unlink,
  Wallet,
  X,
} from 'lucide-react';
import {
  DEVICE_PAIRING_SYNC_EVENT,
  DevicePairingService,
  LinkedDesktopDevice,
  PairedHostSession,
  PairingSessionInfo,
} from '../../services/devicePairingService';
import {
  RELAY_STATUS_EVENT,
  RealtimeRelayService,
  RelayConnectionState,
} from '../../services/realtimeRelayService';

interface LaptopQrWaitCardProps {
  onPairedSuccess?: (info: {
    hostLabel: string;
    accountEmail: string;
    restoredKeys: number;
    includeDompetQu: boolean;
  }) => void;
  showNotification: (msg: string) => void;
  compact?: boolean;
}

export const LaptopQrWaitCard: React.FC<LaptopQrWaitCardProps> = ({
  onPairedSuccess,
  showNotification,
  compact = false,
}) => {
  const [session, setSession] = useState<PairingSessionInfo>(() =>
    DevicePairingService.createPairingSession()
  );
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [relayState, setRelayState] = useState<RelayConnectionState>(() =>
    RealtimeRelayService.getStatus()
  );
  const [secondsLeft, setSecondsLeft] = useState<number>(180);
  const [pairedDone, setPairedDone] = useState<{
    hostLabel: string;
    accountEmail: string;
    restoredKeys: number;
    includeDompetQu: boolean;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const onPairedSuccessRef = useRef(onPairedSuccess);
  const showNotificationRef = useRef(showNotification);
  onPairedSuccessRef.current = onPairedSuccess;
  showNotificationRef.current = showNotification;

  const handleRefreshQr = () => {
    setPairedDone(null);
    setErrorMsg('');
    setSession(DevicePairingService.createPairingSession());
    setSecondsLeft(180);
  };

  useEffect(() => {
    const onRelayStatus = (ev: Event) => {
      const next = (ev as CustomEvent<RelayConnectionState>).detail;
      if (next) setRelayState(next);
    };
    window.addEventListener(RELAY_STATUS_EVENT, onRelayStatus);
    return () => window.removeEventListener(RELAY_STATUS_EVENT, onRelayStatus);
  }, []);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(session.qrUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: compact ? 220 : 260,
      color: {
        dark: '#064e3b',
        light: '#ffffff',
      },
    })
      .then(url => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [session.qrUrl, compact]);

  useEffect(() => {
    const stopListen = DevicePairingService.listenForPairingOnLaptop(
      session,
      info => {
        setPairedDone(info);
        showNotificationRef.current(`Laptop terhubung (${info.accountEmail}) · ${info.restoredKeys} data tersinkron!`);
        onPairedSuccessRef.current?.(info);
      },
      msg => {
        setErrorMsg(msg);
      }
    );
    return stopListen;
  }, [session]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const rem = Math.max(0, Math.ceil((session.expiresAt - Date.now()) / 1000));
      setSecondsLeft(rem);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [session.expiresAt]);

  const handleCopyToken = async () => {
    try {
      await navigator.clipboard.writeText(session.shortToken);
      showNotification('Kode tautan QR disalin! Tempelkan di HP jika kamera tidak dipakai.');
    } catch {
      showNotification('Gagal menyalin kode tautan.');
    }
  };

  if (pairedDone) {
    return (
      <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50 text-center space-y-2.5">
        <CheckCircle2 className="w-10 h-10 text-emerald-700 mx-auto" />
        <div>
          <h4 className="text-sm font-extrabold text-emerald-950">Laptop Berhasil Terhubung</h4>
          <p className="text-xs text-emerald-800 mt-0.5">
            Akun <strong>{pairedDone.accountEmail}</strong> · {pairedDone.restoredKeys} data tersinkron
          </p>
          <p className="text-[11px] text-emerald-700 mt-1">
            {pairedDone.includeDompetQu
              ? 'DompetQu ikut disinkronkan di sesi ini.'
              : 'DompetQu tetap terisolasi di HP utama demi privasi.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-bold text-slate-700 flex items-center gap-1.5">
          <Laptop className="w-3.5 h-3.5 text-emerald-700" />
          <span>Scan Barcode dari HP WargaQu</span>
        </span>
        <span
          className={`font-semibold tabular-nums ${
            relayState === 'connected'
              ? 'text-emerald-700'
              : 'text-amber-700'
          }`}
        >
          {relayState === 'connected'
            ? 'Relay Real-Time Siap'
            : 'Relay Jalur HTTP Siap'}
        </span>
      </div>

      <div className="flex flex-col items-center justify-center bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        {secondsLeft === 0 ? (
          <div className="py-8 text-center space-y-2.5">
            <QrCode className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-600 font-medium">
              Barcode QR kedaluwarsa demi keamanan.
            </p>
            <button
              type="button"
              onClick={handleRefreshQr}
              className="min-h-[40px] px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Buat QR Baru</span>
            </button>
          </div>
        ) : qrDataUrl ? (
          <>
            <div className="p-2 bg-white rounded-xl border border-emerald-200 shadow-xs">
              <img
                src={qrDataUrl}
                alt="QR Tautkan Laptop WargaQu"
                className={`${compact ? 'w-44 h-44' : 'w-52 h-52'} object-contain block`}
              />
            </div>
            <div className="text-center space-y-1">
              <div className="text-xs font-bold text-slate-900">
                Kode Sesi (Bisa Diketik di HP):{' '}
                <span className="font-mono tracking-wider text-sm text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {session.sessionId}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 tabular-nums">
                Berlaku {Math.floor(secondsLeft / 60)}:
                {String(secondsLeft % 60).padStart(2, '0')} · Terenkripsi 2 arah (HP ↔ Laptop)
              </div>
            </div>
          </>
        ) : (
          <div className="py-10 flex flex-col items-center gap-2 text-xs text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin text-emerald-700" />
            <span>Menyiapkan Barcode QR...</span>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-800">
          {errorMsg}
        </div>
      )}

      <div className="text-[11px] text-slate-600 space-y-1 leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-2.5">
        <div>1. Buka aplikasi ini di HP (menu <strong>Akun Saya</strong>) — <em>tidak wajib login dulu</em>.</div>
        <div>2. Ketuk <strong>Tautkan Laptop (Scan QR)</strong> lalu scan QR atau cukup ketik 6 huruf <strong>{session.sessionId}</strong>.</div>
        <div>3. Semua data langsung masuk otomatis &amp; setiap edit di Laptop ikut sinkron ke HP.</div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleCopyToken}
          className="min-h-[40px] px-3 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
        >
          <Copy className="w-3.5 h-3.5" />
          <span>Salin Kode</span>
        </button>
        <button
          type="button"
          onClick={handleRefreshQr}
          className="min-h-[40px] px-3 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Muat Ulang QR</span>
        </button>
      </div>
    </div>
  );
};

interface PhoneScanPairModalProps {
  open: boolean;
  initialToken?: string;
  onClose: () => void;
  showNotification: (msg: string) => void;
}

export const PhoneScanPairModal: React.FC<PhoneScanPairModalProps> = ({
  open,
  initialToken = '',
  onClose,
  showNotification,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [parsedTarget, setParsedTarget] = useState<{
    sessionId: string;
    secretHex: string;
  } | null>(null);
  const [includeDompetQu, setIncludeDompetQu] = useState(false);
  const [sending, setSending] = useState(false);
  const [doneResult, setDoneResult] = useState<{
    deviceName: string;
    keyCount: number;
    acknowledged: boolean;
  } | null>(null);

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
      setManualInput('');
      setParsedTarget(null);
      setSending(false);
      setDoneResult(null);
      return;
    }

    if (initialToken) {
      const parsed = DevicePairingService.parsePairingToken(initialToken);
      if (parsed) {
        setParsedTarget(parsed);
      }
    }
    return () => stopCamera();
  }, [open, initialToken]);

  if (!open) return null;

  const acceptRawPayload = (raw: string) => {
    const parsed = DevicePairingService.parsePairingToken(raw);
    if (!parsed) {
      setCameraError('QR / kode tautan laptop tidak valid. Pastikan scan QR dari halaman Masuk Laptop.');
      return false;
    }
    stopCamera();
    setCameraError('');
    setParsedTarget(parsed);
    return true;
  };

  const startCamera = async () => {
    setCameraError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Kamera tidak tersedia. Gunakan Unggah Gambar QR atau Tempel Kode.');
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
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => {});
        let lastTs = 0;
        const tick = (ts: number) => {
          if (!streamRef.current) return;
          const v = videoRef.current;
          const c = canvasRef.current;
          if (v && c && v.readyState >= 2 && ts - lastTs > 180) {
            lastTs = ts;
            const scale = Math.min(1, 720 / Math.max(v.videoWidth || 1, v.videoHeight || 1));
            const cw = Math.max(1, Math.round((v.videoWidth || 320) * scale));
            const ch = Math.max(1, Math.round((v.videoHeight || 240) * scale));
            c.width = cw;
            c.height = ch;
            const ctx = c.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(v, 0, 0, cw, ch);
              const imgData = ctx.getImageData(0, 0, cw, ch);
              const decoded = jsQR(imgData.data, cw, ch, { inversionAttempts: 'attemptBoth' });
              if (decoded?.data && acceptRawPayload(decoded.data)) {
                return;
              }
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      }, 60);
    } catch {
      setCameraError('Izin kamera ditolak. Anda bisa tempel kode tautan atau unggah foto QR.');
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
          acceptRawPayload(found);
        } else {
          setCameraError('Barcode QR tidak terbaca dari gambar tersebut.');
        }
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmPair = async () => {
    if (!parsedTarget) return;
    setSending(true);
    setCameraError('');
    try {
      const result = await DevicePairingService.sendPairingFromPhone(parsedTarget, {
        includeDompetQu,
      });
      DevicePairingService.clearPendingPairToken();
      setDoneResult(result);
      showNotification(`Laptop (${result.deviceName}) berhasil ditautkan!`);
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Gagal mengirim data tautan.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 space-y-4 border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-emerald-700" />
            <h3 className="text-sm font-extrabold text-slate-900">
              Tautkan Perangkat Laptop / PC
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {doneResult ? (
          <div className="space-y-4 text-center py-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-700 mx-auto" />
            <div className="space-y-1">
              <h4 className="text-base font-extrabold text-slate-900">Perangkat Tertaut</h4>
              <p className="text-xs text-slate-600">
                <strong>{doneResult.deviceName}</strong> kini terhubung ({doneResult.keyCount} data
                terenkripsi dikirim).
              </p>
              <p className="text-[11px] text-slate-500">
                {doneResult.acknowledged
                  ? 'Sinkronisasi langsung aktif antar HP dan Laptop.'
                  : 'Paket sudah terkirim melalui relay. Pastikan tab Laptop tetap terbuka.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold"
            >
              Selesai
            </button>
          </div>
        ) : parsedTarget ? (
          <div className="space-y-3.5 text-xs">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5">
              <Laptop className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <div className="font-extrabold text-emerald-950">
                  Sesi Laptop Siap Ditautkan (Kode {parsedTarget.sessionId})
                </div>
                <div className="text-[11px] text-emerald-800 mt-0.5">
                  Data akun, RTQu, LeluhurQu, UsahaQu, ChatQu &amp; AreaQu akan disinkronkan
                  terenkripsi langsung ke browser Laptop Anda.
                </div>
              </div>
            </div>

            <label className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
              <div className="flex items-start gap-2">
                <Wallet className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900">Sertakan DompetQu Pribadi</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {includeDompetQu
                      ? 'Saldo Cash, ATM & catatan DompetQu ikut dibuka di Laptop.'
                      : 'Disarankan mati: DompetQu tetap terisolasi hanya di HP ini.'}
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={includeDompetQu}
                onChange={e => setIncludeDompetQu(e.target.checked)}
                className="w-5 h-5 accent-emerald-700 shrink-0 mt-0.5"
              />
            </label>

            {cameraError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-800">
                {cameraError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  DevicePairingService.clearPendingPairToken();
                  setParsedTarget(null);
                }}
                disabled={sending}
                className="min-h-[44px] border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50"
              >
                Scan Ulang
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmPair()}
                disabled={sending}
                className="min-h-[44px] bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white rounded-xl font-bold"
              >
                {sending ? 'Mengirim...' : 'Hubungkan Sekarang'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-xs">
            <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-700">
              {cameraActive ? (
                <div className="relative aspect-video bg-black">
                  <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="absolute bottom-2 right-2 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-[11px] font-bold"
                  >
                    Tutup Kamera
                  </button>
                </div>
              ) : (
                <div className="p-5 text-center space-y-3 text-white">
                  <QrCode className="w-9 h-9 text-emerald-300 mx-auto" />
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Buka aplikasi ini di browser Laptop, pilih <strong>Masuk → Scan QR</strong>,
                    lalu arahkan kamera HP ke layar Laptop.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <button
                      type="button"
                      onClick={() => void startCamera()}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Buka Kamera</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white text-slate-900 font-bold text-xs flex items-center gap-1.5"
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

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 block">
                Atau ketik 6 huruf Kode Sesi dari layar Laptop (contoh: ABC123):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualInput}
                  onChange={e => setManualInput(e.target.value)}
                  placeholder="Contoh: ABC123 atau WQP1:..."
                  className="flex-1 min-h-[40px] border border-slate-300 rounded-xl px-3 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => acceptRawPayload(manualInput)}
                  className="min-h-[40px] px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shrink-0"
                >
                  Lanjut
                </button>
              </div>
            </div>

            {cameraError && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                {cameraError}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface LinkedDevicesSectionProps {
  showNotification: (msg: string) => void;
  initialPendingPairToken?: string;
}

export const LinkedDevicesSection: React.FC<LinkedDevicesSectionProps> = ({
  showNotification,
  initialPendingPairToken = '',
}) => {
  const [linkedDevices, setLinkedDevices] = useState<LinkedDesktopDevice[]>(() =>
    DevicePairingService.getLinkedDevices()
  );
  const [pairedHost, setPairedHost] = useState<PairedHostSession | null>(() =>
    DevicePairingService.getPairedHost()
  );
  const [scanModalOpen, setScanModalOpen] = useState<boolean>(() => Boolean(initialPendingPairToken));
  const [showQrGenerator, setShowQrGenerator] = useState<boolean>(false);
  const [syncingNow, setSyncingNow] = useState<boolean>(false);

  useEffect(() => {
    const sync = () => {
      setLinkedDevices(DevicePairingService.getLinkedDevices());
      setPairedHost(DevicePairingService.getPairedHost());
    };
    window.addEventListener(DEVICE_PAIRING_SYNC_EVENT, sync);
    return () => window.removeEventListener(DEVICE_PAIRING_SYNC_EVENT, sync);
  }, []);

  useEffect(() => {
    if (initialPendingPairToken) {
      setScanModalOpen(true);
    }
  }, [initialPendingPairToken]);

  const handleManualSyncNow = async () => {
    setSyncingNow(true);
    try {
      const count = await DevicePairingService.pushLiveUpdateIfChanged(true);
      showNotification(
        count > 0
          ? 'Sinkronisasi data antar HP dan Laptop berhasil dikirim.'
          : 'Belum ada perangkat lain yang sedang tertaut.'
      );
    } finally {
      setSyncingNow(false);
    }
  };

  return (
    <section className="p-4 space-y-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Laptop className="w-4 h-4 text-emerald-700" />
          <span className="font-extrabold text-slate-900">
            Buka di Laptop / PC (Barcode QR)
          </span>
        </div>
        <span className="text-[11px] font-semibold text-slate-500">
          {pairedHost
            ? 'Tersambung dari HP'
            : linkedDevices.length > 0
            ? `${linkedDevices.length} Laptop Aktif`
            : 'Siap Ditautkan'}
        </span>
      </div>

      {pairedHost ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 space-y-2.5">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="font-bold text-emerald-950 truncate">
                Terhubung ke {pairedHost.hostLabel}
              </div>
              <div className="text-[11px] text-emerald-800 mt-0.5">
                Akun: {pairedHost.accountEmail} ·{' '}
                {pairedHost.includeDompetQu
                  ? 'DompetQu ikut disinkronkan'
                  : 'DompetQu tetap terkunci di HP'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void handleManualSyncNow()}
              disabled={syncingNow}
              className="min-h-[38px] px-3 bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-900 rounded-xl font-bold flex items-center justify-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingNow ? 'animate-spin' : ''}`} />
              <span>{syncingNow ? 'Menyinkron...' : 'Sinkronkan'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                DevicePairingService.disconnectLaptopSession(true);
                showNotification('Sesi Laptop diputuskan & data dibersihkan dari browser ini.');
              }}
              className="min-h-[38px] px-3 border border-rose-300 bg-white hover:bg-rose-50 text-rose-700 rounded-xl font-bold flex items-center justify-center gap-1.5"
            >
              <Unlink className="w-3.5 h-3.5" />
              <span>Putuskan Laptop</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Gunakan aplikasi ini di Laptop/PC tanpa daftar ulang: scan Barcode QR seperti WhatsApp
            Web untuk sinkronisasi terenkripsi langsung.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setScanModalOpen(true)}
              className="min-h-[42px] px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold flex items-center justify-center gap-1.5"
            >
              <ScanLine className="w-4 h-4" />
              <span>Tautkan Laptop (Scan QR)</span>
            </button>
            <button
              type="button"
              onClick={() => setShowQrGenerator(v => !v)}
              className="min-h-[42px] px-3 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 rounded-xl font-bold flex items-center justify-center gap-1.5"
            >
              <QrCode className="w-4 h-4 text-emerald-700" />
              <span>{showQrGenerator ? 'Tutup QR Laptop' : 'Tampilkan QR di Layar Ini'}</span>
            </button>
          </div>

          {showQrGenerator && (
            <div className="pt-1">
              <LaptopQrWaitCard
                compact
                showNotification={showNotification}
                onPairedSuccess={() => setShowQrGenerator(false)}
              />
            </div>
          )}

          {linkedDevices.length > 0 && (
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="px-3 py-2 bg-slate-50 flex items-center justify-between text-[11px] font-bold text-slate-600">
                <span>Perangkat Laptop Tertaut</span>
                <button
                  type="button"
                  onClick={() => void handleManualSyncNow()}
                  disabled={syncingNow}
                  className="text-emerald-700 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${syncingNow ? 'animate-spin' : ''}`} />
                  <span>Sinkronkan</span>
                </button>
              </div>
              {linkedDevices.map(dev => (
                <div
                  key={dev.linkId}
                  className="px-3 py-2.5 flex items-center justify-between gap-2"
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <Smartphone className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate">{dev.deviceName}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                        <span>{dev.browserInfo}</span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-0.5">
                          <Lock className="w-3 h-3" />
                          {dev.includeDompetQu ? 'DompetQu Ikut' : 'DompetQu Privat'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      DevicePairingService.unlinkLaptopFromPhone(dev.linkId);
                      showNotification(`Tautan ${dev.deviceName} diputuskan.`);
                    }}
                    className="min-h-[34px] px-2.5 border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg text-[11px] font-bold shrink-0"
                  >
                    Putuskan
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <PhoneScanPairModal
        open={scanModalOpen}
        initialToken={initialPendingPairToken}
        onClose={() => {
          DevicePairingService.clearPendingPairToken();
          setScanModalOpen(false);
        }}
        showNotification={showNotification}
      />
    </section>
  );
};

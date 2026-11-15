import React, { useState } from 'react';
import { QrCode, CheckCircle2, X, ShieldCheck, ArrowRight } from 'lucide-react';
import {
  MonetizableModuleId,
  MonetizationService,
} from '../../services/monetizationService';

interface ModularFeeSheetProps {
  isOpen: boolean;
  moduleId: MonetizableModuleId;
  actionLabel: string;
  grossAmount?: number;
  unlockModule?: boolean;
  onClose: () => void;
  onPaid: () => void;
  showNotification: (msg: string) => void;
}

export const ModularFeeSheet: React.FC<ModularFeeSheetProps> = ({
  isOpen,
  moduleId,
  actionLabel,
  grossAmount = 0,
  unlockModule = true,
  onClose,
  onPaid,
  showNotification,
}) => {
  const [payChannel, setPayChannel] = useState<'qris_dev' | 'akumulasi'>('qris_dev');

  if (!isOpen) return null;

  const calc = MonetizationService.calculateFee(moduleId, grossAmount);
  if (!calc.enabled || calc.feeAmount <= 0) return null;
  const qrisCfg = MonetizationService.getQrisConfig();

  const handleConfirm = () => {
    MonetizationService.recordCharge({
      moduleId,
      actionLabel,
      grossAmount: grossAmount > 0 ? grossAmount : calc.feeAmount,
      unlockModule,
    });
    showNotification(
      `Biaya Rp ${calc.feeAmount.toLocaleString('id-ID')} tercatat. ${actionLabel} dibuka!`
    );
    onPaid();
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 overflow-hidden text-slate-900">
        <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Aktivasi Fitur Modular</h3>
            <p className="text-[11px] text-slate-500">{calc.rule.moduleName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3.5 text-xs">
          <div className="border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-500">{actionLabel}</div>
              <div className="text-lg font-extrabold text-emerald-700 font-mono tabular-nums mt-0.5">
                Rp {calc.feeAmount.toLocaleString('id-ID')}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">{calc.label}</div>
            </div>
            <ShieldCheck className="w-6 h-6 text-emerald-700 shrink-0" />
          </div>

          <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setPayChannel('qris_dev')}
              className={`py-2 px-2.5 rounded-lg text-[11px] font-bold transition ${
                payChannel === 'qris_dev'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600'
              }`}
            >
              QRIS Developer
            </button>
            <button
              type="button"
              onClick={() => setPayChannel('akumulasi')}
              className={`py-2 px-2.5 rounded-lg text-[11px] font-bold transition ${
                payChannel === 'akumulasi'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600'
              }`}
            >
              Catat Akumulasi
            </button>
          </div>

          {payChannel === 'qris_dev' ? (
            <div className="border border-slate-200 rounded-xl p-3.5 text-center space-y-2">
              {qrisCfg.qrisImageDataUrl ? (
                <img
                  src={qrisCfg.qrisImageDataUrl}
                  alt="QRIS Developer WargaQu"
                  referrerPolicy="no-referrer"
                  className="w-40 h-40 object-contain mx-auto border border-slate-200 rounded-lg"
                />
              ) : (
                <div className="py-3 space-y-1.5">
                  <QrCode className="w-20 h-20 text-slate-800 mx-auto" />
                  <div className="text-[11px] font-bold text-amber-700">
                    QRCode Developer Resmi Menyusul
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {qrisCfg.qrisPendingNote}
                  </p>
                </div>
              )}
              <div className="text-[11px] text-slate-600">
                Tujuan: <span className="font-bold text-slate-900">{qrisCfg.merchantName}</span>
              </div>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl p-3.5 text-[11px] text-slate-600 leading-relaxed">
              Biaya Rp <span className="font-mono font-bold text-slate-900">{calc.feeAmount.toLocaleString('id-ID')}</span> akan
              masuk ke daftar <span className="font-semibold text-slate-900">Akumulasi Setoran Developer</span> untuk ditransfer
              kolektif via QRCode Developer.
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Konfirmasi &amp; Buka</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

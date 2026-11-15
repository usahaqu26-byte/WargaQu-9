import React, { useState } from 'react';
import { X, Check, Share2, Copy, ShieldCheck, ArrowRight } from 'lucide-react';
import {
  GuideModuleId,
  ModuleOnboardingService,
} from '../../services/moduleOnboardingService';

interface ModuleGuideModalProps {
  isOpen: boolean;
  moduleId: GuideModuleId | null;
  isFirstVisit?: boolean;
  onClose: () => void;
  showNotification: (msg: string) => void;
}

export const ModuleGuideModal: React.FC<ModuleGuideModalProps> = ({
  isOpen,
  moduleId,
  isFirstVisit = false,
  onClose,
  showNotification,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !moduleId) return null;

  const guide = ModuleOnboardingService.getGuide(moduleId);

  const handleConfirmClose = () => {
    ModuleOnboardingService.markSeen(moduleId);
    onClose();
  };

  const handleCopyGuide = () => {
    const text = ModuleOnboardingService.formatShareText(moduleId);
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        showNotification(`Panduan ${guide.name} disalin ke clipboard.`);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        showNotification('Teks panduan siap dibagikan.');
      });
  };

  return (
    <div
      className="fixed inset-0 z-[110] bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="module-guide-title"
    >
      <div className="w-full max-w-md bg-white text-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Drag Handle Affordance on Mobile */}
        <div className="pt-2.5 pb-1 flex justify-center sm:hidden shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-slate-300" />
        </div>

        {/* Header */}
        <div className="px-5 pt-3 pb-4 border-b border-slate-100 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-emerald-700 font-medium">
              <span>{guide.category}</span>
              <span aria-hidden="true">·</span>
              <span>{isFirstVisit ? 'Pengenalan Akun Baru' : 'Panduan Modul'}</span>
            </div>
            <h2
              id="module-guide-title"
              className="text-lg font-extrabold text-slate-900 mt-0.5 leading-snug"
            >
              Mengenal {guide.name}
            </h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {guide.tagline}
            </p>
          </div>
          <button
            type="button"
            onClick={handleConfirmClose}
            className="min-h-[44px] min-w-[44px] -mr-2 -mt-1 rounded-full hover:bg-slate-100 active:scale-95 flex items-center justify-center text-slate-500 transition shrink-0"
            aria-label="Tutup panduan"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 text-xs">
          {/* Manfaat Utama */}
          <section className="space-y-2.5">
            <h3 className="text-xs font-bold text-slate-900 tracking-tight">
              Manfaat Utama untuk Anda
            </h3>
            <ul className="space-y-2">
              {guide.benefits.map((benefit, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2.5 text-slate-700 leading-relaxed"
                >
                  <Check className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </section>

          <hr className="border-slate-100" />

          {/* 3 Langkah Mulai Cepat */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold text-slate-900 tracking-tight">
              Cara Mulai dalam 3 Langkah
            </h3>
            <div className="space-y-3">
              {guide.steps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <span className="font-mono tabular-nums text-xs font-bold text-emerald-700 pt-0.5 shrink-0">
                    0{idx + 1}.
                  </span>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-xs">
                      {step.title}
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed mt-0.5">
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Privasi & Keamanan */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-600 leading-relaxed">
              {guide.privacyNote}
            </p>
          </div>
        </div>

        {/* Bottom Thumb-Zone Actions */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-white space-y-2 shrink-0">
          {isFirstVisit && (
            <p className="text-[11px] text-slate-500 text-center">
              Info ini hanya muncul 1x. Ketuk ikon <strong className="text-slate-700">?</strong> di pojok atas kapan saja untuk membukanya lagi.
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyGuide}
              className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-98 transition shrink-0"
              title="Salin ringkasan panduan"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-700" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              <span>{copied ? 'Disalin' : 'Salin'}</span>
            </button>
            <button
              type="button"
              onClick={() => ModuleOnboardingService.shareToWhatsApp(moduleId)}
              className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-98 transition shrink-0"
              title="Bagikan cara pakai modul ke WhatsApp"
            >
              <Share2 className="w-4 h-4 text-emerald-700" />
              <span>WA</span>
            </button>
            <button
              type="button"
              onClick={handleConfirmClose}
              className="flex-1 min-h-[44px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition"
            >
              <span>Mengerti &amp; Mulai</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

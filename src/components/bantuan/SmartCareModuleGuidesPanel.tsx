import React, { useMemo, useState } from 'react';
import {
  Search,
  BookOpen,
  Share2,
  Copy,
  Check,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import {
  GuideModuleId,
  MODULE_GUIDE_SYNC_EVENT,
  ModuleOnboardingService,
} from '../../services/moduleOnboardingService';

interface SmartCareModuleGuidesPanelProps {
  showNotification: (msg: string) => void;
}

export const SmartCareModuleGuidesPanel: React.FC<SmartCareModuleGuidesPanelProps> = ({
  showNotification,
}) => {
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<GuideModuleId>('leluhurqu');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [, setSyncTick] = useState(0);

  React.useEffect(() => {
    const onSync = () => setSyncTick((t) => t + 1);
    window.addEventListener(MODULE_GUIDE_SYNC_EVENT, onSync);
    return () => window.removeEventListener(MODULE_GUIDE_SYNC_EVENT, onSync);
  }, []);

  const guides = useMemo(() => {
    const all = ModuleOnboardingService.getAllGuides();
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q) ||
        g.tagline.toLowerCase().includes(q) ||
        g.benefits.some((b) => b.toLowerCase().includes(q)) ||
        g.steps.some(
          (s) =>
            s.title.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q)
        ) ||
        g.faq.some(
          (f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)
        )
    );
  }, [query]);

  const handleCopy = (id: GuideModuleId, name: string) => {
    const text = ModuleOnboardingService.formatShareText(id);
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedId(id);
        showNotification(`Ringkasan panduan ${name} berhasil disalin.`);
        setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
      })
      .catch(() => showNotification('Ringkasan panduan siap dibagikan.'));
  };

  return (
    <div className="space-y-4">
      {/* Intro & Search Bar */}
      <section className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Panduan &amp; Manfaat Semua Modul</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Referensi cara pakai dan manfaat tiap modul untuk akun baru. Bisa dibaca ulang kapan saja atau dibagikan ke grup WA warga/keluarga.
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari modul, fitur, atau pertanyaan (mis. silsilah, iuran, SOS, kasir)..."
            className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-hidden"
          />
        </div>
      </section>

      {/* Module Guides List */}
      {guides.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 text-center space-y-2">
          <p className="text-xs font-bold text-slate-200">
            Tidak ada panduan yang cocok dengan &ldquo;{query}&rdquo;
          </p>
          <button
            type="button"
            onClick={() => setQuery('')}
            className="text-xs text-emerald-400 font-semibold hover:underline"
          >
            Tampilkan semua {ModuleOnboardingService.getAllGuides().length} modul
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {guides.map((guide, index) => {
            const isOpen = expandedId === guide.id;
            const seen = ModuleOnboardingService.hasSeen(guide.id);

            return (
              <article
                key={guide.id}
                className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isOpen ? ('' as GuideModuleId) : guide.id)}
                  className="w-full px-4 py-3.5 text-left flex items-start justify-between gap-3 hover:bg-slate-700/40 transition min-h-[56px]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="font-mono tabular-nums text-emerald-400 font-bold">
                        0{index + 1}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{guide.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className={seen ? 'text-slate-400' : 'text-amber-300 font-medium'}>
                        {seen ? 'Sudah dibaca' : 'Baru'}
                      </span>
                    </div>
                    <h3 className="text-sm font-extrabold text-white mt-0.5">
                      {guide.name}
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      {guide.tagline}
                    </p>
                  </div>
                  <span className="mt-1 text-slate-400 shrink-0">
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </span>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-700/80 space-y-4 text-xs">
                    {/* Manfaat */}
                    <div className="space-y-1.5">
                      <div className="font-bold text-emerald-400 text-[11px]">
                        Manfaat Utama
                      </div>
                      <ul className="space-y-1.5 text-slate-200">
                        {guide.benefits.map((b, bIdx) => (
                          <li key={bIdx} className="flex items-start gap-2 leading-relaxed">
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Langkah */}
                    <div className="space-y-2 pt-2 border-t border-slate-700/60">
                      <div className="font-bold text-slate-200 text-[11px]">
                        Cara Mulai Cepat
                      </div>
                      <div className="space-y-2">
                        {guide.steps.map((step, sIdx) => (
                          <div key={sIdx} className="flex items-start gap-2.5">
                            <span className="font-mono tabular-nums text-[11px] font-bold text-emerald-400 shrink-0">
                              0{sIdx + 1}.
                            </span>
                            <div>
                              <div className="font-bold text-white">{step.title}</div>
                              <div className="text-[11px] text-slate-300 leading-relaxed">
                                {step.desc}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* FAQ */}
                    {guide.faq.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-slate-700/60">
                        <div className="font-bold text-slate-200 text-[11px]">
                          Pertanyaan Umum
                        </div>
                        <div className="space-y-2">
                          {guide.faq.map((f, fIdx) => (
                            <div key={fIdx} className="space-y-0.5">
                              <div className="font-semibold text-amber-300">
                                {f.q}
                              </div>
                              <div className="text-[11px] text-slate-300 leading-relaxed">
                                {f.a}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Row */}
                    <div className="pt-2 border-t border-slate-700/60 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => ModuleOnboardingService.openGuide(guide.id)}
                        className="min-h-[40px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-extrabold text-[11px] flex items-center gap-1.5 transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Buka Kartu Panduan</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopy(guide.id, guide.name)}
                        className="min-h-[40px] px-3 rounded-xl bg-slate-900 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-[11px] flex items-center gap-1.5 transition"
                      >
                        {copiedId === guide.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedId === guide.id ? 'Tersalin' : 'Salin Info'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => ModuleOnboardingService.shareToWhatsApp(guide.id)}
                        className="min-h-[40px] px-3 rounded-xl bg-slate-900 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-[11px] flex items-center gap-1.5 transition"
                      >
                        <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Bagikan ke WA</span>
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Reset First-Visit Popups */}
      <div className="bg-slate-800/70 border border-slate-700 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-[11px] text-slate-300 leading-relaxed max-w-xs">
          Ingin melihat ulang kartu pengenalan 1x saat masuk tiap modul pada akun ini?
        </div>
        <button
          type="button"
          onClick={() => {
            ModuleOnboardingService.resetAllSeen();
            showNotification(
              'Pengenalan awal direset. Kartu panduan akan muncul 1x saat Anda membuka masing-masing modul.'
            );
          }}
          className="min-h-[40px] px-3 rounded-xl bg-slate-900 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-[11px] flex items-center gap-1.5 shrink-0 transition"
        >
          <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
          <span>Ulangi Pengenalan Awal</span>
        </button>
      </div>
    </div>
  );
};

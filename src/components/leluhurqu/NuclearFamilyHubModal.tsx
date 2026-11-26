import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  CheckCircle2,
  Heart,
  Link2,
  Plus,
  RefreshCw,
  Trash2,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';
import {
  canManageTrahAdmin,
  getEffectiveTrahRole,
  getLineageBadgeMeta,
  getTrahCoreLinkStatus,
  isSpouseLineageSide,
  NuclearChildItem,
  NuclearFamilyHubData,
  NuclearSpouseItem,
  TrahCategory,
} from '../../services/leluhurCoreSyncService';
import { PhotoCropGuideModal } from './PhotoCropGuideModal';

interface NuclearFamilyHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  hub: NuclearFamilyHubData;
  trahList: TrahCategory[];
  currentEmail?: string;
  isOwner?: boolean;
  preselectTarget?: { trahId: string; parentId: string | null } | null;
  onCompressPhoto: (file: File) => Promise<{ dataUrl: string; compressedSizeKb: number }>;
  onSaveAndSyncAll: (nextHub: NuclearFamilyHubData) => void;
  onGraftToSingleTrah: (
    nextHub: NuclearFamilyHubData,
    trahId: string,
    parentMemberId: string | null,
    attachMode: 'self_branch' | 'spouse_branch'
  ) => void;
  showNotification: (msg: string) => void;
}

function parseQuickChildrenInput(raw: string): Array<{ name: string; gender: 'L' | 'P' }> {
  if (!raw.trim()) return [];
  return raw
    .replace(/\s+(?:dan|serta|dg|dgn)\s+/gi, ', ')
    .replace(/[\r\n]+/g, ', ')
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      let name = entry.replace(/^(\d+[.):\-\s]+|[\-•*>\s]+)/, '').trim();
      let gender: 'L' | 'P' = 'L';
      if (/\((P|Pr|Perempuan|Wanita|Perp|Cewek|F)\)/i.test(name)) {
        gender = 'P';
        name = name.replace(/\((P|Pr|Perempuan|Wanita|Perp|Cewek|F)\)/i, '').trim();
      } else if (/\((L|Lk|Laki|Laki-laki|Pria|Cowok|M)\)/i.test(name)) {
        gender = 'L';
        name = name.replace(/\((L|Lk|Laki|Laki-laki|Pria|Cowok|M)\)/i, '').trim();
      }
      return { name, gender };
    })
    .filter((item) => item.name.length > 0);
}

export const NuclearFamilyHubModal: React.FC<NuclearFamilyHubModalProps> = ({
  isOpen,
  onClose,
  hub,
  trahList,
  currentEmail,
  isOwner = false,
  preselectTarget = null,
  onCompressPhoto,
  onSaveAndSyncAll,
  onGraftToSingleTrah,
  showNotification,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'sync'>('profile');
  const [draft, setDraft] = useState<NuclearFamilyHubData>(hub);
  const [quickChildrenText, setQuickChildrenText] = useState('');
  const selfPhotoInputRef = useRef<HTMLInputElement>(null);
  const hubEntityPhotoInputRef = useRef<HTMLInputElement>(null);
  const pendingHubPhotoKindRef = useRef<
    'self' | { spouseIndex: number; label: string } | { childIndex: number; label: string } | null
  >(null);
  const [hubCropTarget, setHubCropTarget] = useState<{
    file: File;
    kind: 'self' | { spouseIndex: number; label: string } | { childIndex: number; label: string };
  } | null>(null);

  // Per-Trah graft selection state
  const [parentSelections, setParentSelections] = useState<Record<string, string>>({});
  const [modeSelections, setModeSelections] = useState<
    Record<string, 'self_branch' | 'spouse_branch'>
  >({});

  useEffect(() => {
    if (!isOpen) return;
    setDraft({
      ...hub,
      self: { ...hub.self },
      spouses: hub.spouses.map((s) => ({ ...s })),
      children: hub.children.map((c) => ({ ...c })),
    });

    const nextParents: Record<string, string> = {};
    const nextModes: Record<string, 'self_branch' | 'spouse_branch'> = {};
    trahList.forEach((t) => {
      const status = getTrahCoreLinkStatus(t);
      const defaultMode: 'self_branch' | 'spouse_branch' =
        status.orientation || (isSpouseLineageSide(t.lineageSide) ? 'spouse_branch' : 'self_branch');
      nextModes[t.id] = defaultMode;
      if (preselectTarget && preselectTarget.trahId === t.id) {
        nextParents[t.id] = preselectTarget.parentId || '';
      } else if (status.anchorMember?.parentId) {
        nextParents[t.id] = status.anchorMember.parentId;
      } else {
        const root = t.members.find((m) => !m.parentId) || t.members[0];
        nextParents[t.id] = root?.id || '';
      }
    });
    setParentSelections(nextParents);
    setModeSelections(nextModes);

    if (preselectTarget) {
      setActiveTab('sync');
    } else if (hub.self.name.trim() && trahList.length > 0) {
      // tetap di tab profile kalau belum pernah buka, atau pengguna bisa langsung pindah tab
      setActiveTab('profile');
    } else {
      setActiveTab('profile');
    }
  }, [isOpen, hub, trahList, preselectTarget]);

  if (!isOpen) return null;

  const linkedTrahCount = trahList.filter((t) => getTrahCoreLinkStatus(t).linked).length;

  const handleSelfPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (selfPhotoInputRef.current) selfPhotoInputRef.current.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showNotification('Pilih file gambar (JPG, PNG, WebP)!');
      return;
    }
    setHubCropTarget({ file, kind: 'self' });
  };

  const triggerHubEntityPhotoUpload = (
    kind: { spouseIndex: number; label: string } | { childIndex: number; label: string }
  ) => {
    pendingHubPhotoKindRef.current = kind;
    hubEntityPhotoInputRef.current?.click();
  };

  const handleHubEntityPhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (hubEntityPhotoInputRef.current) hubEntityPhotoInputRef.current.value = '';
    const kind = pendingHubPhotoKindRef.current;
    pendingHubPhotoKindRef.current = null;
    if (!file || !kind) return;
    if (!file.type.startsWith('image/')) {
      showNotification('Pilih file gambar (JPG, PNG, WebP)!');
      return;
    }
    setHubCropTarget({ file, kind });
  };

  const handleAddSpouse = () => {
    const nextItem: NuclearSpouseItem = {
      id: `sp_${Date.now()}_${draft.spouses.length + 1}`,
      name: '',
      status: 'menikah',
    };
    setDraft((prev) => ({ ...prev, spouses: [...prev.spouses, nextItem] }));
  };

  const handleAddQuickChildren = () => {
    const parsed = parseQuickChildrenInput(quickChildrenText);
    if (parsed.length === 0) {
      showNotification('Ketik nama anak dipisahkan koma, contoh: Budi (L), Siti (P)');
      return;
    }
    const baseIdx = draft.children.length;
    const added: NuclearChildItem[] = parsed.map((p, idx) => ({
      id: `ch_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
      name: p.name,
      gender: p.gender,
      orderIndex: baseIdx + idx + 1,
    }));
    setDraft((prev) => ({
      ...prev,
      children: [...prev.children, ...added],
    }));
    setQuickChildrenText('');
    showNotification(`${added.length} anak ditambahkan ke Hub Keluarga Inti.`);
  };

  const handleAddSingleChild = () => {
    const nextChild: NuclearChildItem = {
      id: `ch_${Date.now()}_${draft.children.length + 1}`,
      name: '',
      gender: 'L',
      orderIndex: draft.children.length + 1,
    };
    setDraft((prev) => ({ ...prev, children: [...prev.children, nextChild] }));
  };

  const buildSanitizedDraft = (): NuclearFamilyHubData | null => {
    if (!draft.self.name.trim()) {
      showNotification('Nama lengkap Anda di Data Keluarga Inti harus diisi!');
      setActiveTab('profile');
      return null;
    }
    return {
      updatedAt: new Date().toISOString(),
      self: {
        ...draft.self,
        name: draft.self.name.trim(),
        callName: draft.self.callName?.trim() || '',
        birthYear: draft.self.birthYear?.trim() || '',
        city: draft.self.city?.trim() || '',
      },
      spouses: draft.spouses
        .filter((s) => s.name.trim().length > 0)
        .map((s) => ({ ...s, name: s.name.trim() })),
      children: draft.children
        .filter((c) => c.name.trim().length > 0)
        .map((c, idx) => ({
          ...c,
          name: c.name.trim(),
          orderIndex: idx + 1,
        })),
    };
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-4 sm:p-5 space-y-3.5 shadow-2xl border border-stone-200 relative text-stone-800 max-h-[92vh] flex flex-col">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-stone-700 bg-stone-100 transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3 pr-8 shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-extrabold text-sm sm:text-base text-stone-900">
              Hub Keluarga Inti Terpusat (Isi 1× untuk Semua Trah)
            </h3>
            <p className="text-[11px] text-stone-500 leading-snug">
              Isi data Anda, pasangan &amp; anak-anak cukup sekali di sini, lalu tempel dan sinkronkan ke 4–8+ Trah (Ayah, Ibu, Kakek/Nenek, maupun Trah Besan).
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-stone-100 rounded-2xl border border-stone-200 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'profile'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>1. Data Keluarga Inti</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sync')}
            className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'sync'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>2. Tempel ke Trah ({linkedTrahCount}/{trahList.length})</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-0.5">
          {activeTab === 'profile' ? (
            <>
              {/* Seksi A: Profil Saya */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-emerald-900 uppercase tracking-wide flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-700" />
                    <span>A. Data Diri Anda</span>
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                    Otomatis Terklaim
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="relative shrink-0">
                    {draft.self.photoUrl ? (
                      <img
                        src={draft.self.photoUrl}
                        alt={draft.self.name || 'Saya'}
                        className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500 shadow-xs"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-white text-emerald-700 font-black text-lg flex items-center justify-center border-2 border-dashed border-emerald-300">
                        {(draft.self.name || 'SY').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <input
                      ref={selfPhotoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleSelfPhotoUpload}
                      className="hidden"
                    />
                    <input
                      ref={hubEntityPhotoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleHubEntityPhotoFile}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => selfPhotoInputRef.current?.click()}
                      className="absolute -bottom-1.5 -right-1.5 p-1.5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white shadow transition"
                      title="Unggah / Ganti Foto"
                    >
                      <Camera className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-stone-600 block mb-0.5">
                        Nama Lengkap Anda *
                      </label>
                      <input
                        type="text"
                        value={draft.self.name}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            self: { ...prev.self, name: e.target.value },
                          }))
                        }
                        placeholder="Contoh: Agus Santoso"
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded-xl font-bold outline-hidden focus:border-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-stone-600 block mb-0.5">
                        Nama Panggilan
                      </label>
                      <input
                        type="text"
                        value={draft.self.callName || ''}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            self: { ...prev.self, callName: e.target.value },
                          }))
                        }
                        placeholder="Contoh: Mas Agus"
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded-xl outline-hidden focus:border-emerald-600"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-stone-600 block mb-0.5">Gender</label>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({ ...prev, self: { ...prev.self, gender: 'L' } }))
                        }
                        className={`py-1.5 rounded-xl text-[11px] font-bold border ${
                          draft.self.gender === 'L'
                            ? 'bg-sky-600 text-white border-sky-600'
                            : 'bg-white text-stone-600 border-stone-200'
                        }`}
                      >
                        L
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({ ...prev, self: { ...prev.self, gender: 'P' } }))
                        }
                        className={`py-1.5 rounded-xl text-[11px] font-bold border ${
                          draft.self.gender === 'P'
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-white text-stone-600 border-stone-200'
                        }`}
                      >
                        P
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-stone-600 block mb-0.5">Thn Lahir</label>
                    <input
                      type="text"
                      value={draft.self.birthYear || ''}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          self: { ...prev.self, birthYear: e.target.value },
                        }))
                      }
                      placeholder="1985"
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded-xl outline-hidden focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-stone-600 block mb-0.5">Domisili</label>
                    <input
                      type="text"
                      value={draft.self.city || ''}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          self: { ...prev.self, city: e.target.value },
                        }))
                      }
                      placeholder="Kota asal"
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded-xl outline-hidden focus:border-emerald-600"
                    />
                  </div>
                </div>
              </div>

              {/* Seksi B: Data Pasangan */}
              <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-black text-rose-900 uppercase tracking-wide flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5 text-rose-600" />
                    <span>B. Pasangan (Suami / Istri)</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleAddSpouse}
                    className="px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-extrabold flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Tambah Pasangan</span>
                  </button>
                </div>

                {draft.spouses.length === 0 ? (
                  <p className="text-[11px] text-stone-500 italic">
                    Belum ada pasangan ditambahkan. Klik Tambah Pasangan bila sudah berkeluarga.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {draft.spouses.map((sp, sIdx) => (
                      <div
                        key={sp.id}
                        className="p-2.5 rounded-xl bg-white border border-rose-200 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                      >
                        <div className="sm:col-span-5 flex items-center gap-2 min-w-0">
                          <div className="relative shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                triggerHubEntityPhotoUpload({
                                  spouseIndex: sIdx,
                                  label: sp.name.trim() || `Pasangan ke-${sIdx + 1}`,
                                })
                              }
                              title="Unggah / Ganti Foto Pasangan"
                              className="w-9 h-9 rounded-xl overflow-hidden border border-rose-300 bg-rose-50 hover:bg-rose-100 flex items-center justify-center transition relative group"
                            >
                              {sp.photoUrl ? (
                                <img
                                  src={sp.photoUrl}
                                  alt={sp.name || `Pasangan ${sIdx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Heart className="w-3.5 h-3.5 text-rose-400" />
                              )}
                              <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center shadow">
                                <Camera className="w-2.5 h-2.5" />
                              </span>
                            </button>
                            {sp.photoUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    spouses: prev.spouses.map((item, idx) =>
                                      idx === sIdx ? { ...item, photoUrl: undefined } : item
                                    ),
                                  }))
                                }
                                title="Hapus foto pasangan"
                                className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-stone-700 hover:bg-rose-700 text-white text-[9px] font-bold flex items-center justify-center shadow"
                              >
                                ×
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            value={sp.name}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                spouses: prev.spouses.map((item, idx) =>
                                  idx === sIdx ? { ...item, name: e.target.value } : item
                                ),
                              }))
                            }
                            placeholder={`Nama Pasangan ke-${sIdx + 1}`}
                            className="flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg font-bold outline-hidden focus:border-rose-500"
                          />
                        </div>
                        <input
                          type="text"
                          value={sp.city || ''}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              spouses: prev.spouses.map((item, idx) =>
                                idx === sIdx ? { ...item, city: e.target.value } : item
                              ),
                            }))
                          }
                          placeholder="Kota asal"
                          className="sm:col-span-3 px-2 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg outline-hidden"
                        />
                        <select
                          value={sp.status}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              spouses: prev.spouses.map((item, idx) =>
                                idx === sIdx
                                  ? {
                                      ...item,
                                      status: e.target.value as 'menikah' | 'cerai_hidup' | 'cerai_mati',
                                    }
                                  : item
                              ),
                            }))
                          }
                          className="sm:col-span-3 px-2 py-1.5 text-[11px] bg-stone-50 border border-stone-200 rounded-lg font-semibold outline-hidden"
                        >
                          <option value="menikah">Menikah</option>
                          <option value="cerai_hidup">Cerai Hidup</option>
                          <option value="cerai_mati">Cerai Mati</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((prev) => ({
                              ...prev,
                              spouses: prev.spouses.filter((_, idx) => idx !== sIdx),
                            }))
                          }
                          className="sm:col-span-1 p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 justify-self-end"
                          title="Hapus pasangan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Seksi C: Data Anak / Keturunan */}
              <div className="p-3.5 rounded-2xl bg-sky-50/60 border border-sky-200 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-black text-sky-900 uppercase tracking-wide flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-sky-700" />
                    <span>C. Anak / Keturunan ({draft.children.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleAddSingleChild}
                    className="px-2.5 py-1 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-[10px] font-extrabold flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ 1 Anak</span>
                  </button>
                </div>

                {/* Input Cepat Koma */}
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={quickChildrenText}
                    onChange={(e) => setQuickChildrenText(e.target.value)}
                    placeholder="Tambah cepat pisah koma: Ahmad (L), Siti (P), Budi..."
                    className="flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-white border border-sky-200 rounded-xl outline-hidden focus:border-sky-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddQuickChildren}
                    className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-stone-950 font-extrabold text-[11px] flex items-center gap-1 shrink-0"
                  >
                    <Zap className="w-3 h-3 fill-stone-950" />
                    <span>Tambah</span>
                  </button>
                </div>

                {draft.children.length === 0 ? (
                  <p className="text-[11px] text-stone-500 italic">
                    Belum ada anak tercatat.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {draft.children.map((ch, idx) => (
                      <div
                        key={ch.id}
                        className="p-2 rounded-xl bg-white border border-sky-200 flex flex-wrap items-center gap-1.5"
                      >
                        <span className="text-[10px] font-mono font-black text-stone-400 w-5 text-center">
                          {idx + 1}.
                        </span>
                        <div className="relative shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              triggerHubEntityPhotoUpload({
                                childIndex: idx,
                                label: ch.name.trim() || `Anak ke-${idx + 1}`,
                              })
                            }
                            title="Unggah / Ganti Foto Anak"
                            className="w-8 h-8 rounded-lg overflow-hidden border border-sky-300 bg-sky-50 hover:bg-sky-100 flex items-center justify-center transition relative"
                          >
                            {ch.photoUrl ? (
                              <img
                                src={ch.photoUrl}
                                alt={ch.name || `Anak ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-[10px] font-black text-sky-700">
                                {(ch.name.trim() || `A${idx + 1}`).slice(0, 2).toUpperCase()}
                              </span>
                            )}
                            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-sky-700 text-white flex items-center justify-center shadow">
                              <Camera className="w-2 h-2" />
                            </span>
                          </button>
                          {ch.photoUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                setDraft((prev) => ({
                                  ...prev,
                                  children: prev.children.map((item, cIdx) =>
                                    cIdx === idx ? { ...item, photoUrl: undefined } : item
                                  ),
                                }))
                              }
                              title="Hapus foto anak"
                              className="absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full bg-stone-700 hover:bg-rose-700 text-white text-[8px] font-bold flex items-center justify-center shadow"
                            >
                              ×
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={ch.name}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              children: prev.children.map((item, cIdx) =>
                                cIdx === idx ? { ...item, name: e.target.value } : item
                              ),
                            }))
                          }
                          placeholder={`Nama Anak ke-${idx + 1}`}
                          className="flex-1 min-w-[120px] px-2 py-1 text-xs bg-stone-50 border border-stone-200 rounded-lg font-bold outline-hidden focus:border-sky-500"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((prev) => ({
                              ...prev,
                              children: prev.children.map((item, cIdx) =>
                                cIdx === idx
                                  ? { ...item, gender: item.gender === 'P' ? 'L' : 'P' }
                                  : item
                              ),
                            }))
                          }
                          className={`px-2 py-1 rounded-lg text-[10px] font-extrabold border ${
                            ch.gender === 'P'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-sky-50 text-sky-700 border-sky-200'
                          }`}
                        >
                          {ch.gender === 'P' ? '👩 P' : '👨 L'}
                        </button>
                        <input
                          type="text"
                          value={ch.birthYear || ''}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              children: prev.children.map((item, cIdx) =>
                                cIdx === idx ? { ...item, birthYear: e.target.value } : item
                              ),
                            }))
                          }
                          placeholder="Thn"
                          className="w-16 px-2 py-1 text-[11px] bg-stone-50 border border-stone-200 rounded-lg outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((prev) => ({
                              ...prev,
                              children: prev.children
                                .filter((_, cIdx) => cIdx !== idx)
                                .map((item, newIdx) => ({ ...item, orderIndex: newIdx + 1 })),
                            }))
                          }
                          className="p-1 rounded-lg text-rose-600 hover:bg-rose-50"
                          title="Hapus anak"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-[11px] text-amber-950 leading-relaxed">
                Pilih <strong>Orang Tua / Induk</strong> tempat menempelkan keluarga inti Anda di masing-masing Trah, lalu klik <strong>Tempel ke Trah Ini</strong>. Setelah tertempel, setiap kali Anda mengubah data di Hub (atau di salah satu Trah), semua Trah tertaut otomatis ikut diperbarui!
              </div>

              {trahList.length === 0 ? (
                <div className="p-6 rounded-2xl bg-stone-50 border border-dashed border-stone-300 text-center text-xs text-stone-500">
                  Belum ada Trah di akun ini. Buat Trah baru atau gabung via undangan terlebih dahulu.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {trahList.map((t) => {
                    const meta = getLineageBadgeMeta(t.lineageSide);
                    const status = getTrahCoreLinkStatus(t);
                    const role = getEffectiveTrahRole(t, currentEmail, isOwner);
                    const isViewer = role === 'viewer';
                    const isAdmin = canManageTrahAdmin(t, currentEmail, isOwner);
                    const attachMode = modeSelections[t.id] || 'self_branch';
                    const selectedParent = parentSelections[t.id] ?? '';
                    const isPreselected = preselectTarget?.trahId === t.id;

                    return (
                      <div
                        key={t.id}
                        className={`p-3 rounded-2xl border space-y-2.5 transition ${
                          isPreselected
                            ? 'bg-amber-50/70 border-amber-400 ring-1 ring-amber-300'
                            : status.linked
                            ? 'bg-emerald-50/50 border-emerald-300'
                            : 'bg-white border-stone-200'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{meta.icon}</span>
                              <span className="font-black text-xs text-stone-900 truncate">
                                {t.name}
                              </span>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${meta.lightBadgeClass}`}
                              >
                                {meta.shortTag}
                              </span>
                              {status.linked && (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-emerald-700 text-white inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  <span>Tersinkron</span>
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-stone-500 mt-0.5">
                              {status.linked && status.anchorMember
                                ? `Terhubung sebagai "${status.anchorMember.name}" (${
                                    status.orientation === 'spouse_branch'
                                      ? 'Jalur Pasangan'
                                      : 'Jalur Saya'
                                  }) + ${status.childrenSyncedCount} keturunan`
                                : `${t.members.length} anggota tercatat • Belum tertaut ke Hub`}
                            </p>
                          </div>

                          {!isAdmin && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200">
                              {isViewer ? 'Lihat Saja' : 'Anggota'}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                          <div className="sm:col-span-5">
                            <label className="text-[9px] font-bold text-stone-500 block mb-0.5">
                              Tempel Sebagai Anak Dari:
                            </label>
                            <select
                              disabled={isViewer}
                              value={selectedParent}
                              onChange={(e) =>
                                setParentSelections((prev) => ({
                                  ...prev,
                                  [t.id]: e.target.value,
                                }))
                              }
                              className="w-full px-2 py-1.5 text-[11px] bg-white border border-stone-300 rounded-xl font-semibold outline-hidden disabled:opacity-50"
                            >
                              <option value="">👑 Root / Leluhur Mandiri</option>
                              {t.members
                                .filter((m) => !m.coreRefId?.startsWith('core_ch_'))
                                .map((m) => (
                                  <option key={m.id} value={m.id}>
                                    ↳ {m.name} (Gen {m.generationLevel})
                                  </option>
                                ))}
                            </select>
                          </div>

                          <div className="sm:col-span-4">
                            <label className="text-[9px] font-bold text-stone-500 block mb-0.5">
                              Arah Jalur di Trah Ini:
                            </label>
                            <select
                              disabled={isViewer}
                              value={attachMode}
                              onChange={(e) =>
                                setModeSelections((prev) => ({
                                  ...prev,
                                  [t.id]: e.target.value as 'self_branch' | 'spouse_branch',
                                }))
                              }
                              className="w-full px-2 py-1.5 text-[11px] bg-white border border-stone-300 rounded-xl font-semibold outline-hidden disabled:opacity-50"
                            >
                              <option value="self_branch">👨 Jalur Saya (Anak Saya)</option>
                              <option value="spouse_branch">💍 Jalur Pasangan (Besan)</option>
                            </select>
                          </div>

                          <div className="sm:col-span-3 pt-3 sm:pt-3.5">
                            <button
                              type="button"
                              disabled={isViewer}
                              onClick={() => {
                                const clean = buildSanitizedDraft();
                                if (!clean) return;
                                onGraftToSingleTrah(
                                  clean,
                                  t.id,
                                  selectedParent || null,
                                  attachMode
                                );
                              }}
                              className="w-full py-1.5 px-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white font-extrabold text-[11px] flex items-center justify-center gap-1 transition active:scale-95"
                            >
                              <Link2 className="w-3 h-3" />
                              <span>{status.linked ? 'Perbarui' : 'Tempel'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-stone-200 shrink-0">
          {activeTab === 'profile' ? (
            <button
              type="button"
              onClick={() => setActiveTab('sync')}
              className="py-2 px-3.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-extrabold text-xs flex items-center gap-1.5 transition"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Pilih Trah Tujuan ({linkedTrahCount})</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className="py-2 px-3.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs transition"
            >
              ← Edit Biodata Inti
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-3.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs transition"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={() => {
                const clean = buildSanitizedDraft();
                if (!clean) return;
                onSaveAndSyncAll(clean);
                onClose();
              }}
              className="py-2 px-4 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white font-extrabold text-xs shadow-md flex items-center gap-1.5 transition active:scale-95"
            >
              {linkedTrahCount > 0 ? <RefreshCw className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
              <span>
                {linkedTrahCount > 0
                  ? `Simpan & Sinkronkan ${linkedTrahCount} Trah`
                  : 'Simpan Keluarga Inti'}
              </span>
            </button>
          </div>
        </div>
      </div>

      <PhotoCropGuideModal
        isOpen={Boolean(hubCropTarget)}
        file={hubCropTarget?.file || null}
        title={
          hubCropTarget?.kind === 'self'
            ? `Atur Foto Diri${draft.self.name.trim() ? ` — ${draft.self.name.trim()}` : ''}`
            : hubCropTarget && 'spouseIndex' in hubCropTarget.kind
            ? `Atur Foto Pasangan — ${hubCropTarget.kind.label}`
            : hubCropTarget && 'childIndex' in hubCropTarget.kind
            ? `Atur Foto Anak — ${hubCropTarget.kind.label}`
            : 'Atur Tata Letak & Potong Foto'
        }
        onCancel={() => setHubCropTarget(null)}
        onConfirm={(croppedDataUrl, sizeInfo) => {
          if (hubCropTarget?.kind === 'self') {
            setDraft((prev) => ({
              ...prev,
              self: { ...prev.self, photoUrl: croppedDataUrl },
            }));
            showNotification(
              `Foto profil Keluarga Inti tersimpan (${sizeInfo.orig} KB ➔ ${sizeInfo.comp} KB) ⚡`
            );
          } else if (hubCropTarget && 'spouseIndex' in hubCropTarget.kind) {
            const idx = hubCropTarget.kind.spouseIndex;
            setDraft((prev) => ({
              ...prev,
              spouses: prev.spouses.map((sp, sIdx) =>
                sIdx === idx ? { ...sp, photoUrl: croppedDataUrl } : sp
              ),
            }));
            showNotification(
              `Foto pasangan tersimpan (${sizeInfo.orig} KB ➔ ${sizeInfo.comp} KB) ⚡`
            );
          } else if (hubCropTarget && 'childIndex' in hubCropTarget.kind) {
            const idx = hubCropTarget.kind.childIndex;
            setDraft((prev) => ({
              ...prev,
              children: prev.children.map((ch, cIdx) =>
                cIdx === idx ? { ...ch, photoUrl: croppedDataUrl } : ch
              ),
            }));
            showNotification(
              `Foto anak tersimpan (${sizeInfo.orig} KB ➔ ${sizeInfo.comp} KB) ⚡`
            );
          }
          setHubCropTarget(null);
        }}
      />
    </div>
  );
};

import { AuthService } from './authService';

export type SiagaCircleType = 'pribadi_hp' | 'keluarga' | 'perusahaan';

export interface InvitedCircleMember {
  id: string;
  circleType: SiagaCircleType;
  circleName: string;
  name: string;
  email: string;
  phone: string;
  status: 'invited' | 'active';
  inviteCode: string;
  invitedAt: string;
}

export interface PrivateSiagaCircle {
  id: string;
  type: SiagaCircleType;
  name: string;
  description: string;
  inviteCode: string;
  requiresRtActivation: false;
}

const CIRCLES_STORAGE_KEY = 'wargaqu_siaga_circles_v1';
const CIRCLE_MEMBERS_KEY = 'wargaqu_siaga_circle_members_v1';
export const SIAGA_CIRCLE_SYNC_EVENT = 'wargaqu-siaga-circle-sync';

function emitCircleSync() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SIAGA_CIRCLE_SYNC_EVENT));
  }
}

const DEFAULT_CIRCLES: PrivateSiagaCircle[] = [
  {
    id: 'circle-pribadi',
    type: 'pribadi_hp',
    name: 'Pribadi (Cari HP Hilang)',
    description: 'Lacak & bunyikan perangkat pribadi Anda yang terikat dengan Email & No HP.',
    inviteCode: 'HP-PRIBADI',
    requiresRtActivation: false,
  },
  {
    id: 'circle-keluarga',
    type: 'keluarga',
    name: 'Komunitas Keluarga',
    description: 'Darurat internal keluarga; hanya akun keluarga yang di-invite yang menerima alarm.',
    inviteCode: 'FAM-2026',
    requiresRtActivation: false,
  },
  {
    id: 'circle-perusahaan',
    type: 'perusahaan',
    name: 'Komunitas Perusahaan / Tim',
    description: 'Jaringan darurat tim kantor/proyek; sinyal khusus akun rekan yang di-invite.',
    inviteCode: 'CORP-2026',
    requiresRtActivation: false,
  },
];

export const SiagaCircleService = {
  getCircles(): PrivateSiagaCircle[] {
    try {
      const raw = localStorage.getItem(CIRCLES_STORAGE_KEY);
      if (raw) return JSON.parse(raw) as PrivateSiagaCircle[];
    } catch {
      // fallback
    }
    return DEFAULT_CIRCLES;
  },

  getInvitedMembers(): InvitedCircleMember[] {
    try {
      const raw = localStorage.getItem(CIRCLE_MEMBERS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return (parsed as InvitedCircleMember[]).filter(
            (m) =>
              m?.email !== 'keluarga.inti@gmail.com' &&
              m?.email !== 'hrd.siaga@perusahaan.id'
          );
        }
      }
    } catch {
      // fallback
    }
    return [];
  },

  saveInvitedMembers(members: InvitedCircleMember[]) {
    try {
      localStorage.setItem(CIRCLE_MEMBERS_KEY, JSON.stringify(members));
      emitCircleSync();
    } catch {
      // ignore
    }
  },

  inviteMember(params: {
    circleType: SiagaCircleType;
    name: string;
    email: string;
    phone: string;
  }): InvitedCircleMember {
    const circle = this.getCircles().find(c => c.type === params.circleType) || DEFAULT_CIRCLES[1];
    const code = `${circle.inviteCode}-${Math.floor(100 + Math.random() * 900)}`;
    const next: InvitedCircleMember = {
      id: `cm-${Date.now()}`,
      circleType: params.circleType,
      circleName: circle.name,
      name: params.name.trim() || params.email.split('@')[0] || 'Anggota',
      email: params.email.trim().toLowerCase(),
      phone: params.phone.trim(),
      status: 'invited',
      inviteCode: code,
      invitedAt: new Date().toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
      }),
    };
    const updated = [next, ...this.getInvitedMembers()];
    this.saveInvitedMembers(updated);
    return next;
  },

  acceptCircleInvite(codeInput: string): { ok: boolean; message: string } {
    const cleanCode = codeInput.trim().toUpperCase();
    if (!cleanCode) {
      return { ok: false, message: 'Masukkan kode undangan komunitas.' };
    }
    const account = AuthService.getAccount();
    if (!account) {
      return { ok: false, message: 'Harap login Email & No HP terlebih dahulu.' };
    }

    const members = this.getInvitedMembers();
    const matched = members.find(m => m.inviteCode.toUpperCase() === cleanCode);
    if (matched) {
      const updated = members.map(m =>
        m.id === matched.id
          ? { ...m, status: 'active' as const, email: account.email, phone: account.phone }
          : m
      );
      this.saveInvitedMembers(updated);
      return { ok: true, message: `Berhasil bergabung ke ${matched.circleName}!` };
    }

    const circleMatch = this.getCircles().find(c => c.inviteCode.toUpperCase() === cleanCode);
    if (circleMatch) {
      const joined: InvitedCircleMember = {
        id: `cm-${Date.now()}`,
        circleType: circleMatch.type,
        circleName: circleMatch.name,
        name: AuthService.getDisplayName(account),
        email: account.email,
        phone: account.phone,
        status: 'active',
        inviteCode: cleanCode,
        invitedAt: 'Hari ini',
      };
      this.saveInvitedMembers([joined, ...members]);
      return { ok: true, message: `Akun terhubung ke ${circleMatch.name}!` };
    }

    return { ok: false, message: 'Kode undangan komunitas tidak ditemukan.' };
  },

  removeMember(id: string) {
    this.saveInvitedMembers(this.getInvitedMembers().filter(m => m.id !== id));
  },
};

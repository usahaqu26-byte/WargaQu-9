import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  auth,
  db,
  getCachedDriveAccessToken,
  googleProvider,
  handleFirestoreError,
  OperationType,
  setCachedDriveAccessToken,
} from './firebaseClient';
import { AuthService } from './authService';
import {
  AccountGovernanceService,
  type AccountModerationStatus,
  type AccountPolicyRule,
  type AccountPresenceRecord,
  type CommunityFreeRule,
  type GovernanceModuleId,
} from './accountGovernanceService';
import {
  MonetizationService,
  type ModuleMonetizationRule,
  type MonetizableModuleId,
} from './monetizationService';
import { ZeroTrustService } from './zeroTrustService';

export const FIREBASE_AUTH_SYNC_EVENT = 'wargaqu-firebase-auth-sync';

function emitFirebaseAuthSync() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FIREBASE_AUTH_SYNC_EVENT));
  }
}

export function toPolicyDocId(emailOrKey: string): string {
  const clean = emailOrKey.trim().toLowerCase();
  const bytes = new TextEncoder().encode(clean);
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `em_${hex}`.slice(0, 120);
}

function toIsoStringSafe(ts: unknown): string {
  if (ts && typeof ts === 'object' && 'toDate' in ts && typeof (ts as Timestamp).toDate === 'function') {
    return (ts as Timestamp).toDate().toISOString();
  }
  if (typeof ts === 'string' && ts) return ts;
  return new Date().toISOString();
}

function sanitizeStringList(items: string[], maxItems: number, maxLen: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const clean = String(item || '').trim().slice(0, maxLen);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= maxItems) break;
  }
  return out;
}

let currentFirebaseUser: User | null = null;
let authReady = false;
let initialized = false;
let lastSyncedSignature = '';
let lastSyncedAtMs = 0;

let unsubMyPolicy: Unsubscribe | null = null;
let unsubGovConfig: Unsubscribe | null = null;
let unsubMonConfig: Unsubscribe | null = null;

function stopAuthenticatedListeners() {
  if (unsubMyPolicy) {
    unsubMyPolicy();
    unsubMyPolicy = null;
  }
  if (unsubGovConfig) {
    unsubGovConfig();
    unsubGovConfig = null;
  }
  if (unsubMonConfig) {
    unsubMonConfig();
    unsubMonConfig = null;
  }
}

function startAuthenticatedListeners(user: User) {
  stopAuthenticatedListeners();
  const email = (user.email || '').trim().toLowerCase();

  // 1. Own account policy listener (PII-isolated query scoped to verified email)
  if (email && user.emailVerified) {
    const policiesPath = 'accountPolicies';
    const q = query(collection(db, policiesPath), where('targetEmail', '==', email));
    unsubMyPolicy = onSnapshot(
      q,
      snapshot => {
        const mapped: Record<string, AccountPolicyRule> = {};
        snapshot.forEach(docSnap => {
          const d = docSnap.data();
          if (d && typeof d.targetEmail === 'string') {
            const key = d.targetEmail.trim().toLowerCase();
            mapped[key] = {
              key,
              email: key,
              phone: typeof d.phone === 'string' ? d.phone : undefined,
              status: (d.status as AccountModerationStatus) || 'normal',
              freeModules: d.allModulesFree
                ? 'all'
                : Array.isArray(d.freeModules)
                ? (d.freeModules as MonetizableModuleId[])
                : 'all',
              note: typeof d.note === 'string' ? d.note : undefined,
              updatedAt: toIsoStringSafe(d.updatedAt),
            };
          }
        });
        AccountGovernanceService.applyCloudSelfPolicies(email, mapped);
      },
      error => {
        try {
          handleFirestoreError(error, OperationType.LIST, policiesPath);
        } catch {
          // already logged by handleFirestoreError
        }
      }
    );
  }

  // 2. Shared non-PII governance config (/appConfig/governance)
  const govPath = 'appConfig/governance';
  unsubGovConfig = onSnapshot(
    doc(db, 'appConfig', 'governance'),
    snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      if (Array.isArray(d?.communityFreeRules)) {
        AccountGovernanceService.applyCloudCommunityRules(
          d.communityFreeRules as CommunityFreeRule[],
          toIsoStringSafe(d.updatedAt)
        );
      }
    },
    error => {
      try {
        handleFirestoreError(error, OperationType.GET, govPath);
      } catch {
        // already logged
      }
    }
  );

  // 3. Shared non-PII monetization config (/appConfig/monetization)
  const monPath = 'appConfig/monetization';
  unsubMonConfig = onSnapshot(
    doc(db, 'appConfig', 'monetization'),
    snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      if (Array.isArray(d?.rules)) {
        MonetizationService.applyRemoteRules(d.rules as ModuleMonetizationRule[]);
      }
    },
    error => {
      try {
        handleFirestoreError(error, OperationType.GET, monPath);
      } catch {
        // already logged
      }
    }
  );
}

export const FirebaseSyncService = {
  init(): void {
    if (initialized || typeof window === 'undefined') return;
    initialized = true;

    AccountGovernanceService.registerCloudHooks({
      onSaveGovernanceConfig: rules => this.saveGovernanceConfigToCloud(rules),
      onSaveAccountPolicy: params => this.saveAccountPolicyToCloud(params),
      onSyncPresence: screen => this.syncMyAccountRegistry(screen),
    });
    MonetizationService.registerCloudSaveHook(rules => this.saveMonetizationConfigToCloud(rules));

    onAuthStateChanged(auth, user => {
      authReady = true;
      currentFirebaseUser = user;

      if (user && user.email) {
        const cleanEmail = user.email.trim().toLowerCase();
        const existingLocal = AuthService.getAccount();
        const binding = AuthService.getDeviceBinding();
        const isLockedToOther =
          Boolean(binding?.boundEmail) && binding!.boundEmail.toLowerCase() !== cleanEmail;
        if (!isLockedToOther) {
          if (!existingLocal || existingLocal.email.toLowerCase() !== cleanEmail) {
            AuthService.login(
              cleanEmail,
              existingLocal?.phone || binding?.boundPhone || '0800-0000-0000'
            );
          }
          AuthService.markGoogleVerified(Boolean(user.emailVerified));
        }
        startAuthenticatedListeners(user);
        void this.syncMyAccountRegistry();
      } else {
        setCachedDriveAccessToken(null);
        stopAuthenticatedListeners();
      }

      emitFirebaseAuthSync();
    });
  },

  isAuthReady(): boolean {
    return authReady;
  },

  getCurrentUser(): User | null {
    return currentFirebaseUser || auth.currentUser;
  },

  isCloudSignedIn(): boolean {
    const u = this.getCurrentUser();
    return Boolean(u && u.email && u.emailVerified);
  },

  isCloudAdmin(): boolean {
    const u = this.getCurrentUser();
    return Boolean(u && u.email && u.emailVerified && ZeroTrustService.isAdminEmail(u.email));
  },

  hasDriveAccessToken(): boolean {
    return Boolean(getCachedDriveAccessToken());
  },

  getDriveAccessToken(): string | null {
    return getCachedDriveAccessToken();
  },

  async signInWithGoogle(phoneHint?: string): Promise<User> {
    const cred = await signInWithPopup(auth, googleProvider);
    const oauthCred = GoogleAuthProvider.credentialFromResult(cred);
    if (oauthCred?.accessToken) {
      setCachedDriveAccessToken(oauthCred.accessToken);
    }
    const user = cred.user;
    if (user.email) {
      const cleanEmail = user.email.trim().toLowerCase();
      const binding = AuthService.getDeviceBinding();
      if (binding?.boundEmail && binding.boundEmail.toLowerCase() !== cleanEmail) {
        setCachedDriveAccessToken(null);
        stopAuthenticatedListeners();
        await signOut(auth);
        throw new Error(
          `Perangkat ini sudah terikat ke ${AuthService.maskEmail(binding.boundEmail)}. Lepas ikatan perangkat terlebih dahulu sebelum menghubungkan Google akun lain.`
        );
      }

      const existing = AuthService.getAccount();
      const chosenPhone =
        (binding?.boundPhone && binding.boundPhone !== '0800-0000-0000' ? binding.boundPhone : '') ||
        (phoneHint && phoneHint.trim()) ||
        (existing?.phone && existing.phone !== '0800-0000-0000' ? existing.phone : '') ||
        '0800-0000-0000';
      AuthService.login(user.email, chosenPhone);
      AuthService.markGoogleVerified(Boolean(user.emailVerified));
    }
    await this.syncMyAccountRegistry(undefined, true);
    emitFirebaseAuthSync();
    return user;
  },

  async requestDriveAccess(phoneHint?: string): Promise<string> {
    const existingToken = getCachedDriveAccessToken();
    if (existingToken) return existingToken;
    await this.signInWithGoogle(phoneHint);
    const freshToken = getCachedDriveAccessToken();
    if (!freshToken) {
      throw new Error('Izin akses Google Drive tidak diberikan oleh pengguna.');
    }
    return freshToken;
  },

  async signOutCloud(): Promise<void> {
    setCachedDriveAccessToken(null);
    stopAuthenticatedListeners();
    await signOut(auth);
  },

  async syncMyAccountRegistry(activeScreen?: string, force = false): Promise<void> {
    const user = this.getCurrentUser();
    if (!user || !user.email || !user.emailVerified) return;

    const presence = AccountGovernanceService.collectCurrentUserPresence(activeScreen || 'warga');
    const cleanEmail = user.email.trim().toLowerCase().slice(0, 160);
    const displayName = (user.displayName || presence.displayName || cleanEmail.split('@')[0] || 'Warga')
      .trim()
      .slice(0, 80);
    const phone = (presence.phone || '-').trim().slice(0, 32) || '-';
    const deviceMask = (presence.deviceMask || 'DEV-0000').trim().slice(0, 48);
    const activeModules = sanitizeStringList(presence.activeModules, 8, 32);
    const trahNames = sanitizeStringList(
      presence.trahList.map(t => t.name),
      15,
      80
    );
    const communityNames = sanitizeStringList(
      presence.communityList.map(c => c.name),
      15,
      80
    );
    const screen = (activeScreen || presence.activeScreen || 'warga').trim().slice(0, 40) || 'warga';

    const sig = JSON.stringify([
      user.uid,
      cleanEmail,
      displayName,
      phone,
      deviceMask,
      activeModules,
      trahNames,
      communityNames,
      screen,
    ]);

    const now = Date.now();
    // Lightweight throttle: avoid excessive Firestore writes unless metadata changed or 5 mins passed
    if (!force && sig === lastSyncedSignature && now - lastSyncedAtMs < 5 * 60 * 1000) {
      return;
    }

    const docPath = `accountRegistry/${user.uid}`;
    const docRef = doc(db, 'accountRegistry', user.uid);

    try {
      const existingSnap = await getDoc(docRef);
      if (existingSnap.exists()) {
        await updateDoc(docRef, {
          displayName,
          phone,
          deviceMask,
          activeModules,
          trahNames,
          communityNames,
          activeScreen: screen,
          lastSeenAt: serverTimestamp(),
        });
      } else {
        await setDoc(docRef, {
          uid: user.uid,
          email: cleanEmail,
          displayName,
          phone,
          deviceMask,
          activeModules,
          trahNames,
          communityNames,
          activeScreen: screen,
          createdAt: serverTimestamp(),
          lastSeenAt: serverTimestamp(),
        });
      }
      lastSyncedSignature = sig;
      lastSyncedAtMs = now;
    } catch (error) {
      handleFirestoreError(error, existingSnapSafeOp(error), docPath);
    }
  },

  async fetchAdminCloudSnapshot(): Promise<{
    accountsCount: number;
    policiesCount: number;
  }> {
    if (!this.isCloudAdmin()) {
      return { accountsCount: 0, policiesCount: 0 };
    }

    const registryPath = 'accountRegistry';
    const policiesPath = 'accountPolicies';

    const syncedPresences: AccountPresenceRecord[] = [];
    try {
      const regSnap = await getDocs(collection(db, registryPath));
      regSnap.forEach(docSnap => {
        const d = docSnap.data();
        const email = typeof d.email === 'string' ? d.email.trim().toLowerCase() : '';
        if (!email) return;
        const trahNames = Array.isArray(d.trahNames) ? (d.trahNames as string[]) : [];
        const commNames = Array.isArray(d.communityNames) ? (d.communityNames as string[]) : [];
        syncedPresences.push({
          accountKey: email,
          email,
          displayName: typeof d.displayName === 'string' ? d.displayName : email.split('@')[0],
          phone: typeof d.phone === 'string' ? d.phone : '-',
          deviceMask: typeof d.deviceMask === 'string' ? d.deviceMask : 'DEV-••••',
          activeModules: Array.isArray(d.activeModules)
            ? (d.activeModules as GovernanceModuleId[])
            : [],
          trahList: trahNames.map((name, i) => ({ id: `cloud-trah-${i}`, name })),
          communityList: commNames.map((name, i) => ({
            id: `cloud-comm-${i}`,
            name,
            orgType: 'Komunitas',
          })),
          activeScreen: typeof d.activeScreen === 'string' ? d.activeScreen : 'warga',
          lastSeenAt: toIsoStringSafe(d.lastSeenAt),
          source: 'local_registry',
        });
      });
      if (syncedPresences.length > 0) {
        AccountGovernanceService.ingestCloudRegistryBatch(syncedPresences);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, registryPath);
    }

    const cloudPolicies: Record<string, AccountPolicyRule> = {};
    try {
      const polSnap = await getDocs(collection(db, policiesPath));
      polSnap.forEach(docSnap => {
        const d = docSnap.data();
        if (d && typeof d.targetEmail === 'string') {
          const key = d.targetEmail.trim().toLowerCase();
          cloudPolicies[key] = {
            key,
            email: key,
            phone: typeof d.phone === 'string' && d.phone ? d.phone : undefined,
            status: (d.status as AccountModerationStatus) || 'normal',
            freeModules: d.allModulesFree
              ? 'all'
              : Array.isArray(d.freeModules)
              ? (d.freeModules as MonetizableModuleId[])
              : 'all',
            note: typeof d.note === 'string' && d.note ? d.note : undefined,
            updatedAt: toIsoStringSafe(d.updatedAt),
          };
        }
      });
      AccountGovernanceService.applyCloudAdminPolicies(cloudPolicies);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, policiesPath);
    }

    return {
      accountsCount: syncedPresences.length,
      policiesCount: Object.keys(cloudPolicies).length,
    };
  },

  async saveAccountPolicyToCloud(params: {
    email: string;
    phone?: string;
    status: AccountModerationStatus;
    freeModules?: 'all' | MonetizableModuleId[];
    note?: string;
  }): Promise<void> {
    const user = this.getCurrentUser();
    if (!user || !this.isCloudAdmin()) return;
    const cleanEmail = params.email.trim().toLowerCase().slice(0, 160);
    if (!cleanEmail || !cleanEmail.includes('@')) return;

    const policyId = toPolicyDocId(cleanEmail);
    const docPath = `accountPolicies/${policyId}`;
    const docRef = doc(db, 'accountPolicies', policyId);

    try {
      if (params.status === 'normal' && !params.note?.trim()) {
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          await deleteDoc(docRef);
        }
        return;
      }

      const allModulesFree = !params.freeModules || params.freeModules === 'all';
      const freeModules = allModulesFree
        ? []
        : sanitizeStringList(params.freeModules as string[], 6, 32);
      const cleanPhone = (params.phone || '').trim().slice(0, 32);
      const cleanNote = (params.note || '').trim().slice(0, 300);

      const snap = await getDoc(docRef);
      if (snap.exists()) {
        await updateDoc(docRef, {
          phone: cleanPhone,
          status: params.status,
          freeModules,
          allModulesFree,
          note: cleanNote,
          updatedAt: serverTimestamp(),
          updatedByUid: user.uid,
        });
      } else {
        await setDoc(docRef, {
          targetEmail: cleanEmail,
          phone: cleanPhone,
          status: params.status,
          freeModules,
          allModulesFree,
          note: cleanNote,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedByUid: user.uid,
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, docPath);
    }
  },

  async saveGovernanceConfigToCloud(communityFreeRules: CommunityFreeRule[]): Promise<void> {
    const user = this.getCurrentUser();
    if (!user || !this.isCloudAdmin()) return;

    const docPath = 'appConfig/governance';
    const docRef = doc(db, 'appConfig', 'governance');
    const bounded = communityFreeRules.slice(0, 50).map(r => ({
      id: String(r.id).slice(0, 64),
      kind: r.kind,
      targetId: r.targetId ? String(r.targetId).slice(0, 64) : '',
      name: String(r.name).slice(0, 80),
      enabled: Boolean(r.enabled),
      freeModules: r.freeModules === 'all' ? 'all' : sanitizeStringList(r.freeModules, 6, 32),
      updatedAt: r.updatedAt || new Date().toISOString(),
    }));

    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        await updateDoc(docRef, {
          communityFreeRules: bounded,
          updatedAt: serverTimestamp(),
          updatedByUid: user.uid,
        });
      } else {
        await setDoc(docRef, {
          communityFreeRules: bounded,
          updatedAt: serverTimestamp(),
          updatedByUid: user.uid,
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, docPath);
    }
  },

  async saveMonetizationConfigToCloud(rules: ModuleMonetizationRule[]): Promise<void> {
    const user = this.getCurrentUser();
    if (!user || !this.isCloudAdmin()) return;

    const docPath = 'appConfig/monetization';
    const docRef = doc(db, 'appConfig', 'monetization');
    const bounded = rules.slice(0, 10).map(r => ({
      moduleId: r.moduleId,
      enabled: Boolean(r.enabled),
      feeMode: r.feeMode,
      flatFee: Math.min(30000, Math.max(2000, Number(r.flatFee) || 2000)),
      percentRate: 1,
    }));

    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        await updateDoc(docRef, {
          rules: bounded,
          updatedAt: serverTimestamp(),
          updatedByUid: user.uid,
        });
      } else {
        await setDoc(docRef, {
          rules: bounded,
          updatedAt: serverTimestamp(),
          updatedByUid: user.uid,
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, docPath);
    }
  },
};

function existingSnapSafeOp(error: unknown): OperationType {
  const msg = error instanceof Error ? error.message.toLowerCase() : '';
  if (msg.includes('permission')) return OperationType.WRITE;
  return OperationType.WRITE;
}

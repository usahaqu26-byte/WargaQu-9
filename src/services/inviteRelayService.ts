const ISSUED_INVITES_KEY = 'wargaqu_issued_short_invites_v1';
const ISSUED_ROOM_SNAPSHOTS_KEY = 'wargaqu_issued_room_snapshots_v1';
export const REALTIME_RELAY_EVENT_NAME = 'wargaqu-realtime-relay';
export const RELAY_PUBLISH_CMD_EVENT = 'wargaqu-relay-publish-cmd';
export const RELAY_REGISTER_CHANNELS_EVENT = 'wargaqu-relay-register-channels';

interface StoredShortInvite {
  code: string;
  payload: string;
  createdAt: number;
}

interface StoredRoomSnapshot {
  roomKey: string;
  kind: 'trah' | 'rt';
  slug: string;
  title: string;
  inviter: string;
  snapshot: string;
  updatedAt: number;
}

const CUSTOM_PUBLIC_BASE_URL_KEY = 'wargaqu_public_invite_base_url_v1';

export type ParsedInviteInput =
  | { mode: 'legacy_token'; kind?: 'trah' | 'rt'; token: string; fallbackSlug?: string }
  | { mode: 'short_code'; kind?: 'trah' | 'rt'; code: string; fallbackSlug?: string }
  | {
      mode: 'room_slug';
      kind: 'trah' | 'rt';
      orgTypeHint?: 'RT' | 'Paguyuban' | 'Organisasi' | 'Sosial';
      slug: string;
      canonicalSlug: string;
      titleGuess: string;
      embeddedToken?: string;
    };

export interface RoomSyncResult {
  ok: boolean;
  source?: 'p2p_live' | 'ram_transit' | 'local_cache';
  title: string;
  inviter?: string;
  snapshot?: string;
  canonicalSlug: string;
}

export function slugifyInviteTitle(title: string): string {
  const cleaned = (title || '')
    .trim()
    .replace(/['"`]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56);
  return cleaned || 'Komunitas-WargaQu';
}

export function canonicalInviteSlug(rawTitleOrSlug: string): string {
  return slugifyInviteTitle(rawTitleOrSlug).toLowerCase();
}

export function readableTitleFromSlug(slug: string): string {
  return decodeURIComponent(slug || '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getSyncChannelName(kind: 'trah' | 'rt', titleOrSlug: string): string {
  return `sync:${kind}:${canonicalInviteSlug(titleOrSlug)}`;
}

function loadIssuedShortInvites(): StoredShortInvite[] {
  try {
    const raw = localStorage.getItem(ISSUED_INVITES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

function saveIssuedShortInvite(code: string, payload: string) {
  try {
    const list = loadIssuedShortInvites().filter((x) => x.code !== code);
    list.unshift({ code, payload, createdAt: Date.now() });
    localStorage.setItem(ISSUED_INVITES_KEY, JSON.stringify(list.slice(0, 30)));
  } catch {
    // ignore
  }
}

function getLocalIssuedPayload(code: string): string | null {
  const found = loadIssuedShortInvites().find((x) => x.code === code);
  return found ? found.payload : null;
}

function loadLocalRoomSnapshots(): StoredRoomSnapshot[] {
  try {
    const raw = localStorage.getItem(ISSUED_ROOM_SNAPSHOTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

function saveLocalRoomSnapshot(entry: StoredRoomSnapshot) {
  try {
    const list = loadLocalRoomSnapshots().filter((x) => x.roomKey !== entry.roomKey);
    list.unshift(entry);
    localStorage.setItem(ISSUED_ROOM_SNAPSHOTS_KEY, JSON.stringify(list.slice(0, 40)));
  } catch {
    // ignore
  }
}

function getLocalRoomSnapshot(kind: 'trah' | 'rt', canonicalSlug: string): StoredRoomSnapshot | null {
  const key = `${kind}:${canonicalSlug}`;
  return loadLocalRoomSnapshots().find((x) => x.roomKey === key) || null;
}

export function extractShortCodeCandidate(rawInput: string): string | null {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  if (trimmed.includes('t=') || trimmed.includes('trah=') || trimmed.includes('rt=') || trimmed.includes('rtInvite=')) {
    try {
      const qIdx = trimmed.indexOf('?');
      const hIdx = trimmed.indexOf('#');
      const sliceFrom = qIdx >= 0 ? trimmed.slice(qIdx) : hIdx >= 0 ? `?${trimmed.slice(hIdx + 1)}` : `?${trimmed}`;
      const params = new URLSearchParams(sliceFrom.split('#')[0]);
      const extracted =
        params.get('t') || params.get('trah') || params.get('rt') || params.get('rtInvite');
      if (extracted) candidate = extracted.trim();
    } catch {
      // ignore
    }
  }

  if (/^[QR][A-Za-z0-9]{5,12}$/.test(candidate)) {
    return candidate;
  }
  return null;
}

function isLegacyCompressedToken(val: string): boolean {
  return (
    val.startsWith('LQH1:') ||
    val.startsWith('LQH2_') ||
    val.startsWith('WQR1:') ||
    val.startsWith('WQR2_')
  );
}

export function parseInviteInput(
  rawInput: string,
  defaultKind: 'trah' | 'rt' = 'trah'
): ParsedInviteInput | null {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) return null;

  if (isLegacyCompressedToken(trimmed)) {
    const inferredKind =
      trimmed.startsWith('LQH') ? 'trah' : trimmed.startsWith('WQR') ? 'rt' : defaultKind;
    return { mode: 'legacy_token', kind: inferredKind, token: trimmed };
  }

  // Extract query parameters if URL or query-like string
  if (
    trimmed.includes('?') ||
    trimmed.includes('trah=') ||
    trimmed.includes('t=') ||
    trimmed.includes('trahInvite=') ||
    trimmed.includes('rt=') ||
    trimmed.includes('paguyuban=') ||
    trimmed.includes('grup=') ||
    trimmed.includes('organisasi=') ||
    trimmed.includes('sosial=') ||
    trimmed.includes('rtInvite=')
  ) {
    try {
      const qIdx = trimmed.indexOf('?');
      const hIdx = trimmed.indexOf('#');
      const sliceFrom =
        qIdx >= 0
          ? trimmed.slice(qIdx)
          : hIdx >= 0 && trimmed.slice(hIdx).includes('=')
          ? `?${trimmed.slice(hIdx + 1)}`
          : trimmed.includes('=')
          ? `?${trimmed}`
          : '';
      if (sliceFrom) {
        const [queryPart, hashPartRaw] = sliceFrom.split('#');
        const params = new URLSearchParams(queryPart);
        const hashParams =
          hashPartRaw && hashPartRaw.includes('=')
            ? new URLSearchParams(hashPartRaw.replace(/^[/?]+/, ''))
            : null;
        const trahSlugParam = params.get('trah') || hashParams?.get('trah');
        const trahTokenOrShort =
          params.get('t') ||
          params.get('trahInvite') ||
          hashParams?.get('t') ||
          hashParams?.get('trahInvite');

        if (trahTokenOrShort && trahTokenOrShort.trim()) {
          const v = trahTokenOrShort.trim();
          if (isLegacyCompressedToken(v)) {
            if (trahSlugParam && trahSlugParam.trim()) {
              return {
                mode: 'room_slug',
                kind: 'trah',
                slug: slugifyInviteTitle(trahSlugParam.trim()),
                canonicalSlug: canonicalInviteSlug(trahSlugParam.trim()),
                titleGuess: readableTitleFromSlug(trahSlugParam.trim()),
                embeddedToken: v,
              };
            }
            return { mode: 'legacy_token', kind: 'trah', token: v };
          }
          if (/^Q[A-Za-z0-9]{5,12}$/.test(v)) {
            return {
              mode: 'short_code',
              kind: 'trah',
              code: v,
              fallbackSlug: trahSlugParam ? canonicalInviteSlug(trahSlugParam) : undefined,
            };
          }
        }

        const trahParam = trahSlugParam || trahTokenOrShort;
        if (trahParam && trahParam.trim()) {
          const v = trahParam.trim();
          if (isLegacyCompressedToken(v)) {
            return { mode: 'legacy_token', kind: 'trah', token: v };
          }
          if (/^Q[A-Za-z0-9]{5,12}$/.test(v) && !trahSlugParam) {
            return { mode: 'short_code', kind: 'trah', code: v };
          }
          const canonical = canonicalInviteSlug(v);
          return {
            mode: 'room_slug',
            kind: 'trah',
            slug: slugifyInviteTitle(v),
            canonicalSlug: canonical,
            titleGuess: readableTitleFromSlug(v),
          };
        }

        const paguyubanParam = params.get('paguyuban') || hashParams?.get('paguyuban');
        const grupParam =
          params.get('grup') ||
          params.get('organisasi') ||
          params.get('sosial') ||
          hashParams?.get('grup');
        const rtParam = params.get('rt') || params.get('rtInvite') || hashParams?.get('rt');
        const anyRtVal = paguyubanParam || grupParam || rtParam;
        if (anyRtVal && anyRtVal.trim()) {
          const v = anyRtVal.trim();
          if (isLegacyCompressedToken(v)) {
            return { mode: 'legacy_token', kind: 'rt', token: v };
          }
          if (/^R[A-Za-z0-9]{5,12}$/.test(v) && !paguyubanParam && !grupParam) {
            return { mode: 'short_code', kind: 'rt', code: v };
          }
          const canonical = canonicalInviteSlug(v);
          return {
            mode: 'room_slug',
            kind: 'rt',
            orgTypeHint: paguyubanParam ? 'Paguyuban' : grupParam ? 'Organisasi' : 'RT',
            slug: slugifyInviteTitle(v),
            canonicalSlug: canonical,
            titleGuess: readableTitleFromSlug(v),
          };
        }
      }
    } catch {
      // ignore URL parse error and continue
    }
  }

  // Path-style support: /trah/Nama-Trah or /rt/RT-03-Melati or /paguyuban/Paguyuban-Asri
  const pathMatch = trimmed.match(/\/(trah|rt|paguyuban|grup)\/([^/?#]+)/i);
  if (pathMatch) {
    const segType = pathMatch[1].toLowerCase();
    const rawSlug = decodeURIComponent(pathMatch[2]);
    const kind: 'trah' | 'rt' = segType === 'trah' ? 'trah' : 'rt';
    return {
      mode: 'room_slug',
      kind,
      orgTypeHint:
        segType === 'paguyuban' ? 'Paguyuban' : segType === 'grup' ? 'Organisasi' : segType === 'rt' ? 'RT' : undefined,
      slug: slugifyInviteTitle(rawSlug),
      canonicalSlug: canonicalInviteSlug(rawSlug),
      titleGuess: readableTitleFromSlug(rawSlug),
    };
  }

  // Legacy short code pasted directly (Qxxxxxx / Rxxxxxx)
  if (/^[QR][A-Za-z0-9]{5,12}$/.test(trimmed)) {
    return {
      mode: 'short_code',
      kind: trimmed.startsWith('Q') ? 'trah' : 'rt',
      code: trimmed,
    };
  }

  // Direct title or slug pasted (e.g. "Trah-Mbah-Kromo" or "RT 03 Villa Melati")
  const slug = slugifyInviteTitle(trimmed);
  if (slug) {
    return {
      mode: 'room_slug',
      kind: defaultKind,
      slug,
      canonicalSlug: canonicalInviteSlug(trimmed),
      titleGuess: readableTitleFromSlug(trimmed),
    };
  }

  return null;
}

function registerRelayChannels(channels: string[]) {
  if (typeof window === 'undefined' || channels.length === 0) return;
  window.dispatchEvent(new CustomEvent(RELAY_REGISTER_CHANNELS_EVENT, { detail: { channels } }));
}

function publishRelayEvent(channel: string, eventName: string, payload: unknown) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(RELAY_PUBLISH_CMD_EVENT, {
      detail: { channel, eventName, payload },
    })
  );
}

export function normalizeInviteBaseUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    let cleanPath = parsed.pathname || '/';
    cleanPath = cleanPath
      .replace(/\/index\.html$/i, '/')
      .replace(/\/(trah|rt|paguyuban|grup)\/[^/]*$/i, '/');
    if (!cleanPath.endsWith('/')) cleanPath += '/';
    return `${parsed.origin}${cleanPath}`;
  } catch {
    return '';
  }
}

export function getCurrentAppBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  const override = getCustomPublicBaseUrl();
  if (override) return override;
  const { origin, pathname } = window.location;
  if (!origin || origin === 'null' || origin.startsWith('capacitor://') || origin.startsWith('file://')) {
    return 'https://wargaqu.app/';
  }
  let cleanPath = (pathname || '/')
    .replace(/\/index\.html$/i, '/')
    .replace(/\/(trah|rt|paguyuban|grup)\/[^/]*$/i, '/');
  if (!cleanPath.endsWith('/')) cleanPath += '/';
  return `${origin}${cleanPath}`;
}

export function getCustomPublicBaseUrl(): string {
  try {
    const raw = localStorage.getItem(CUSTOM_PUBLIC_BASE_URL_KEY) || '';
    return raw ? normalizeInviteBaseUrl(raw) : '';
  } catch {
    return '';
  }
}

export function setCustomPublicBaseUrl(rawUrl: string): string {
  try {
    const normalized = normalizeInviteBaseUrl(rawUrl);
    if (!normalized) {
      localStorage.removeItem(CUSTOM_PUBLIC_BASE_URL_KEY);
      return '';
    }
    localStorage.setItem(CUSTOM_PUBLIC_BASE_URL_KEY, normalized);
    return normalized;
  } catch {
    return '';
  }
}

export function isPrivateDevHost(): boolean {
  if (typeof window === 'undefined') return false;
  return /^ais-dev-/i.test(window.location.hostname || '');
}

export const InviteRelayService = {
  buildTitleInviteUrl(
    kind: 'trah' | 'rt',
    title: string,
    orgType?: string
  ): { url: string; queryKey: 'trah' | 'rt' | 'paguyuban' | 'grup'; slug: string; canonicalSlug: string } {
    const baseUrl = getCurrentAppBaseUrl();
    const slug = slugifyInviteTitle(title);
    const canonicalSlug = slug.toLowerCase();
    let queryKey: 'trah' | 'rt' | 'paguyuban' | 'grup' = 'trah';
    if (kind === 'rt') {
      if (orgType === 'Paguyuban') queryKey = 'paguyuban';
      else if (orgType === 'Organisasi' || orgType === 'Sosial') queryKey = 'grup';
      else queryKey = 'rt';
    }
    return {
      url: `${baseUrl}?${queryKey}=${slug}`,
      queryKey,
      slug,
      canonicalSlug,
    };
  },

  buildSelfContainedTrahUrl(title: string, compactToken: string): string {
    const baseUrl = getCurrentAppBaseUrl();
    const slug = slugifyInviteTitle(title);
    return `${baseUrl}?trah=${slug}&t=${encodeURIComponent(compactToken)}`;
  },

  async publishRoomSnapshot(params: {
    kind: 'trah' | 'rt';
    title: string;
    inviter: string;
    snapshot: string;
  }): Promise<{ ok: boolean; canonicalSlug: string }> {
    const slug = slugifyInviteTitle(params.title);
    const canonicalSlug = slug.toLowerCase();
    const roomKey = `${params.kind}:${canonicalSlug}`;
    const updatedAt = Date.now();

    saveLocalRoomSnapshot({
      roomKey,
      kind: params.kind,
      slug: canonicalSlug,
      title: params.title,
      inviter: params.inviter || 'WargaQu',
      snapshot: params.snapshot,
      updatedAt,
    });

    const channel = getSyncChannelName(params.kind, canonicalSlug);
    registerRelayChannels([channel]);
    publishRelayEvent(channel, 'sync:snapshot', {
      kind: params.kind,
      slug: canonicalSlug,
      title: params.title,
      inviter: params.inviter || 'WargaQu',
      snapshot: params.snapshot,
      updatedAt,
    });

    try {
      const res = await fetch('/api/invite-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: params.kind,
          slug: canonicalSlug,
          title: params.title,
          inviter: params.inviter || 'WargaQu',
          snapshot: params.snapshot,
        }),
      });
      return { ok: res.ok, canonicalSlug };
    } catch {
      return { ok: false, canonicalSlug };
    }
  },

  async syncRoomOnEntry(params: {
    kind: 'trah' | 'rt';
    slugOrTitle: string;
    timeoutMs?: number;
  }): Promise<RoomSyncResult> {
    const canonicalSlug = canonicalInviteSlug(params.slugOrTitle);
    const fallbackTitle = readableTitleFromSlug(params.slugOrTitle) || params.slugOrTitle;
    const channel = getSyncChannelName(params.kind, canonicalSlug);

    registerRelayChannels([channel]);

    // Race / await live P2P WebSocket reply AND RAM transit fetch in parallel
    const p2pPromise = new Promise<{
      title: string;
      inviter: string;
      snapshot: string;
    } | null>((resolve) => {
      if (typeof window === 'undefined') {
        resolve(null);
        return;
      }
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        window.removeEventListener(REALTIME_RELAY_EVENT_NAME, onRelay as EventListener);
        resolve(null);
      }, params.timeoutMs ?? 1700);

      const onRelay = (ev: Event) => {
        const detail = (ev as CustomEvent<{
          channel?: string;
          eventName?: string;
          payload?: {
            kind?: string;
            slug?: string;
            title?: string;
            inviter?: string;
            snapshot?: string;
          };
        }>).detail;
        if (!detail || detail.channel !== channel || detail.eventName !== 'sync:snapshot') return;
        const p = detail.payload;
        if (!p?.snapshot) return;
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        window.removeEventListener(REALTIME_RELAY_EVENT_NAME, onRelay as EventListener);
        resolve({
          title: p.title || fallbackTitle,
          inviter: p.inviter || 'WargaQu',
          snapshot: p.snapshot,
        });
      };

      window.addEventListener(REALTIME_RELAY_EVENT_NAME, onRelay as EventListener);
      // Broadcast sync request right after listener is attached
      publishRelayEvent(channel, 'sync:request', {
        kind: params.kind,
        slug: canonicalSlug,
        requestedAt: Date.now(),
      });
    });

    const ramPromise = (async (): Promise<{
      title: string;
      inviter: string;
      snapshot: string;
    } | null> => {
      try {
        const res = await fetch(
          `/api/invite-room/${encodeURIComponent(params.kind)}/${encodeURIComponent(canonicalSlug)}`
        );
        if (!res.ok) return null;
        const data = (await res.json()) as {
          found?: boolean;
          title?: string;
          inviter?: string;
          snapshot?: string;
        };
        if (data?.snapshot) {
          return {
            title: data.title || fallbackTitle,
            inviter: data.inviter || 'WargaQu',
            snapshot: data.snapshot,
          };
        }
      } catch {
        // ignore network errors
      }
      return null;
    })();

    const [p2pResult, ramResult] = await Promise.all([p2pPromise, ramPromise]);

    if (p2pResult?.snapshot) {
      return {
        ok: true,
        source: 'p2p_live',
        title: p2pResult.title,
        inviter: p2pResult.inviter,
        snapshot: p2pResult.snapshot,
        canonicalSlug,
      };
    }

    if (ramResult?.snapshot) {
      return {
        ok: true,
        source: 'ram_transit',
        title: ramResult.title,
        inviter: ramResult.inviter,
        snapshot: ramResult.snapshot,
        canonicalSlug,
      };
    }

    const localEntry = getLocalRoomSnapshot(params.kind, canonicalSlug);
    if (localEntry?.snapshot) {
      return {
        ok: true,
        source: 'local_cache',
        title: localEntry.title,
        inviter: localEntry.inviter,
        snapshot: localEntry.snapshot,
        canonicalSlug,
      };
    }

    return {
      ok: false,
      title: fallbackTitle,
      canonicalSlug,
    };
  },

  async createShortInviteLink(
    prefix: 'Q' | 'R',
    queryKey: 't' | 'rt',
    fullCompressedToken: string
  ): Promise<{ url: string; shortCode: string; isShort: boolean }> {
    const baseUrl = getCurrentAppBaseUrl();
    const fallbackUrl = `${baseUrl}?${queryKey}=${encodeURIComponent(fullCompressedToken)}`;

    try {
      const res = await fetch('/api/relay-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix, payload: fullCompressedToken }),
      });
      if (res.ok) {
        const data = (await res.json()) as { code?: string };
        if (data?.code) {
          saveIssuedShortInvite(data.code, fullCompressedToken);
          return {
            url: `${baseUrl}?${queryKey}=${data.code}`,
            shortCode: data.code,
            isShort: true,
          };
        }
      }
    } catch {
      // offline fallback
    }

    return {
      url: fallbackUrl,
      shortCode: fullCompressedToken,
      isShort: false,
    };
  },

  async resolveInviteTokenIfShort(rawInput: string): Promise<string> {
    const shortCode = extractShortCodeCandidate(rawInput);
    if (!shortCode) return rawInput;

    // 1. Check local sender storage first (instant same-device preview/test)
    const localPayload = getLocalIssuedPayload(shortCode);
    if (localPayload) return localPayload;

    // 2. Fetch from ephemeral RAM relay ticket endpoint
    try {
      const res = await fetch(`/api/relay-ticket/${encodeURIComponent(shortCode)}`);
      if (res.ok) {
        const data = (await res.json()) as { payload?: string };
        if (data?.payload) {
          return data.payload;
        }
      }
    } catch {
      // ignore network errors
    }

    return rawInput;
  },
};

import { buildApiUrl } from './appOriginService';
import {
  canonicalInviteSlug,
  getSyncChannelName,
  InviteRelayService,
  RELAY_PUBLISH_CMD_EVENT,
  RELAY_REGISTER_CHANNELS_EVENT,
} from './inviteRelayService';
import { FamilyMember, TrahCategory } from './leluhurCoreSyncService';

export const LELUHUR_SYNC_EVENT = 'wargaqu-leluhur-sync';

export type LeluhurProposalActionType =
  | 'member_add'
  | 'member_update'
  | 'member_delete'
  | 'batch_add'
  | 'batch_replace'
  | 'hub_graft';

export type LeluhurProposalOp =
  | {
      op: 'upsert_member';
      member: FamilyMember;
    }
  | {
      op: 'upsert_members';
      members: FamilyMember[];
      replaceParentId?: string | null;
      removedIds?: string[];
    }
  | {
      op: 'delete_members';
      memberIds: string[];
    };

export interface LeluhurChangeProposal {
  id: string;
  trahId: string;
  trahSlug: string;
  trahName: string;
  actionType: LeluhurProposalActionType;
  proposerName: string;
  proposerEmail?: string;
  targetName?: string;
  summary: string;
  details?: string;
  baseVersion: number;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedAt?: string;
  reviewedBy?: string;
  operations: LeluhurProposalOp[];
}

export interface TrahVersionHeader {
  slug: string;
  trahId: string;
  title: string;
  dataVersion: number;
  memberCount: number;
  approvedBy: string;
  summary: string;
  updatedAt: number;
}

export interface TrahSyncCheckResult {
  slug: string;
  remoteHeader: TrahVersionHeader | null;
  localVersion: number;
  localMemberCount: number;
  isOutdated: boolean;
  pendingProposals: LeluhurChangeProposal[];
  pendingCount: number;
}

function getProposalsStorageKey(scopeKey: string): string {
  return `wargaqu_leluhur_proposals_v1_${scopeKey}`;
}

export function loadProposalsForScope(scopeKey: string): LeluhurChangeProposal[] {
  try {
    const raw = localStorage.getItem(getProposalsStorageKey(scopeKey));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveProposalsForScope(scopeKey: string, list: LeluhurChangeProposal[]): void {
  try {
    localStorage.setItem(getProposalsStorageKey(scopeKey), JSON.stringify(list.slice(0, 80)));
  } catch {
    // ignore
  }
}

export function formatSyncTimestamp(isoOrMs?: string | number | null): string {
  if (!isoOrMs) return 'Belum disinkronkan';
  const d = new Date(isoOrMs);
  if (Number.isNaN(d.getTime())) return String(isoOrMs);
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function publishTrahEvent(trahNameOrSlug: string, eventName: string, payload: unknown) {
  if (typeof window === 'undefined') return;
  const channel = getSyncChannelName('trah', trahNameOrSlug);
  window.dispatchEvent(new CustomEvent(RELAY_REGISTER_CHANNELS_EVENT, { detail: { channels: [channel] } }));
  window.dispatchEvent(
    new CustomEvent(RELAY_PUBLISH_CMD_EVENT, {
      detail: { channel, eventName, payload },
    })
  );
}

/**
 * Pure deterministic patch applicator used when Admin taps "Approve".
 */
export function applyProposalOpsToTrah(
  trah: TrahCategory,
  proposal: LeluhurChangeProposal
): TrahCategory {
  let members = [...trah.members];

  for (const op of proposal.operations) {
    if (op.op === 'upsert_member' && op.member) {
      const idx = members.findIndex(m => m.id === op.member.id);
      if (idx >= 0) {
        members[idx] = { ...members[idx], ...op.member };
      } else {
        members.push(op.member);
      }
    } else if (op.op === 'upsert_members' && Array.isArray(op.members)) {
      const removedSet = new Set(Array.isArray(op.removedIds) ? op.removedIds : []);
      if (removedSet.size > 0) {
        members = members
          .filter(m => !removedSet.has(m.id))
          .map(m =>
            m.parentId && removedSet.has(m.parentId) && op.replaceParentId
              ? { ...m, parentId: op.replaceParentId }
              : m
          );
      }
      for (const incoming of op.members) {
        const idx = members.findIndex(m => m.id === incoming.id);
        if (idx >= 0) {
          members[idx] = { ...members[idx], ...incoming };
        } else {
          members.push(incoming);
        }
      }
    } else if (op.op === 'delete_members' && Array.isArray(op.memberIds)) {
      const delSet = new Set(op.memberIds);
      members = members.filter(m => !delSet.has(m.id));
    }
  }

  return {
    ...trah,
    members,
  };
}

export const LeluhurVersionSyncService = {
  /**
   * Stage 1: Anggota mengajukan perubahan ke antrean Persetujuan Admin + Log internal.
   */
  async submitMemberProposal(params: {
    scopeKey: string;
    trah: TrahCategory;
    proposal: Omit<LeluhurChangeProposal, 'trahSlug' | 'status'>;
  }): Promise<{ savedLocal: boolean; sentServer: boolean; proposal: LeluhurChangeProposal }> {
    const trahSlug = canonicalInviteSlug(params.trah.name);
    const fullProposal: LeluhurChangeProposal = {
      ...params.proposal,
      trahSlug,
      status: 'pending',
    };

    const prevLocal = loadProposalsForScope(params.scopeKey);
    saveProposalsForScope(params.scopeKey, [
      fullProposal,
      ...prevLocal.filter(p => p.id !== fullProposal.id),
    ]);

    publishTrahEvent(trahSlug, 'trah:proposal_submitted', {
      slug: trahSlug,
      proposal: fullProposal,
    });

    let sentServer = false;
    try {
      const res = await fetch(buildApiUrl(`/api/leluhur/room/${encodeURIComponent(trahSlug)}/proposals`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullProposal),
      });
      sentServer = res.ok;
    } catch {
      sentServer = false;
    }

    return { savedLocal: true, sentServer, proposal: fullProposal };
  },

  /**
   * Stage 2: Admin menyetujui perubahan (atau Admin edit langsung) ->
   * menaikkan nomor versi rujukan + publish snapshot resmi ke transit room.
   */
  async publishApprovedRelease(params: {
    trah: TrahCategory;
    snapshotToken: string;
    approvedBy: string;
    summary: string;
  }): Promise<{ ok: boolean; header: TrahVersionHeader }> {
    const slug = canonicalInviteSlug(params.trah.name);
    const nextVersion = Math.max(1, params.trah.dataVersion || 1);
    const memberCount = params.trah.members.length;
    const updatedAt = Date.now();

    const header: TrahVersionHeader = {
      slug,
      trahId: params.trah.id,
      title: params.trah.name,
      dataVersion: nextVersion,
      memberCount,
      approvedBy: params.approvedBy || 'Pengurus Trah',
      summary: params.summary || `Versi v${nextVersion} (${memberCount} anggota)`,
      updatedAt,
    };

    // Publish full snapshot token into invite-room so Stage 3 Pull works even if Admin closes HP
    const roomRes = await InviteRelayService.publishRoomSnapshot({
      kind: 'trah',
      title: params.trah.name,
      inviter: params.approvedBy || 'Pengurus Trah',
      snapshot: params.snapshotToken,
    });

    let releaseOk = roomRes.ok;
    try {
      const res = await fetch(buildApiUrl(`/api/leluhur/room/${encodeURIComponent(slug)}/release`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(header),
      });
      if (res.ok) {
        const body = (await res.json()) as { header?: TrahVersionHeader };
        if (body.header) {
          Object.assign(header, body.header);
        }
        releaseOk = true;
      }
    } catch {
      // offline tolerance
    }

    // Broadcast lightweight version bump ONLY to this trah's channel (zero cross-module noise)
    publishTrahEvent(slug, 'trah:version_updated', header);

    return { ok: releaseOk, header };
  },

  async resolveProposalOnServer(params: {
    trahName: string;
    proposalId: string;
    decision: 'approved' | 'rejected';
    reviewedBy: string;
  }): Promise<boolean> {
    const slug = canonicalInviteSlug(params.trahName);
    publishTrahEvent(slug, 'trah:proposal_resolved', {
      slug,
      proposalId: params.proposalId,
      decision: params.decision,
      reviewedBy: params.reviewedBy,
    });

    try {
      const res = await fetch(
        buildApiUrl(
          `/api/leluhur/room/${encodeURIComponent(slug)}/proposals/${encodeURIComponent(
            params.proposalId
          )}/resolve`
        ),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision: params.decision,
            reviewedBy: params.reviewedBy,
          }),
        }
      );
      return res.ok;
    } catch {
      return false;
    }
  },

  /**
   * Lightweight header + pending proposal check ONLY for the currently active Trah.
   * Never downloads big snapshots unless Stage 3 pull is triggered.
   */
  async checkTrahVersionAndProposals(
    trah: TrahCategory,
    isAdmin: boolean
  ): Promise<TrahSyncCheckResult> {
    const slug = canonicalInviteSlug(trah.name);
    const localVersion = Math.max(1, trah.dataVersion || 1);
    const localMemberCount = trah.members.length;

    let remoteHeader: TrahVersionHeader | null = null;
    let pendingCount = 0;
    let pendingProposals: LeluhurChangeProposal[] = [];

    try {
      const metaRes = await fetch(
        buildApiUrl(`/api/leluhur/room/${encodeURIComponent(slug)}/meta`)
      );
      if (metaRes.ok) {
        const meta = (await metaRes.json()) as {
          found?: boolean;
          header?: TrahVersionHeader | null;
          pendingCount?: number;
        };
        if (meta.found && meta.header) {
          remoteHeader = meta.header;
        }
        pendingCount = Number(meta.pendingCount || 0);
      }

      if (isAdmin && pendingCount > 0) {
        const propRes = await fetch(
          buildApiUrl(`/api/leluhur/room/${encodeURIComponent(slug)}/proposals`)
        );
        if (propRes.ok) {
          const propData = (await propRes.json()) as {
            proposals?: LeluhurChangeProposal[];
          };
          if (Array.isArray(propData.proposals)) {
            pendingProposals = propData.proposals;
          }
        }
      }
    } catch {
      // network unavailable — keep local gracefully
    }

    const isOutdated = Boolean(
      remoteHeader &&
        (remoteHeader.dataVersion > localVersion ||
          (remoteHeader.dataVersion === localVersion &&
            remoteHeader.memberCount !== localMemberCount &&
            remoteHeader.updatedAt >
              (trah.lastSyncedAt ? new Date(trah.lastSyncedAt).getTime() : 0)))
    );

    return {
      slug,
      remoteHeader,
      localVersion,
      localMemberCount,
      isOutdated,
      pendingProposals,
      pendingCount,
    };
  },

  /**
   * Stage 3: Tarik snapshot terbaru Trah yang sudah di-approve ke perangkat ini.
   */
  async pullLatestTrahSnapshot(trahName: string) {
    return InviteRelayService.syncRoomOnEntry({
      kind: 'trah',
      slugOrTitle: trahName,
      timeoutMs: 1800,
    });
  },
};

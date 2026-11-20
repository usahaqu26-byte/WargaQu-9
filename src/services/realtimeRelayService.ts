import { AUTH_SYNC_EVENT, AuthService } from './authService';
import {
  canonicalInviteSlug,
  getSyncChannelName,
  RELAY_PUBLISH_CMD_EVENT,
  RELAY_REGISTER_CHANNELS_EVENT,
} from './inviteRelayService';
import { RT_SYNC_EVENT, RtSiagaStorage } from './rtSiagaStorage';
import { SIAGA_CIRCLE_SYNC_EVENT, SiagaCircleService } from './siagaCircleService';
import { buildApiUrl, buildWsRelayUrl } from './appOriginService';

export type RelayConnectionState = 'connecting' | 'connected' | 'offline';

export interface RelayIncomingEvent<T = unknown> {
  eventId: string;
  channel: string;
  eventName: string;
  payload: T;
  senderDeviceHash?: string;
  sentAt: string;
}

export interface ServerTelemetryPayload {
  connectedClients: number;
  activeChannels: number;
  activePresenceRamCount: number;
  activeQuizRooms: number;
  activeTransitTickets: number;
  uptimeSec: number;
  sentAt: string;
}

export const REALTIME_RELAY_EVENT = 'wargaqu-realtime-relay';
export const RELAY_STATUS_EVENT = 'wargaqu-relay-status';
export const RELAY_TELEMETRY_EVENT = 'wargaqu-relay-telemetry';

interface QueuedOutbound {
  eventId: string;
  channel: string;
  eventName: string;
  payload: unknown;
}

const MAX_DEDUP_IDS = 300;
const processedEventIds = new Set<string>();
const processedOrder: string[] = [];

function markEventProcessed(eventId: string): boolean {
  if (processedEventIds.has(eventId)) return false;
  processedEventIds.add(eventId);
  processedOrder.push(eventId);
  if (processedOrder.length > MAX_DEDUP_IDS) {
    const oldest = processedOrder.shift();
    if (oldest) processedEventIds.delete(oldest);
  }
  return true;
}

function normalizeChannelPart(raw: string): string {
  return (raw || 'default')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'default';
}

export function getAccountSessionChannel(email: string): string {
  return `acct:${normalizeChannelPart(email)}`;
}

function getWsEndpoint(): string {
  return buildWsRelayUrl();
}

function getDeviceShortHash(): string {
  const id = AuthService.getHiddenDeviceId();
  return id.slice(-8);
}

class RealtimeRelayManager {
  private ws: WebSocket | null = null;
  private status: RelayConnectionState = 'offline';
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private reconnectAttempt = 0;
  private outbox: QueuedOutbound[] = [];
  private started = false;
  private extraChannels = new Set<string>();
  private lastTelemetry: ServerTelemetryPayload | null = null;

  getStatus(): RelayConnectionState {
    return this.status;
  }

  getTelemetry(): ServerTelemetryPayload | null {
    return this.lastTelemetry;
  }

  async fetchHealthTelemetry(): Promise<ServerTelemetryPayload | null> {
    if (typeof fetch === 'undefined') return this.lastTelemetry;
    try {
      const resp = await fetch(buildApiUrl('/api/relay-health'));
      if (!resp.ok) return this.lastTelemetry;
      const data = (await resp.json()) as Partial<ServerTelemetryPayload>;
      const telemetry: ServerTelemetryPayload = {
        connectedClients: Number(data.connectedClients) || 0,
        activeChannels: Number(data.activeChannels) || 0,
        activePresenceRamCount: Number(data.activePresenceRamCount) || 0,
        activeQuizRooms: Number(data.activeQuizRooms) || 0,
        activeTransitTickets: Number(data.activeTransitTickets) || 0,
        uptimeSec: Number(data.uptimeSec) || 0,
        sentAt: data.sentAt || new Date().toISOString(),
      };
      this.lastTelemetry = telemetry;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(RELAY_TELEMETRY_EVENT, { detail: telemetry }));
      }
      return telemetry;
    } catch {
      return this.lastTelemetry;
    }
  }

  getRtChannel(): string {
    const profile = RtSiagaStorage.getProfile();
    return `rt:${normalizeChannelPart(profile.orgName)}`;
  }

  registerChannels(channels: string[]) {
    let added = false;
    for (const ch of channels) {
      const clean = (ch || '').trim();
      if (clean && !this.extraChannels.has(clean)) {
        this.extraChannels.add(clean);
        added = true;
      }
    }
    if (added) {
      this.joinCurrentChannels();
    }
  }

  getSubscribedChannels(): string[] {
    const channels = new Set<string>(['admin:policy', this.getRtChannel()]);
    const communities = RtSiagaStorage.getCommunities();
    for (const comm of communities) {
      if (comm?.profile?.orgName) {
        channels.add(getSyncChannelName('rt', comm.profile.orgName));
      }
    }
    const circles = SiagaCircleService.getCircles();
    for (const c of circles) {
      if (c.inviteCode) {
        channels.add(`circle:${c.inviteCode.toUpperCase()}`);
      }
    }
    const acc = AuthService.getAccount();
    if (acc?.email) {
      channels.add(getAccountSessionChannel(acc.email));
    }
    for (const extra of this.extraChannels) {
      channels.add(extra);
    }
    return Array.from(channels);
  }

  private setStatus(next: RelayConnectionState) {
    if (this.status === next) return;
    this.status = next;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(RELAY_STATUS_EVENT, { detail: next }));
    }
  }

  start() {
    if (typeof window === 'undefined') return;
    if (!this.started) {
      this.started = true;
      window.addEventListener(AUTH_SYNC_EVENT, () => this.joinCurrentChannels());
      window.addEventListener(RT_SYNC_EVENT, () => this.joinCurrentChannels());
      window.addEventListener(SIAGA_CIRCLE_SYNC_EVENT, () => this.joinCurrentChannels());
      window.addEventListener(RELAY_REGISTER_CHANNELS_EVENT, ((ev: CustomEvent<{ channels?: string[] }>) => {
        if (Array.isArray(ev.detail?.channels)) {
          this.registerChannels(ev.detail.channels);
        }
      }) as EventListener);
      window.addEventListener(
        RELAY_PUBLISH_CMD_EVENT,
        ((ev: CustomEvent<{ channel?: string; eventName?: string; payload?: unknown }>) => {
          if (ev.detail?.channel && ev.detail?.eventName) {
            this.publish(ev.detail.channel, ev.detail.eventName, ev.detail.payload);
          }
        }) as EventListener
      );
      window.addEventListener(REALTIME_RELAY_EVENT, ((ev: CustomEvent<RelayIncomingEvent>) => {
        const d = ev.detail;
        if (!d || d.eventName !== 'sync:request' || !d.channel?.startsWith('sync:rt:')) return;
        const requestedSlug = d.channel.slice('sync:rt:'.length);
        const match = RtSiagaStorage.getCommunities().find(
          (c) => canonicalInviteSlug(c.profile.orgName) === requestedSlug
        );
        if (!match) return;
        const acc = AuthService.getAccount();
        const inviter = acc ? AuthService.getDisplayName(acc) : match.profile.creatorName || 'Pengurus';
        void RtSiagaStorage.encodeCommunityInviteCompact(match, inviter).then((snapshot) => {
          this.publish(d.channel, 'sync:snapshot', {
            kind: 'rt',
            slug: requestedSlug,
            title: match.profile.orgName,
            inviter,
            snapshot,
            updatedAt: Date.now(),
          });
        });
      }) as EventListener);
    }
    this.connect();
  }

  private connect() {
    if (typeof window === 'undefined') return;
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.setStatus('connecting');
    try {
      const ws = new WebSocket(getWsEndpoint());
      this.ws = ws;

      ws.onopen = () => {
        this.reconnectAttempt = 0;
        this.setStatus('connected');
        this.joinCurrentChannels();
        this.flushOutbox();
        if (this.heartbeatTimer) window.clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = window.setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'relay:ping' }));
          }
        }, 25000);
      };

      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(String(evt.data)) as {
            type?: string;
            eventId?: string;
            channel?: string;
            eventName?: string;
            payload?: unknown;
            senderDeviceHash?: string;
            sentAt?: string;
          };
          if (data.type !== 'relay:event' || !data.eventName || !data.channel) return;
          const evId = data.eventId || `${data.eventName}-${data.sentAt || Date.now()}`;
          if (!markEventProcessed(evId)) return;

          const detail: RelayIncomingEvent = {
            eventId: evId,
            channel: data.channel,
            eventName: data.eventName,
            payload: data.payload,
            senderDeviceHash: data.senderDeviceHash,
            sentAt: data.sentAt || new Date().toISOString(),
          };

          if (data.eventName === 'admin:telemetry' && data.payload && typeof data.payload === 'object') {
            this.lastTelemetry = data.payload as ServerTelemetryPayload;
            window.dispatchEvent(
              new CustomEvent(RELAY_TELEMETRY_EVENT, { detail: this.lastTelemetry })
            );
          }

          window.dispatchEvent(new CustomEvent(REALTIME_RELAY_EVENT, { detail }));
        } catch {
          // ignore invalid JSON
        }
      };

      ws.onclose = () => {
        this.setStatus('offline');
        if (this.heartbeatTimer) {
          window.clearInterval(this.heartbeatTimer);
          this.heartbeatTimer = null;
        }
        this.scheduleReconnect();
      };

      ws.onerror = () => {
        this.setStatus('offline');
      };
    } catch {
      this.setStatus('offline');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(15000, 1200 * Math.pow(1.6, this.reconnectAttempt));
    this.reconnectAttempt += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  joinCurrentChannels() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        type: 'relay:join',
        channels: this.getSubscribedChannels(),
      })
    );
  }

  publish(channel: string, eventName: string, payload: unknown): string {
    const eventId = `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    markEventProcessed(eventId);

    const frame = {
      type: 'relay:publish',
      eventId,
      channel,
      eventName,
      payload,
      senderDeviceHash: getDeviceShortHash(),
      sentAt: new Date().toISOString(),
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(frame));
    } else {
      this.outbox.push({ eventId, channel, eventName, payload });
      if (this.outbox.length > 50) this.outbox.shift();
      this.connect();
    }
    return eventId;
  }

  private flushOutbox() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.outbox.length === 0) return;
    const pending = [...this.outbox];
    this.outbox = [];
    for (const item of pending) {
      this.ws.send(
        JSON.stringify({
          type: 'relay:publish',
          eventId: item.eventId,
          channel: item.channel,
          eventName: item.eventName,
          payload: item.payload,
          senderDeviceHash: getDeviceShortHash(),
          sentAt: new Date().toISOString(),
        })
      );
    }
  }
}

export const RealtimeRelayService = new RealtimeRelayManager();

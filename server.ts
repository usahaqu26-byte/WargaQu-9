import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';

/**
 * Stateless Pass-Through Real-Time Relay Server (Port 3000)
 * - TIDAK menyimpan data warga, riwayat chat, atau database ke disk/DB.
 * - Server hanya meneruskan paket antar perangkat yang sedang online di channel yang sama.
 */

interface RelayEnvelope {
  type:
    | 'relay:join'
    | 'relay:publish'
    | 'relay:ping'
    | 'relay:pong'
    | 'relay:joined'
    | 'relay:event';
  eventId?: string;
  channel?: string;
  channels?: string[];
  eventName?: string;
  payload?: unknown;
  senderDeviceHash?: string;
  sentAt?: string;
}

interface ConnectedClient {
  ws: WebSocket;
  channels: Set<string>;
  clientId: string;
}

const PORT = Number(process.env.PORT || 3000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  // Volatile RAM routing tables ONLY (no persistent database / zero citizen storage)
  const clients = new Set<ConnectedClient>();
  const channelSubscribers = new Map<string, Set<ConnectedClient>>();
  let volatileMonetizeRules: unknown = null;
  let volatileAccountPolicies: unknown = null;
  const volatileFrozenDeviceMasks = new Set<string>();
  const volatileInviteTickets = new Map<string, { payload: string; expiresAt: number }>();
  const volatileInviteRooms = new Map<
    string,
    {
      kind: 'trah' | 'rt';
      slug: string;
      title: string;
      inviter: string;
      snapshot: string;
      updatedAt: number;
      expiresAt: number;
    }
  >();
  const volatilePresenceMap = new Map<
    string,
    { data: Record<string, unknown>; lastSeenMs: number }
  >();
  const TICKET_TTL_MS = 72 * 60 * 60 * 1000;
  const PRESENCE_TTL_MS = 24 * 60 * 60 * 1000;
  const MAX_VOLATILE_TICKETS = 500;
  const MAX_VOLATILE_PRESENCE = 1000;

  function pruneExpiredPresence() {
    const now = Date.now();
    for (const [k, v] of volatilePresenceMap.entries()) {
      if (now - v.lastSeenMs > PRESENCE_TTL_MS) {
        volatilePresenceMap.delete(k);
      }
    }
    while (volatilePresenceMap.size > MAX_VOLATILE_PRESENCE) {
      const oldestKey = volatilePresenceMap.keys().next().value;
      if (!oldestKey) break;
      volatilePresenceMap.delete(oldestKey);
    }
  }

  function pruneExpiredTickets() {
    const now = Date.now();
    for (const [k, v] of volatileInviteTickets.entries()) {
      if (v.expiresAt <= now) {
        volatileInviteTickets.delete(k);
      }
    }
    while (volatileInviteTickets.size > MAX_VOLATILE_TICKETS) {
      const oldestKey = volatileInviteTickets.keys().next().value;
      if (!oldestKey) break;
      volatileInviteTickets.delete(oldestKey);
    }
    for (const [k, v] of volatileInviteRooms.entries()) {
      if (v.expiresAt <= now) {
        volatileInviteRooms.delete(k);
      }
    }
    while (volatileInviteRooms.size > MAX_VOLATILE_TICKETS) {
      const oldestKey = volatileInviteRooms.keys().next().value;
      if (!oldestKey) break;
      volatileInviteRooms.delete(oldestKey);
    }
  }

  function subscribeClient(client: ConnectedClient, channel: string) {
    const clean = channel.trim();
    if (!clean) return;
    client.channels.add(clean);
    let set = channelSubscribers.get(clean);
    if (!set) {
      set = new Set<ConnectedClient>();
      channelSubscribers.set(clean, set);
    }
    set.add(client);
  }

  function removeClientFromAll(client: ConnectedClient) {
    for (const ch of client.channels) {
      const set = channelSubscribers.get(ch);
      if (set) {
        set.delete(client);
        if (set.size === 0) {
          channelSubscribers.delete(ch);
        }
      }
    }
    client.channels.clear();
    clients.delete(client);
  }

  function broadcastToChannel(channel: string, data: string, excludeClient?: ConnectedClient) {
    const set = channelSubscribers.get(channel);
    if (!set) return;
    for (const sub of set) {
      if (sub === excludeClient) continue;
      if (sub.ws.readyState === WebSocket.OPEN) {
        sub.ws.send(data);
      }
    }
  }

  wss.on('connection', (ws) => {
    const client: ConnectedClient = {
      ws,
      channels: new Set<string>(),
      clientId: `cli-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    };
    clients.add(client);
    subscribeClient(client, 'admin:policy');

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as RelayEnvelope;

        if (msg.type === 'relay:ping') {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'relay:pong', sentAt: new Date().toISOString() }));
          }
          return;
        }

        if (msg.type === 'relay:join' && Array.isArray(msg.channels)) {
          for (const ch of msg.channels) {
            if (typeof ch === 'string') {
              subscribeClient(client, ch);
            }
          }
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'relay:joined',
                channels: Array.from(client.channels),
                sentAt: new Date().toISOString(),
              })
            );
            // Send lightweight volatile admin policy / frozen-device blocklist on join
            if (volatileMonetizeRules) {
              ws.send(
                JSON.stringify({
                  type: 'relay:event',
                  eventId: `policy-init-${Date.now()}`,
                  channel: 'admin:policy',
                  eventName: 'admin:monetize_rules',
                  payload: volatileMonetizeRules,
                  sentAt: new Date().toISOString(),
                })
              );
            }
            if (volatileAccountPolicies) {
              ws.send(
                JSON.stringify({
                  type: 'relay:event',
                  eventId: `accgov-init-${Date.now()}`,
                  channel: 'admin:policy',
                  eventName: 'admin:account_policies',
                  payload: volatileAccountPolicies,
                  sentAt: new Date().toISOString(),
                })
              );
            }
            if (volatileFrozenDeviceMasks.size > 0) {
              ws.send(
                JSON.stringify({
                  type: 'relay:event',
                  eventId: `zt-init-${Date.now()}`,
                  channel: 'admin:policy',
                  eventName: 'zt:frozen_list',
                  payload: Array.from(volatileFrozenDeviceMasks),
                  sentAt: new Date().toISOString(),
                })
              );
            }
          }
          return;
        }

        if (msg.type === 'relay:publish' && msg.channel && msg.eventName) {
          // Keep ONLY ephemeral admin rules / device freeze list / active presence in RAM; zero DB/disk
          if (msg.eventName === 'admin:monetize_rules' && msg.payload) {
            volatileMonetizeRules = msg.payload;
          } else if (msg.eventName === 'admin:account_policies' && msg.payload) {
            volatileAccountPolicies = msg.payload;
          } else if (
            msg.eventName === 'presence:heartbeat' &&
            msg.payload &&
            typeof msg.payload === 'object'
          ) {
            const p = msg.payload as Record<string, unknown>;
            const key = typeof p.accountKey === 'string' ? p.accountKey.trim() : '';
            if (key) {
              pruneExpiredPresence();
              volatilePresenceMap.set(key, { data: p, lastSeenMs: Date.now() });
            }
          } else if (
            msg.eventName === 'zt:device_freeze' &&
            msg.payload &&
            typeof msg.payload === 'object'
          ) {
            const p = msg.payload as { deviceId?: string; status?: string };
            if (p.deviceId && p.status === 'frozen_lost') {
              volatileFrozenDeviceMasks.add(p.deviceId);
            } else if (p.deviceId && p.status === 'trusted') {
              volatileFrozenDeviceMasks.delete(p.deviceId);
            }
          }

          const outbound = JSON.stringify({
            type: 'relay:event',
            eventId:
              msg.eventId ||
              `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            channel: msg.channel,
            eventName: msg.eventName,
            payload: msg.payload,
            senderDeviceHash: msg.senderDeviceHash,
            sentAt: msg.sentAt || new Date().toISOString(),
          });

          broadcastToChannel(msg.channel, outbound, client);
        }
      } catch {
        // Ignore malformed frames
      }
    });

    ws.on('close', () => {
      removeClientFromAll(client);
    });

    ws.on('error', () => {
      removeClientFromAll(client);
    });
  });

  // Ephemeral RAM-only Invite Link Transit (zero disk / zero DB, purely for short 1-2 line URLs)
  app.post('/api/relay-ticket', (req, res) => {
    const body = req.body as { payload?: unknown; prefix?: unknown };
    const payload = typeof body?.payload === 'string' ? body.payload.trim() : '';
    const rawPrefix = typeof body?.prefix === 'string' ? body.prefix.replace(/[^A-Za-z]/g, '').slice(0, 1).toUpperCase() : 'T';
    const prefix = rawPrefix === 'Q' || rawPrefix === 'R' ? rawPrefix : 'T';
    if (!payload || payload.length > 220000) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }
    pruneExpiredTickets();
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let suffix = '';
    for (let i = 0; i < 6; i++) {
      suffix += chars[Math.floor(Math.random() * chars.length)];
    }
    const code = `${prefix}${suffix}`;
    volatileInviteTickets.set(code, {
      payload,
      expiresAt: Date.now() + TICKET_TTL_MS,
    });
    res.json({ code });
  });

  app.get('/api/relay-ticket/:code', (req, res) => {
    pruneExpiredTickets();
    const code = String(req.params.code || '').trim();
    const entry = volatileInviteTickets.get(code);
    if (!entry) {
      res.status(404).json({ error: 'Ticket expired or not found' });
      return;
    }
    res.json({ payload: entry.payload });
  });

  // Ephemeral RAM-only Title Room Transit (sync on entry via readable title slug, zero DB/disk)
  app.post('/api/invite-room', (req, res) => {
    const body = req.body as {
      kind?: unknown;
      slug?: unknown;
      title?: unknown;
      inviter?: unknown;
      snapshot?: unknown;
    };
    const kind = body?.kind === 'rt' ? 'rt' : body?.kind === 'trah' ? 'trah' : null;
    const rawSlug = typeof body?.slug === 'string' ? body.slug.trim().toLowerCase() : '';
    const canonicalSlug = rawSlug.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
    const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 120) : canonicalSlug;
    const inviter = typeof body?.inviter === 'string' ? body.inviter.trim().slice(0, 80) : 'WargaQu';
    const snapshot = typeof body?.snapshot === 'string' ? body.snapshot.trim() : '';

    if (!kind || !canonicalSlug || !snapshot || snapshot.length > 220000) {
      res.status(400).json({ error: 'Invalid room snapshot' });
      return;
    }

    pruneExpiredTickets();
    const roomKey = `${kind}:${canonicalSlug}`;
    const updatedAt = Date.now();
    volatileInviteRooms.set(roomKey, {
      kind,
      slug: canonicalSlug,
      title,
      inviter,
      snapshot,
      updatedAt,
      expiresAt: updatedAt + TICKET_TTL_MS,
    });
    res.json({ ok: true, roomKey, slug: canonicalSlug, updatedAt });
  });

  app.get('/api/invite-room/:kind/:slug', (req, res) => {
    pruneExpiredTickets();
    const kind = req.params.kind === 'rt' ? 'rt' : req.params.kind === 'trah' ? 'trah' : null;
    const canonicalSlug = String(req.params.slug || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64);
    if (!kind || !canonicalSlug) {
      res.status(400).json({ error: 'Invalid room key' });
      return;
    }
    const entry = volatileInviteRooms.get(`${kind}:${canonicalSlug}`);
    if (!entry) {
      res.status(404).json({ error: 'Room snapshot not active yet' });
      return;
    }
    res.json({
      found: true,
      kind: entry.kind,
      slug: entry.slug,
      title: entry.title,
      inviter: entry.inviter,
      snapshot: entry.snapshot,
      updatedAt: entry.updatedAt,
    });
  });

  // Ephemeral RAM-only active presence snapshot for Admin Zero Trust live monitoring
  app.get('/api/relay-presence', (_req, res) => {
    pruneExpiredPresence();
    res.json({
      mode: 'volatile-ram-only',
      connectedClients: clients.size,
      entries: Array.from(volatilePresenceMap.values()).map(v => v.data),
    });
  });

  app.post('/api/relay-presence', (req, res) => {
    const p = req.body as Record<string, unknown>;
    const key = typeof p?.accountKey === 'string' ? p.accountKey.trim() : '';
    if (!key) {
      res.status(400).json({ error: 'Invalid accountKey' });
      return;
    }
    pruneExpiredPresence();
    volatilePresenceMap.set(key, { data: p, lastSeenMs: Date.now() });
    res.json({ ok: true });
  });

  app.get('/api/relay-policy', (_req, res) => {
    res.json({
      accountPolicies: volatileAccountPolicies,
      monetizeRules: volatileMonetizeRules,
      frozenDeviceMasks: Array.from(volatileFrozenDeviceMasks),
    });
  });

  app.post('/api/relay-policy', (req, res) => {
    const body = req.body as { accountPolicies?: unknown };
    if (body?.accountPolicies && typeof body.accountPolicies === 'object') {
      volatileAccountPolicies = body.accountPolicies;
    }
    res.json({ ok: true });
  });

  // Lightweight health endpoint (zero citizen PII)
  app.get('/api/relay-health', (_req, res) => {
    pruneExpiredPresence();
    res.json({
      status: 'ok',
      mode: 'stateless-pass-through',
      citizenDatabaseStorage: 'none',
      connectedClients: clients.size,
      activeChannels: channelSubscribers.size,
      activeTransitTickets: volatileInviteTickets.size + volatileInviteRooms.size,
      activePresenceRamCount: volatilePresenceMap.size,
    });
  });

  const isProd = process.env.NODE_ENV === 'production';

  server.on('upgrade', (request, socket, head) => {
    try {
      const pathname = new URL(request.url || '/', 'http://localhost').pathname;
      if (pathname === '/ws-relay') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
        return;
      }
      if (isProd) {
        socket.destroy();
      }
    } catch {
      socket.destroy();
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        ws: {
          server,
        },
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[WargaQu Relay] Running stateless HTTP+WS server on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[WargaQu Relay] Failed to start server:', err);
  process.exit(1);
});

import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import { bidderAlias } from "./integrity.js";
import { LOT_FIELDS, serializeLot } from "./lots.js";

let io = null;
const presence = new Map();

export function countWatchers(lotId) {
  return presence.get(lotId)?.size ?? 0;
}

function broadcastPresence(lotId) {
  io?.to(`lot:${lotId}`)
    .to("showcase")
    .emit("lot:presence", { lot_id: lotId, watchers: countWatchers(lotId) });
}

function leaveLot(socket, lotId) {
  socket.leave(`lot:${lotId}`);
  presence.get(lotId)?.delete(socket.id);
  broadcastPresence(lotId);
}

export function initRealtime(httpServer) {
  io = new Server(httpServer);

  io.on("connection", (socket) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const { sub } = jwt.verify(token, config.jwtSecret);
        socket.join(`user:${sub}`);
      } catch {}
    }
    socket.data.lots = new Set();
    socket.on("lot:join", (lotId) => {
      if (!Number.isInteger(lotId)) return;
      socket.join(`lot:${lotId}`);
      socket.data.lots.add(lotId);
      if (!presence.has(lotId)) presence.set(lotId, new Set());
      presence.get(lotId).add(socket.id);
      broadcastPresence(lotId);
    });
    socket.on("lot:leave", (lotId) => {
      if (socket.data.lots.delete(lotId)) leaveLot(socket, lotId);
    });
    socket.on("disconnect", () => {
      for (const lotId of socket.data.lots) leaveLot(socket, lotId);
    });
    socket.on("showcase:join", () => socket.join("showcase"));
  });
}

export function emitToUser(userId, event, payload) {
  io?.to(`user:${userId}`).emit(event, payload);
}

export async function publishLotChange(lotId, extra = {}) {
  if (!io) return;
  const { rows } = await pool.query(
    `SELECT ${LOT_FIELDS} FROM lots WHERE id = $1`,
    [lotId],
  );
  if (!rows[0]) return;
  io.to(`lot:${lotId}`)
    .to("showcase")
    .emit("lot:update", {
      lot: serializeLot(rows[0]),
      server_time: new Date().toISOString(),
      ...extra,
    });
}

export function announceBid({ bid, extended, previousLeaderId }) {
  publishLotChange(bid.lot_id, {
    event: "bid",
    extended,
    bid: {
      seq: bid.seq,
      bidder: bidderAlias(bid.lot_id, bid.bidder_id),
      amount_cents: bid.amount_cents,
      placed_at: bid.placed_at,
    },
  }).catch((error) => console.error("Falha ao avisar o lance:", error.message));
  if (previousLeaderId && previousLeaderId !== bid.bidder_id) {
    emitToUser(previousLeaderId, "bid:outbid", {
      lot_id: bid.lot_id,
      amount_cents: bid.amount_cents,
    });
  }
}

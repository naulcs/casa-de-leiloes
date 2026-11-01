import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { api, getToken } from "../api.js";

export function rankBidders(bids) {
  const best = new Map();
  for (const bid of bids) {
    const current = best.get(bid.bidder);
    if (!current || bid.amount_cents > current.amount) {
      best.set(bid.bidder, { amount: bid.amount_cents, mine: bid.mine });
    }
  }
  return [...best.values()].sort((a, b) => b.amount - a.amount);
}

export function useLotRoom(id, userId) {
  const [lot, setLot] = useState(null);
  const [bids, setBids] = useState([]);
  const [isLeading, setIsLeading] = useState(false);
  const [hasBid, setHasBid] = useState(false);
  const [hasWithdrawn, setHasWithdrawn] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [watchers, setWatchers] = useState(0);
  const [clockOffset, setClockOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([api(`/lots/${id}`), api(`/lots/${id}/bids`)])
      .then(([lotData, bidsData]) => {
        if (!active) return;
        setLot(lotData.lot);
        setIsLeading(lotData.viewer.is_leader);
        setHasBid(lotData.viewer.has_bid);
        setHasWithdrawn(lotData.viewer.withdrawn);
        setWatchers(lotData.watchers);
        setReceipt(lotData.viewer.receipt_code);
        setClockOffset(Date.parse(lotData.server_time) - Date.now());
        setBids(bidsData.bids);
      })
      .catch((failure) => {
        if (active) setError(failure.message);
      });
    return () => {
      active = false;
    };
  }, [id, userId]);

  useEffect(() => {
    const socket = io({ auth: { token: getToken() } });
    const numericId = Number(id);

    function reloadBids() {
      api(`/lots/${id}/bids`).then((data) => setBids(data.bids));
    }

    socket.on("connect", () => socket.emit("lot:join", numericId));

    socket.on("lot:update", (data) => {
      if (data.lot.id !== numericId) return;
      setLot(data.lot);
      setClockOffset(Date.parse(data.server_time) - Date.now());
      if (data.event === "bid") {
        reloadBids();
        if (data.extended) {
          setNotice(
            "Lance nos últimos 2 minutos: o lote agora termina 2 minutos depois dele.",
          );
        }
      }
      if (data.event === "canceled") setNotice("Este lote foi cancelado.");
    });

    socket.on("bid:outbid", (data) => {
      if (data.lot_id === numericId) setIsLeading(false);
    });

    socket.on("lot:won", (data) => {
      if (data.lot_id !== numericId) return;
      setReceipt(data.receipt_code);
      setNotice("Parabéns, você ganhou este lote!");
    });

    socket.on("lot:presence", (data) => {
      if (data.lot_id === numericId) setWatchers(data.watchers);
    });

    return () => {
      socket.emit("lot:leave", numericId);
      socket.disconnect();
    };
  }, [id, userId]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function placeBid(amountCents) {
    setError("");
    try {
      const data = await api(`/lots/${id}/bids`, {
        method: "POST",
        body: { amount_cents: amountCents },
      });
      setLot(data.lot);
      setIsLeading(true);
      setHasBid(true);
      setNotice(
        data.extended
          ? "Lance aceito. O lote agora termina 2 minutos depois do seu lance."
          : "Lance aceito. Você está liderando.",
      );
      return true;
    } catch (failure) {
      setError(failure.message);
      return false;
    }
  }

  async function withdraw() {
    setError("");
    try {
      await api(`/lots/${id}/withdraw`, { method: "POST" });
      setHasWithdrawn(true);
      setNotice("Você desistiu deste lote.");
    } catch (failure) {
      setError(failure.message);
    }
  }

  return {
    lot,
    bids,
    isLeading,
    hasBid,
    hasWithdrawn,
    receipt,
    watchers,
    remaining: lot ? Date.parse(lot.ends_at) - (now + clockOffset) : 0,
    notice,
    error,
    placeBid,
    withdraw,
  };
}

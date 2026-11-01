import { useState } from "react";
import { formatCurrency, reaisToCents } from "../format.js";

export default function BidForm({ minimumCents, onBid }) {
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    const cents = reaisToCents(amount);
    if (!Number.isFinite(cents) || cents <= 0) {
      setError("Informe um valor válido.");
      return;
    }
    setSubmitting(true);
    if (await onBid(cents)) setAmount("");
    setSubmitting(false);
  }

  return (
    <form onSubmit={submit}>
      <label>
        Seu lance (R$)
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`mínimo ${formatCurrency(minimumCents)}`}
          inputMode="decimal"
        />
      </label>
      <button type="submit" disabled={submitting}>
        {submitting ? "Enviando..." : "Dar lance"}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}

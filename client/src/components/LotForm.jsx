import { useRef, useState } from "react";
import { api } from "../api.js";
import { reaisToCents } from "../format.js";

const EMPTY_FORM = { initial: "", increment: "", start: "", end: "" };

export default function LotForm({ ant, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const sending = useRef(false);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (sending.current) return;
    setError("");
    if (!form.end) {
      setError("Informe o fim do leilão.");
      return;
    }
    sending.current = true;
    setSubmitting(true);
    try {
      const data = await api("/lots", {
        method: "POST",
        body: {
          external_id: ant.external_id,
          starting_bid_cents: reaisToCents(form.initial),
          min_increment_cents: reaisToCents(form.increment),
          starts_at: form.start
            ? new Date(form.start).toISOString()
            : undefined,
          ends_at: new Date(form.end).toISOString(),
        },
      });
      setForm(EMPTY_FORM);
      onCreated(data.lot);
    } catch (failure) {
      setError(failure.message);
    } finally {
      sending.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <h3>Novo lote: {ant.title}</h3>
      <label>
        Lance inicial (R$)
        <input
          value={form.initial}
          onChange={(e) => updateField("initial", e.target.value)}
          inputMode="decimal"
        />
      </label>
      <label>
        Incremento mínimo (R$)
        <input
          value={form.increment}
          onChange={(e) => updateField("increment", e.target.value)}
          inputMode="decimal"
        />
      </label>
      <label>
        Início (opcional, padrão: agora)
        <input
          type="datetime-local"
          value={form.start}
          onChange={(e) => updateField("start", e.target.value)}
        />
      </label>
      <label>
        Fim
        <input
          type="datetime-local"
          value={form.end}
          onChange={(e) => updateField("end", e.target.value)}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Criando lote..." : "Criar lote"}
      </button>
    </form>
  );
}

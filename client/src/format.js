export function formatarReais(centavos) {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatarTempo(ms) {
  if (ms <= 0) return "00:00";
  const total = Math.floor(ms / 1000);
  const minutos = String(Math.floor(total / 60)).padStart(2, "0");
  const segundos = String(total % 60).padStart(2, "0");
  return `${minutos}:${segundos}`;
}

export function contarLances(quantidade) {
  return `${quantidade} ${quantidade === 1 ? "lance" : "lances"}`;
}

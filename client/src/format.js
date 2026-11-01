export function formatCurrency(cents) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatDuration(ms) {
  if (ms <= 0) return "00:00";
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const twoDigits = (value) => String(value).padStart(2, "0");
  if (days > 0) {
    return `${days}d ${twoDigits(hours)}h ${twoDigits(minutes)}min`;
  }
  if (hours > 0) {
    return `${twoDigits(hours)}:${twoDigits(minutes)}:${twoDigits(seconds)}`;
  }
  return `${twoDigits(minutes)}:${twoDigits(seconds)}`;
}

export function formatBidCount(count) {
  return `${count} ${count === 1 ? "lance" : "lances"}`;
}

export function reaisToCents(text) {
  return Math.round(Number(String(text).replace(",", ".")) * 100);
}

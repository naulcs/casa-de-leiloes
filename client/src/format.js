export function formatarReais(centavos) {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatarTempo(ms) {
  if (ms <= 0) return "00:00";
  const total = Math.floor(ms / 1000);
  const dias = Math.floor(total / 86400);
  const horas = Math.floor((total % 86400) / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundos = total % 60;
  const doisDigitos = (valor) => String(valor).padStart(2, "0");
  if (dias > 0) {
    return `${dias}d ${doisDigitos(horas)}h ${doisDigitos(minutos)}min`;
  }
  if (horas > 0) {
    return `${doisDigitos(horas)}:${doisDigitos(minutos)}:${doisDigitos(segundos)}`;
  }
  return `${doisDigitos(minutos)}:${doisDigitos(segundos)}`;
}

export function contarLances(quantidade) {
  return `${quantidade} ${quantidade === 1 ? "lance" : "lances"}`;
}

import { Children, cloneElement, useEffect, useRef, useState } from "react";

const INTERVALO = 2500;
const VISIVEIS = 5;

export default function Carrossel({ children }) {
  const itens = Children.toArray(children);
  const total = itens.length;
  const [atual, setAtual] = useState(0);
  const [pausado, setPausado] = useState(false);
  const toqueInicial = useRef(null);

  const destaque = total > 0 ? Math.min(atual, total - 1) : 0;
  const inicio = Math.max(0, Math.min(destaque - 1, total - VISIVEIS));

  useEffect(() => {
    if (pausado || total < 2) return;
    const timer = setInterval(() => {
      setAtual((valor) => (valor + 1) % total);
    }, INTERVALO);
    return () => clearInterval(timer);
  }, [pausado, total]);

  function irPara(destino) {
    setAtual(((destino % total) + total) % total);
  }

  function aoTocar(evento) {
    toqueInicial.current = evento.clientX;
  }

  function aoSoltar(evento) {
    if (toqueInicial.current === null) return;
    const distancia = evento.clientX - toqueInicial.current;
    toqueInicial.current = null;
    if (Math.abs(distancia) > 40) irPara(destaque + (distancia < 0 ? 1 : -1));
  }

  if (total === 0) return null;

  return (
    <div
      className="galeria"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onPointerDown={aoTocar}
      onPointerUp={aoSoltar}
    >
      <ul className="galeria-fileira">
        {itens.slice(inicio, inicio + VISIVEIS).map((item, posicao) => {
          const indice = inicio + posicao;
          const aberto = indice === destaque;
          return cloneElement(item, {
            className: `${item.props.className ?? ""} galeria-cartao${aberto ? " aberto" : ""}`,
            style: {
              "--numero": `"${String(indice + 1).padStart(2, "0")}"`,
            },
            onClickCapture: (evento) => {
              if (aberto) return;
              evento.preventDefault();
              evento.stopPropagation();
              irPara(indice);
            },
          });
        })}
      </ul>
      {total > 1 && (
        <div className="galeria-controles">
          <button
            type="button"
            onClick={() => irPara(destaque - 1)}
            aria-label="Anterior"
          >
            ‹
          </button>
          <span>
            {String(destaque + 1).padStart(2, "0")} /{" "}
            {String(total).padStart(2, "0")}
          </span>
          <button
            type="button"
            onClick={() => irPara(destaque + 1)}
            aria-label="Próximo"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}

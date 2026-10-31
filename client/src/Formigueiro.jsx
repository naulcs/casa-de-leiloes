import { useEffect, useRef } from "react";

const RAIO_DO_CURSOR = 90;

function lerCores() {
  return getComputedStyle(document.documentElement)
    .getPropertyValue("--formigas")
    .split(",")
    .map((cor) => cor.trim())
    .filter(Boolean);
}

function sortear(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

function criarNinhos(largura, altura) {
  return [
    { x: largura * 0.66, y: altura * 0.32, raio: largura * 0.11 },
    { x: largura * 0.86, y: altura * 0.58, raio: largura * 0.08 },
    { x: largura * 0.5, y: altura * 0.62, raio: largura * 0.06 },
    { x: largura * 0.78, y: altura * 0.16, raio: largura * 0.05 },
  ];
}

function criarFormigas(quantidade, ninhos, cores) {
  return Array.from({ length: quantidade }, () => {
    const destino = Math.floor(Math.random() * ninhos.length);
    const ninho = ninhos[destino];
    const angulo = Math.random() * Math.PI * 2;
    const distancia = Math.random() * ninho.raio;
    return {
      x: ninho.x + Math.cos(angulo) * distancia,
      y: ninho.y + Math.sin(angulo) * distancia,
      direcao: Math.random() * Math.PI * 2,
      velocidade: 0.35 + Math.random() * 0.75,
      destino,
      cor: sortear(cores),
      tamanho: 0.8 + Math.random() * 0.7,
    };
  });
}

function desenharFormiga(contexto, formiga) {
  contexto.save();
  contexto.translate(formiga.x, formiga.y);
  contexto.rotate(formiga.direcao);
  contexto.scale(formiga.tamanho, formiga.tamanho);
  contexto.fillStyle = formiga.cor;
  contexto.strokeStyle = formiga.cor;
  contexto.lineWidth = 0.5;
  contexto.beginPath();
  contexto.moveTo(-1.5, -2.6);
  contexto.lineTo(1.5, 2.6);
  contexto.moveTo(1.5, -2.6);
  contexto.lineTo(-1.5, 2.6);
  contexto.moveTo(0, -2.8);
  contexto.lineTo(0, 2.8);
  contexto.stroke();
  contexto.beginPath();
  contexto.ellipse(-3.2, 0, 2.2, 1.5, 0, 0, Math.PI * 2);
  contexto.ellipse(0, 0, 1.3, 0.9, 0, 0, Math.PI * 2);
  contexto.ellipse(2.4, 0, 1.2, 1.1, 0, 0, Math.PI * 2);
  contexto.fill();
  contexto.restore();
}

export default function Formigueiro() {
  const tela = useRef(null);

  useEffect(() => {
    const canvas = tela.current;
    const contexto = canvas.getContext("2d");
    const area = canvas.parentElement;
    const reduzido = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const cursor = { x: -9999, y: -9999 };
    let largura = 0;
    let altura = 0;
    let ninhos = [];
    let formigas = [];
    let quadro = 0;

    function mover(formiga) {
      const ninho = ninhos[formiga.destino];
      const dx = ninho.x - formiga.x;
      const dy = ninho.y - formiga.y;
      let alvo = Math.atan2(dy, dx);
      let velocidade = formiga.velocidade;

      if (Math.hypot(dx, dy) < ninho.raio) {
        alvo = formiga.direcao + (Math.random() - 0.5) * 1.2;
        if (Math.random() < 0.003) {
          formiga.destino = Math.floor(Math.random() * ninhos.length);
        }
      }

      const fx = formiga.x - cursor.x;
      const fy = formiga.y - cursor.y;
      if (Math.hypot(fx, fy) < RAIO_DO_CURSOR) {
        alvo = Math.atan2(fy, fx);
        velocidade *= 3;
      }

      const diferenca = Math.atan2(
        Math.sin(alvo - formiga.direcao),
        Math.cos(alvo - formiga.direcao),
      );
      formiga.direcao += diferenca * 0.12 + (Math.random() - 0.5) * 0.25;
      formiga.x += Math.cos(formiga.direcao) * velocidade;
      formiga.y += Math.sin(formiga.direcao) * velocidade;
    }

    function desenhar() {
      contexto.clearRect(0, 0, largura, altura);
      for (const formiga of formigas) {
        if (!reduzido) mover(formiga);
        desenharFormiga(contexto, formiga);
      }
    }

    function animar() {
      desenhar();
      quadro = requestAnimationFrame(animar);
    }

    function preparar() {
      const escala = window.devicePixelRatio || 1;
      largura = canvas.clientWidth;
      altura = canvas.clientHeight;
      canvas.width = largura * escala;
      canvas.height = altura * escala;
      contexto.setTransform(escala, 0, 0, escala, 0, 0);
      ninhos = criarNinhos(largura, altura);
      const quantidade = Math.round(Math.min(520, (largura * altura) / 1600));
      formigas = criarFormigas(quantidade, ninhos, lerCores());
      if (reduzido) desenhar();
    }

    function aoMoverCursor(evento) {
      const caixa = canvas.getBoundingClientRect();
      cursor.x = evento.clientX - caixa.left;
      cursor.y = evento.clientY - caixa.top;
    }

    function aoSairCursor() {
      cursor.x = -9999;
      cursor.y = -9999;
    }

    function trocarCores() {
      const cores = lerCores();
      for (const formiga of formigas) formiga.cor = sortear(cores);
      if (reduzido) desenhar();
    }

    const observador = new MutationObserver(trocarCores);
    observador.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-tema"],
    });

    preparar();
    if (!reduzido) animar();
    window.addEventListener("resize", preparar);
    area.addEventListener("pointermove", aoMoverCursor);
    area.addEventListener("pointerleave", aoSairCursor);

    return () => {
      cancelAnimationFrame(quadro);
      observador.disconnect();
      window.removeEventListener("resize", preparar);
      area.removeEventListener("pointermove", aoMoverCursor);
      area.removeEventListener("pointerleave", aoSairCursor);
    };
  }, []);

  return <canvas ref={tela} className="formigueiro" aria-hidden="true" />;
}

import { useEffect, useRef } from "react";
import * as THREE from "three";

const FRENTE = -Math.PI / 2;

function haste(inicio, fim, raio, material) {
  const direcao = new THREE.Vector3().subVectors(fim, inicio);
  const malha = new THREE.Mesh(
    new THREE.CylinderGeometry(raio, raio * 0.7, direcao.length(), 10),
    material,
  );
  malha.position.copy(inicio).addScaledVector(direcao, 0.5);
  malha.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direcao.clone().normalize(),
  );
  return malha;
}

function criarFormiga(material) {
  const formiga = new THREE.Group();

  function parte(raio, escala, x, y) {
    const malha = new THREE.Mesh(
      new THREE.SphereGeometry(raio, 32, 24),
      material,
    );
    malha.scale.set(...escala);
    malha.position.set(x, y, 0);
    formiga.add(malha);
  }

  parte(0.55, [1.35, 0.95, 1], -1.15, 0.1);
  parte(0.16, [1, 1, 1], -0.42, 0.02);
  parte(0.32, [1.6, 0.85, 0.85], 0.05, 0.05);
  parte(0.34, [1.05, 0.95, 1], 0.72, 0.12);

  for (const [x, abertura] of [
    [-0.15, -0.7],
    [0.05, 0],
    [0.25, 0.6],
  ]) {
    for (const lado of [-1, 1]) {
      const base = new THREE.Vector3(x, -0.05, 0.2 * lado);
      const joelho = new THREE.Vector3(x + abertura * 0.5, 0.35, 0.75 * lado);
      const pe = new THREE.Vector3(x + abertura, -0.55, 1.05 * lado);
      formiga.add(haste(base, joelho, 0.05, material));
      formiga.add(haste(joelho, pe, 0.04, material));
    }
  }

  for (const lado of [-1, 1]) {
    const base = new THREE.Vector3(0.95, 0.35, 0.12 * lado);
    const curva = new THREE.Vector3(1.25, 0.85, 0.35 * lado);
    const ponta = new THREE.Vector3(1.75, 0.75, 0.55 * lado);
    formiga.add(haste(base, curva, 0.03, material));
    formiga.add(haste(curva, ponta, 0.025, material));
  }

  formiga.position.x = 0.1;
  const pivo = new THREE.Group();
  pivo.add(formiga);
  pivo.scale.setScalar(0.72);
  return pivo;
}

export default function Formiga3D({ tamanho = 64 }) {
  const tela = useRef(null);

  useEffect(() => {
    let renderizador;
    try {
      renderizador = new THREE.WebGLRenderer({
        canvas: tela.current,
        alpha: true,
        antialias: true,
      });
    } catch {
      return;
    }
    renderizador.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderizador.setSize(tamanho, tamanho, false);

    const cena = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    camera.position.set(0, 1.3, 5.2);
    camera.lookAt(0, 0, 0);

    cena.add(new THREE.AmbientLight(0xffffff, 0.6));
    const luz = new THREE.DirectionalLight(0xffe2c0, 2.2);
    luz.position.set(3, 4, 5);
    cena.add(luz);
    const contraLuz = new THREE.DirectionalLight(0xe0a84a, 1.2);
    contraLuz.position.set(-4, 2, -3);
    cena.add(contraLuz);

    const material = new THREE.MeshStandardMaterial({
      color: 0x4a2412,
      roughness: 0.35,
      metalness: 0.1,
    });
    const formiga = criarFormiga(material);
    cena.add(formiga);

    const reduzido = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const area = tela.current.parentElement ?? tela.current;
    let quadro = 0;
    let girando = false;
    formiga.rotation.y = FRENTE;

    function animar() {
      if (girando) {
        formiga.rotation.y += 0.015;
      } else {
        const diferenca = Math.atan2(
          Math.sin(FRENTE - formiga.rotation.y),
          Math.cos(FRENTE - formiga.rotation.y),
        );
        formiga.rotation.y += diferenca * 0.12;
      }
      renderizador.render(cena, camera);
      quadro = requestAnimationFrame(animar);
    }

    function aoEntrar() {
      girando = true;
    }

    function aoSair() {
      girando = false;
    }

    renderizador.render(cena, camera);
    if (!reduzido) {
      quadro = requestAnimationFrame(animar);
      area.addEventListener("pointerenter", aoEntrar);
      area.addEventListener("pointerleave", aoSair);
    }

    return () => {
      cancelAnimationFrame(quadro);
      area.removeEventListener("pointerenter", aoEntrar);
      area.removeEventListener("pointerleave", aoSair);
      formiga.traverse((objeto) => objeto.geometry?.dispose());
      material.dispose();
      renderizador.dispose();
    };
  }, [tamanho]);

  return (
    <canvas
      ref={tela}
      className="formiga-3d"
      width={tamanho}
      height={tamanho}
      style={{ width: tamanho, height: tamanho }}
      aria-hidden="true"
    />
  );
}

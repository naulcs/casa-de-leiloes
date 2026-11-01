import { useEffect, useRef } from "react";
import * as THREE from "three";

const FRONT = -Math.PI / 2;

function segment(start, end, radius, material) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 0.7, direction.length(), 10),
    material,
  );
  mesh.position.copy(start).addScaledVector(direction, 0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize(),
  );
  return mesh;
}

function createAnt(material) {
  const ant = new THREE.Group();

  function part(radius, scale, x, y) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 32, 24),
      material,
    );
    mesh.scale.set(...scale);
    mesh.position.set(x, y, 0);
    ant.add(mesh);
  }

  part(0.55, [1.35, 0.95, 1], -1.15, 0.1);
  part(0.16, [1, 1, 1], -0.42, 0.02);
  part(0.32, [1.6, 0.85, 0.85], 0.05, 0.05);
  part(0.34, [1.05, 0.95, 1], 0.72, 0.12);

  for (const [x, spread] of [
    [-0.15, -0.7],
    [0.05, 0],
    [0.25, 0.6],
  ]) {
    for (const side of [-1, 1]) {
      const base = new THREE.Vector3(x, -0.05, 0.2 * side);
      const knee = new THREE.Vector3(x + spread * 0.5, 0.35, 0.75 * side);
      const foot = new THREE.Vector3(x + spread, -0.55, 1.05 * side);
      ant.add(segment(base, knee, 0.05, material));
      ant.add(segment(knee, foot, 0.04, material));
    }
  }

  for (const side of [-1, 1]) {
    const base = new THREE.Vector3(0.95, 0.35, 0.12 * side);
    const curve = new THREE.Vector3(1.25, 0.85, 0.35 * side);
    const tip = new THREE.Vector3(1.75, 0.75, 0.55 * side);
    ant.add(segment(base, curve, 0.03, material));
    ant.add(segment(curve, tip, 0.025, material));
  }

  ant.position.x = 0.1;
  const pivot = new THREE.Group();
  pivot.add(ant);
  pivot.scale.setScalar(0.72);
  return pivot;
}

export default function Ant3D({ size = 64 }) {
  const mountRef = useRef(null);

  useEffect(() => {
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: mountRef.current,
        alpha: true,
        antialias: true,
      });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(size, size, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    camera.position.set(0, 1.3, 5.2);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const light = new THREE.DirectionalLight(0xffe2c0, 2.2);
    light.position.set(3, 4, 5);
    scene.add(light);
    const backLight = new THREE.DirectionalLight(0xe0a84a, 1.2);
    backLight.position.set(-4, 2, -3);
    scene.add(backLight);

    const material = new THREE.MeshStandardMaterial({
      color: 0x4a2412,
      roughness: 0.35,
      metalness: 0.1,
    });
    const ant = createAnt(material);
    scene.add(ant);

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const area = mountRef.current.parentElement ?? mountRef.current;
    let frame = 0;
    let spinning = false;
    ant.rotation.y = FRONT;

    function animate() {
      if (spinning) {
        ant.rotation.y += 0.015;
      } else {
        const difference = Math.atan2(
          Math.sin(FRONT - ant.rotation.y),
          Math.cos(FRONT - ant.rotation.y),
        );
        ant.rotation.y += difference * 0.12;
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    }

    function handleEnter() {
      spinning = true;
    }

    function handleLeave() {
      spinning = false;
    }

    renderer.render(scene, camera);
    if (!reducedMotion) {
      frame = requestAnimationFrame(animate);
      area.addEventListener("pointerenter", handleEnter);
      area.addEventListener("pointerleave", handleLeave);
    }

    return () => {
      cancelAnimationFrame(frame);
      area.removeEventListener("pointerenter", handleEnter);
      area.removeEventListener("pointerleave", handleLeave);
      ant.traverse((child) => child.geometry?.dispose());
      material.dispose();
      renderer.dispose();
    };
  }, [size]);

  return (
    <canvas
      ref={mountRef}
      className="ant-3d"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

import { useEffect, useRef } from "react";

const CURSOR_RADIUS = 90;

function readColors() {
  return getComputedStyle(document.documentElement)
    .getPropertyValue("--ant-colors")
    .split(",")
    .map((color) => color.trim())
    .filter(Boolean);
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function createNests(width, height) {
  return [
    { x: width * 0.66, y: height * 0.32, radius: width * 0.11 },
    { x: width * 0.86, y: height * 0.58, radius: width * 0.08 },
    { x: width * 0.5, y: height * 0.62, radius: width * 0.06 },
    { x: width * 0.78, y: height * 0.16, radius: width * 0.05 },
  ];
}

function createAnts(count, nests, colors) {
  return Array.from({ length: count }, () => {
    const destination = Math.floor(Math.random() * nests.length);
    const nest = nests[destination];
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * nest.radius;
    return {
      x: nest.x + Math.cos(angle) * distance,
      y: nest.y + Math.sin(angle) * distance,
      direction: Math.random() * Math.PI * 2,
      speed: 0.35 + Math.random() * 0.75,
      destination,
      color: pickRandom(colors),
      size: 0.8 + Math.random() * 0.7,
    };
  });
}

function drawAnt(context, ant) {
  context.save();
  context.translate(ant.x, ant.y);
  context.rotate(ant.direction);
  context.scale(ant.size, ant.size);
  context.fillStyle = ant.color;
  context.strokeStyle = ant.color;
  context.lineWidth = 0.5;
  context.beginPath();
  context.moveTo(-1.5, -2.6);
  context.lineTo(1.5, 2.6);
  context.moveTo(1.5, -2.6);
  context.lineTo(-1.5, 2.6);
  context.moveTo(0, -2.8);
  context.lineTo(0, 2.8);
  context.stroke();
  context.beginPath();
  context.ellipse(-3.2, 0, 2.2, 1.5, 0, 0, Math.PI * 2);
  context.ellipse(0, 0, 1.3, 0.9, 0, 0, Math.PI * 2);
  context.ellipse(2.4, 0, 1.2, 1.1, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

export default function AntColony() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const area = canvas.parentElement;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const cursor = { x: -9999, y: -9999 };
    let width = 0;
    let height = 0;
    let nests = [];
    let ants = [];
    let frame = 0;

    function move(ant) {
      const nest = nests[ant.destination];
      const dx = nest.x - ant.x;
      const dy = nest.y - ant.y;
      let target = Math.atan2(dy, dx);
      let speed = ant.speed;

      if (Math.hypot(dx, dy) < nest.radius) {
        target = ant.direction + (Math.random() - 0.5) * 1.2;
        if (Math.random() < 0.003) {
          ant.destination = Math.floor(Math.random() * nests.length);
        }
      }

      const fx = ant.x - cursor.x;
      const fy = ant.y - cursor.y;
      if (Math.hypot(fx, fy) < CURSOR_RADIUS) {
        target = Math.atan2(fy, fx);
        speed *= 3;
      }

      const difference = Math.atan2(
        Math.sin(target - ant.direction),
        Math.cos(target - ant.direction),
      );
      ant.direction += difference * 0.12 + (Math.random() - 0.5) * 0.25;
      ant.x += Math.cos(ant.direction) * speed;
      ant.y += Math.sin(ant.direction) * speed;
    }

    function draw() {
      context.clearRect(0, 0, width, height);
      for (const ant of ants) {
        if (!reducedMotion) move(ant);
        drawAnt(context, ant);
      }
    }

    function animate() {
      draw();
      frame = requestAnimationFrame(animate);
    }

    function setup() {
      const scale = window.devicePixelRatio || 1;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * scale;
      canvas.height = height * scale;
      context.setTransform(scale, 0, 0, scale, 0, 0);
      nests = createNests(width, height);
      const count = Math.round(Math.min(520, (width * height) / 1600));
      ants = createAnts(count, nests, readColors());
      if (reducedMotion) draw();
    }

    function handlePointerMove(event) {
      const box = canvas.getBoundingClientRect();
      cursor.x = event.clientX - box.left;
      cursor.y = event.clientY - box.top;
    }

    function handlePointerLeave() {
      cursor.x = -9999;
      cursor.y = -9999;
    }

    function applyColors() {
      const colors = readColors();
      for (const ant of ants) ant.color = pickRandom(colors);
      if (reducedMotion) draw();
    }

    const observer = new MutationObserver(applyColors);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    setup();
    if (!reducedMotion) animate();
    window.addEventListener("resize", setup);
    area.addEventListener("pointermove", handlePointerMove);
    area.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", setup);
      area.removeEventListener("pointermove", handlePointerMove);
      area.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="ant-colony" aria-hidden="true" />;
}

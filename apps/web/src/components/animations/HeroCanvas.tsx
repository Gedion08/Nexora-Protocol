"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseSize: number;
  opacity: number;
  baseOpacity: number;
  layer: number;
  pulseOffset: number;
}

export function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: e.clientX / window.innerWidth - 0.5,
        y: e.clientY / window.innerHeight - 0.5,
        active: true,
      };
    };
    window.addEventListener("mousemove", handleMouseMove);

    const particles: Particle[] = [];
    const layerConfigs = [
      { count: 40, sizeRange: [0.5, 1.2], opacityRange: [0.08, 0.2], speed: 0.15 },
      { count: 25, sizeRange: [1, 2], opacityRange: [0.15, 0.35], speed: 0.3 },
      { count: 12, sizeRange: [2, 4], opacityRange: [0.2, 0.5], speed: 0.5 },
    ];

    layerConfigs.forEach((config, layerIndex) => {
      for (let i = 0; i < config.count; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * config.speed,
          vy: (Math.random() - 0.5) * config.speed,
          size: config.sizeRange[0] + Math.random() * (config.sizeRange[1] - config.sizeRange[0]),
          baseSize: 0,
          opacity: config.opacityRange[0] + Math.random() * (config.opacityRange[1] - config.opacityRange[0]),
          baseOpacity: 0,
          layer: layerIndex,
          pulseOffset: Math.random() * Math.PI * 2,
        });
        particles[particles.length - 1].baseSize = particles[particles.length - 1].size;
        particles[particles.length - 1].baseOpacity = particles[particles.length - 1].opacity;
      }
    });

    let animationId: number;
    let time = 0;

    const animate = () => {
      time += 0.003;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const mouseInfluence = mouseRef.current.active ? 0.02 : 0;

      particles.forEach((p) => {
        const flowX = Math.sin(time + p.y * 0.003 + p.pulseOffset) * 0.3;
        const flowY = Math.cos(time + p.x * 0.003 + p.pulseOffset) * 0.3;

        p.x += p.vx + flowX + (mouseRef.current.active ? mouseRef.current.x * mouseInfluence * (p.layer + 1) : 0);
        p.y += p.vy + flowY + (mouseRef.current.active ? mouseRef.current.y * mouseInfluence * (p.layer + 1) : 0);

        if (p.x < -50) p.x = canvas.width + 50;
        if (p.x > canvas.width + 50) p.x = -50;
        if (p.y < -50) p.y = canvas.height + 50;
        if (p.y > canvas.height + 50) p.y = -50;

        const pulse = Math.sin(time * 2 + p.pulseOffset) * 0.3 + 0.7;
        p.size = p.baseSize * pulse;
        p.opacity = p.baseOpacity * pulse;

        const alpha = Math.min(1, Math.max(0, p.opacity));
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
        gradient.addColorStop(0, `rgba(59, 130, 246, ${alpha})`);
        gradient.addColorStop(0.5, `rgba(59, 130, 246, ${alpha * 0.3})`);
        gradient.addColorStop(1, "rgba(59, 130, 246, 0)");

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      });

      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 120 + p1.layer * 30;

          if (dist < maxDist) {
            const opacity = 0.08 * (1 - dist / maxDist) * (p1.opacity + p2.opacity);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(59, 130, 246, ${Math.min(opacity, 0.25)})`;
            ctx.lineWidth = 0.4 + (p1.layer + p2.layer) * 0.15;
            ctx.stroke();
          }
        }
      }
      ctx.globalCompositeOperation = "source-over";

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full opacity-60"
      style={{ pointerEvents: "none" }}
    />
  );
}

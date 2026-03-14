import { useEffect, useRef } from "react";
import venconLogo from "@/assets/vencon-logo.png";

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  rotation: number;
  rotationSpeed: number;
  shape: "circle" | "square" | "triangle" | "line" | "logo";
}

const LoginBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const animFrameRef = useRef<number>(0);
  const logoImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Load logo image
    const logoImg = new Image();
    logoImg.src = venconLogo;
    logoImgRef.current = logoImg;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Create particles — every 5th one is a logo
    const count = Math.floor((window.innerWidth * window.innerHeight) / 25000);
    particlesRef.current = Array.from({ length: Math.min(count, 40) }, (_, i) => {
      const isLogo = i % 5 === 0;
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: isLogo ? Math.random() * 30 + 28 : Math.random() * 30 + 12,
        speedX: (Math.random() - 0.5) * 0.6,
        speedY: (Math.random() - 0.5) * 0.6,
        opacity: isLogo ? Math.random() * 0.15 + 0.06 : Math.random() * 0.25 + 0.08,
        rotation: isLogo ? 0 : Math.random() * Math.PI * 2,
        rotationSpeed: isLogo ? (Math.random() - 0.5) * 0.003 : (Math.random() - 0.5) * 0.008,
        shape: isLogo ? "logo" as const : (["circle", "square", "triangle", "line"] as const)[Math.floor(Math.random() * 4)],
      };
    });

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);

    const isDark = () => document.documentElement.classList.contains("dark");

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const dark = isDark();
      const baseColor = dark ? "234, 88, 12" : "234, 88, 12";

      particlesRef.current.forEach((p) => {
        // Mouse repulsion
        const dx = p.x - mouseRef.current.x;
        const dy = p.y - mouseRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          const force = (150 - dist) / 150;
          p.x += (dx / dist) * force * 1.5;
          p.y += (dy / dist) * force * 1.5;
        }

        p.x += p.speedX;
        p.y += p.speedY;
        p.rotation += p.rotationSpeed;

        // Wrap around
        if (p.x < -50) p.x = canvas.width + 50;
        if (p.x > canvas.width + 50) p.x = -50;
        if (p.y < -50) p.y = canvas.height + 50;
        if (p.y > canvas.height + 50) p.y = -50;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        if (p.shape === "logo" && logoImgRef.current?.complete) {
          ctx.globalAlpha = p.opacity * 3;
          ctx.drawImage(logoImgRef.current, -p.size / 2, -p.size / 2, p.size, p.size);
        } else if (p.shape !== "logo") {
          ctx.globalAlpha = p.opacity * 2.5;
          const color = `rgba(${baseColor}, ${p.opacity})`;
          ctx.fillStyle = color;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;

          switch (p.shape) {
            case "circle":
              ctx.beginPath();
              ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
              ctx.fill();
              break;
            case "square":
              ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
              break;
            case "triangle":
              ctx.beginPath();
              ctx.moveTo(0, -p.size / 2);
              ctx.lineTo(p.size / 2, p.size / 2);
              ctx.lineTo(-p.size / 2, p.size / 2);
              ctx.closePath();
              ctx.fill();
              break;
            case "line":
              ctx.beginPath();
              ctx.moveTo(-p.size, 0);
              ctx.lineTo(p.size, 0);
              ctx.stroke();
              break;
          }
        }

        ctx.restore();
      });

      // Draw connecting lines between nearby particles
      const particles = particlesRef.current;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx2 = particles[i].x - particles[j].x;
          const dy2 = particles[i].y - particles[j].y;
          const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          if (dist2 < 200) {
            const opacity = ((200 - dist2) / 200) * 0.15;
            ctx.strokeStyle = `rgba(${baseColor}, ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 1 }}
    />
  );
};

export default LoginBackground;

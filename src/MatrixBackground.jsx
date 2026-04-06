import React, { useEffect, useRef } from 'react';

export default function MatrixBackground({ theme }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (theme !== 'matrix') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let animationFrameId;
    let drops = [];
    const fontSize = 16;
    const chars = "0123456789ABCDEFHIJKLMNOPQRSTUVWXYZアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン";
    const colors = ["#00ff41", "#00e5ff", "#ff0055", "#b800ff", "#ffff00", "#175bdf", "#f43f5e", "#10b981"];

    const initCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const columns = Math.floor(canvas.width / fontSize);
      drops = Array(columns).fill(1);
    };

    initCanvas();
    window.addEventListener('resize', initCanvas);

    // Frame rate control
    let lastTime = 0;
    const fps = 25;
    const interval = 1000 / fps;

    const draw = (time) => {
      animationFrameId = requestAnimationFrame(draw);
      
      const deltaTime = time - lastTime;
      if (deltaTime < interval) return;
      lastTime = time - (deltaTime % interval);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      drops.forEach((y, i) => {
        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
        ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
        const char = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(char, i * fontSize, y * fontSize);
        
        if (y * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      });
    };

    animationFrameId = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', initCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme]);

  // Always render canvas, CSS hides it if not matrix theme
  return <canvas id="matrix-bg" ref={canvasRef} />;
}

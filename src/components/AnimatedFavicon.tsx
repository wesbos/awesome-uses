import { useEffect, useRef } from 'react';

const LETTERS = [...'/USES!💩'];

export default function AnimatedFavicon() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let index = 0;
    const timer = window.setInterval(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext('2d');
      if (!context) return;

      const letter = LETTERS[index];
      index = index >= LETTERS.length - 1 ? 0 : index + 1;

      context.fillStyle = '#203447';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#ffc600';
      context.font = '310px monospace';
      context.fillText(letter, 10, canvas.height - 10);

      const data = canvas.toDataURL('image/png');
      const link = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
      if (link) {
        link.type = 'image/x-icon';
        link.href = data;
      }
    }, 350);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={200}
      hidden
      aria-hidden
      style={{ display: 'none' }}
    />
  );
}

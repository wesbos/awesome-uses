import React, { useEffect, useState, useRef } from 'react';

function useInterval(callback, delay) {
  const savedCallback = useRef();

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  useEffect(() => {
    function tick() {
      savedCallback.current();
    }
    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

function useWickedFavIcon() {
  const letters = [...'/USES!💩'];
  const [index, setIndex] = useState(0);
  const canvasRef = useRef(0);
  useInterval(() => {
    setIndex(index >= letters.length - 1 ? 0 : index + 1);
    const letter = letters[index];
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#203447';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffc600';
    ctx.font = `310px monospace`;
    ctx.fillText(letter, 10, canvas.height - 10);
    const data = canvas.toDataURL('image/png');

    const link = document.querySelector("link[rel*='icon']");
    link.type = 'image/x-icon';
    link.href = data;
  }, 350);
  return { letter: letters[index], index, canvasRef };
}

export default function FavIcon() {
  const { /* letter, index, */ canvasRef } = useWickedFavIcon();
  return (
    <div>
      <canvas
        style={{ border: '1px solid yellow' }}
        ref={canvasRef}
        width="200"
        height="200"
        hidden
      ></canvas>
    </div>
  );
}

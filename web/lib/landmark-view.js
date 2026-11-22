import { FACE_POINTS } from './signal.js';

export function drawLandmarks(canvas, points) {
 if (!canvas || !Array.isArray(points)) return;
 const ctx = canvas.getContext('2d');
 ctx.clearRect(0, 0, canvas.width, canvas.height);
 ctx.fillStyle = '#a4c2ef80';
 ctx.beginPath();
 for (const p of points) {
  ctx.moveTo(p.x + 1.25, p.y);
  ctx.arc(p.x, p.y, 1.25, 0, Math.PI * 2);
 }
 ctx.fill();
 ctx.strokeStyle = '#dceda8';
 ctx.lineWidth = 3;
 for (const ids of [FACE_POINTS.rightBrow, FACE_POINTS.leftBrow]) {
  ctx.beginPath();
  ids.forEach((i, n) => {
   const p = points[i];
   n ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
  });
  ctx.stroke();
 }
}

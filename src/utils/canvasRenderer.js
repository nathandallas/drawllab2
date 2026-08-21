import rough from "roughjs/bundled/rough.esm";
import { drawElement } from "./elements";
import { getBounds } from "../tools/shared";
import { ROTATE_HANDLE_OFFSET, ROTATE_HANDLE_RADIUS } from "./constants/canvas";

export const renderCanvas = (canvas, { elements, viewport, marquee, fadingIds, worldWidth, worldHeight, showRotateHandle }) => {
  if (!canvas) return;

  const context = canvas.getContext("2d");
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#e8e8ea";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.setTransform(viewport.zoom, 0, 0, viewport.zoom, viewport.panX, viewport.panY);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, worldWidth, worldHeight);
  context.strokeStyle = "#bbbbbb";
  context.lineWidth = 2 / viewport.zoom;
  context.strokeRect(0, 0, worldWidth, worldHeight);

  const roughCanvas = rough.canvas(canvas);
  elements.forEach(element => {
    const display = fadingIds.has(element.id) ? { ...element, opacity: 0.5 } : element;
    drawElement(roughCanvas, context, display);
  });

  if (marquee) {
    context.save();
    context.strokeStyle = "#4a90d9";
    context.lineWidth = 1 / viewport.zoom;
    context.setLineDash([4 / viewport.zoom, 3 / viewport.zoom]);
    const { x, y, w, h } = getBounds(marquee);
    if (marquee.isDragging) {
      context.fillStyle = "rgba(74, 144, 217, 0.08)";
      context.fillRect(x, y, w, h);
    }
    context.strokeRect(x, y, w, h);

    if (showRotateHandle && !marquee.isDragging) {
      const hx = x + w / 2;
      const hy = y - ROTATE_HANDLE_OFFSET / viewport.zoom;
      context.setLineDash([]);
      context.beginPath();
      context.moveTo(hx, y);
      context.lineTo(hx, hy);
      context.stroke();
      context.beginPath();
      context.arc(hx, hy, ROTATE_HANDLE_RADIUS / viewport.zoom, 0, Math.PI * 2);
      context.fillStyle = "#ffffff";
      context.fill();
      context.stroke();
    }
    context.restore();
  }
};

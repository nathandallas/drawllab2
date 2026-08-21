import { getElementCenter, rotatePoint } from "../utils/geometry";

const fadingIds = new Set();

const ERASER_RADIUS = 12;

const distToSegment = (px, py, x1, y1, x2, y2) => {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
};

// check if within eraser radius of element 
const hitTest = (el, x, y) => {
  if (el.angle) {
    const { x: cx, y: cy } = getElementCenter(el);
    ({ x, y } = rotatePoint(x, y, cx, cy, -el.angle));
  }
  if (el.type === "pen") {
    if (!el.points?.length) return false;
    if (el.points.length === 1)
      return Math.hypot(x - el.points[0].x, y - el.points[0].y) <= ERASER_RADIUS;
    for (let i = 0; i < el.points.length - 1; i++) {
      if (distToSegment(x, y, el.points[i].x, el.points[i].y, el.points[i + 1].x, el.points[i + 1].y) <= ERASER_RADIUS)
        return true;
    }
    return false;
  }
  if (el.type === "line") {
    return distToSegment(x, y, el.x1, el.y1, el.x2, el.y2) <= ERASER_RADIUS;
  }
  return (
    x >= Math.min(el.x1, el.x2) && x <= Math.max(el.x1, el.x2) &&
    y >= Math.min(el.y1, el.y2) && y <= Math.max(el.y1, el.y2)
  );
};

// erase the top-most element under the cursor
const eraseAtPoint = ({ elements, setElements, setFadingIds }, clientX, clientY) => {
  const hit = [...elements].reverse().find(el => !fadingIds.has(el.id) && hitTest(el, clientX, clientY));
  if (!hit) return;

  fadingIds.add(hit.id);
  setFadingIds(prev => {
    const next = new Set(prev);
    next.add(hit.id);
    return next;
  });

  setTimeout(() => {
    setElements(prev => prev.filter(el => el.id !== hit.id));
    fadingIds.delete(hit.id);
    setFadingIds(prev => {
      const next = new Set(prev);
      next.delete(hit.id);
      return next;
    });
  }, 250);
};

// erase on mousedown
export const onMouseDown = (ctx, clientX, clientY) => {
  ctx.setAction("erase");
  eraseAtPoint(ctx, clientX, clientY);
};

// continuous erase
export const onMouseMove = (ctx, clientX, clientY) => {
  if (ctx.action !== "erase") return;
  eraseAtPoint(ctx, clientX, clientY);
};

export const getCursor = () => "cell";

export const onMouseUp = () => {};

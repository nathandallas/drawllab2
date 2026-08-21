import { nearPoint, computeSelectionBBox, getElementCenter } from "../utils/geometry";
import { ROTATE_HANDLE_OFFSET, ROTATE_HIT_RADIUS } from "../utils/constants/canvas";

export const getBounds = ({ x1, y1, x2, y2 }) => ({
  x: Math.min(x1, x2),
  y: Math.min(y1, y2),
  w: Math.abs(x2 - x1),
  h: Math.abs(y2 - y1),
});

export const isInsideBounds = ({ x1, y1, x2, y2 }, clientX, clientY) =>
  clientX >= Math.min(x1, x2) &&
  clientX <= Math.max(x1, x2) &&
  clientY >= Math.min(y1, y2) &&
  clientY <= Math.max(y1, y2);

// decide whether a marquee click starts resize
export const cornerHit = (bbox, clientX, clientY) =>
  nearPoint(clientX, clientY, bbox.x1, bbox.y1, "tl") ||
  nearPoint(clientX, clientY, bbox.x2, bbox.y1, "tr") ||
  nearPoint(clientX, clientY, bbox.x1, bbox.y2, "bl") ||
  nearPoint(clientX, clientY, bbox.x2, bbox.y2, "br");

export const rotateHandleHit = (marquee, clientX, clientY, zoom) => {
  const b = getBounds(marquee);
  const hx = b.x + b.w / 2;
  const hy = b.y - ROTATE_HANDLE_OFFSET / zoom;
  return Math.hypot(clientX - hx, clientY - hy) <= ROTATE_HIT_RADIUS / zoom;
};


export const tryBeginRotate = (ctx, clientX, clientY) => {
  const { elements, marquee, selectedElementIds, zoom, setElements, setAction, setMoveData } = ctx;
  if (!marquee || selectedElementIds.length === 0 || !rotateHandleHit(marquee, clientX, clientY, zoom)) return false;
  const b = getBounds(marquee);
  const groupCx = b.x + b.w / 2;
  const groupCy = b.y + b.h / 2;
  const items = {};
  elements.filter(el => selectedElementIds.includes(el.id)).forEach(el => {
    const { x: cx, y: cy } = getElementCenter(el);
    items[el.id] =
      el.type === "pen"
        ? { startAngle: el.angle ?? 0, cx, cy, points: el.points }
        : { startAngle: el.angle ?? 0, cx, cy, x1: el.x1, y1: el.y1, x2: el.x2, y2: el.y2 };
  });
  setMoveData({ rotate: { groupCx, groupCy, startPointerAngle: Math.atan2(clientY - groupCy, clientX - groupCx), items } });
  setElements(prev => prev);
  setAction("rotate");
  return true;
};

// snapshot at the start of a marquee-resize to compute scaled positions
export const buildScaleData = targets => ({
  origBbox: computeSelectionBBox(targets),
  origElements: Object.fromEntries(
    targets.map(el => [el.id, el.type === "pen" ? { ...el, points: el.points.map(p => ({ ...p })) } : { ...el }]),
  ),
});


export const buildMoveData = (elements, clientX, clientY) => {
  const data = {};
  elements.forEach(el => {
    if (el.type === "pen") {
      data[el.id] = {
        type: "pen",
        originalPoints: el.points,
        xOffsets: el.points.map(p => clientX - p.x),
        yOffsets: el.points.map(p => clientY - p.y),
      };
    } else {
      data[el.id] = {
        type: el.type,
        color: el.color,
        angle: el.angle,
        src: el.src,
        offsetX: clientX - el.x1,
        offsetY: clientY - el.y1,
        width: el.x2 - el.x1,
        height: el.y2 - el.y1,
      };
    }
  });
  return data;
};

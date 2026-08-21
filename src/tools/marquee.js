import { computeSelectionBBox, elementInMarquee, cursorForPosition } from "../utils/geometry";
import { buildMoveData, isInsideBounds, cornerHit, buildScaleData, rotateHandleHit, tryBeginRotate } from "./shared";

export const onMouseDown = (ctx, clientX, clientY) => {
  const { marquee, selectedElementIds, elements, setSelectedElement, setSelectedElementIds, setMarquee, setMoveData, setElements, setAction } = ctx;

  if (tryBeginRotate(ctx, clientX, clientY)) return;

  if (marquee && selectedElementIds.length > 0) {
    const corner = cornerHit(marquee, clientX, clientY);
    if (corner) {
      // grab a snapshot of the selection's bbox and original geometry to
      // proportionally scale every selected element while the corner is dragged
      const targets = elements.filter(el => selectedElementIds.includes(el.id));
      setSelectedElement({ position: corner, x1: marquee.x1, y1: marquee.y1, x2: marquee.x2, y2: marquee.y2 });
      setMoveData(buildScaleData(targets));
      setElements(prev => prev); // mark a history boundary so the resize is its own undo step
      setAction("marquee-resize");
      return;
    }

    if (isInsideBounds(marquee, clientX, clientY)) {
      const targets = elements.filter(el => selectedElementIds.includes(el.id));
      setMoveData(buildMoveData(targets, clientX, clientY));
      setElements(prev => prev);
      setAction("move");
      return;
    }
  }

  setSelectedElementIds([]);
  setMarquee({ x1: clientX, y1: clientY, x2: clientX, y2: clientY, isDragging: true });
  setAction("marquee");
};

export const getCursor = ({ marquee, selectedElementIds, zoom }, clientX, clientY) => {
  if (marquee && selectedElementIds.length > 0) {
    if (rotateHandleHit(marquee, clientX, clientY, zoom)) return "grab";
    const corner = cornerHit(marquee, clientX, clientY);
    if (corner) return cursorForPosition(corner);
    if (isInsideBounds(marquee, clientX, clientY)) return "move";
  }
  return "crosshair";
};

export const onMouseUp = ({ action, marquee, elements, selectedElementIds, setSelectedElement, setSelectedElementIds, setMarquee }) => {
  if (!marquee) return;
  if (action === "marquee") {
    const selectedIds = elements
      .filter(el => elementInMarquee(el, marquee.x1, marquee.y1, marquee.x2, marquee.y2))
      .map(el => el.id);
    setSelectedElementIds(selectedIds);
    const bbox = computeSelectionBBox(elements.filter(el => selectedIds.includes(el.id)));
    setMarquee(bbox ? { x1: bbox.minX - 8, y1: bbox.minY - 8, x2: bbox.maxX + 8, y2: bbox.maxY + 8 } : null);
  } else if (action === "marquee-resize") {
    // refresh the marquee
    const bbox = computeSelectionBBox(elements.filter(el => selectedElementIds.includes(el.id)));
    setMarquee(bbox ? { x1: bbox.minX - 8, y1: bbox.minY - 8, x2: bbox.maxX + 8, y2: bbox.maxY + 8 } : null);
    setSelectedElement(null);
  }
};

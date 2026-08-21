
import { getElementAtPosition, computeSelectionBBox, cursorForPosition } from "../utils/geometry";
import { buildMoveData, isInsideBounds, cornerHit, buildScaleData, rotateHandleHit, tryBeginRotate } from "./shared";

export const onMouseDown = (ctx, clientX, clientY) => {
  const { elements, marquee, selectedElementIds, setSelectedElement, setSelectedElementIds, setMoveData, setMarquee, setElements, setAction } = ctx;

  if (tryBeginRotate(ctx, clientX, clientY)) return;

  if (marquee && selectedElementIds.length > 0) {
    const corner = cornerHit(marquee, clientX, clientY);
    if (corner) {
      const targets = elements.filter(el => selectedElementIds.includes(el.id));
      setSelectedElement({ position: corner, x1: marquee.x1, y1: marquee.y1, x2: marquee.x2, y2: marquee.y2 });
      setMoveData(buildScaleData(targets));
      setElements(prev => prev);
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

  
  const element = getElementAtPosition(clientX, clientY, elements);
  if (!element) {
    setSelectedElementIds([]);
    setMarquee(null);
    return;
  }

  const idsToMove = selectedElementIds.includes(element.id) ? selectedElementIds : [element.id];
  if (!selectedElementIds.includes(element.id)) setSelectedElementIds([element.id]);

  const targets = elements.filter(el => idsToMove.includes(el.id));
  const bbox = computeSelectionBBox(targets);
  if (bbox) setMarquee({ x1: bbox.minX - 8, y1: bbox.minY - 8, x2: bbox.maxX + 8, y2: bbox.maxY + 8 });
  setMoveData(buildMoveData(targets, clientX, clientY));
  setElements(prev => prev); 
  setAction("move");
};


export const getCursor = ({ elements, marquee, selectedElementIds, zoom }, clientX, clientY) => {
  if (marquee && selectedElementIds.length > 0) {
    if (rotateHandleHit(marquee, clientX, clientY, zoom)) return "grab";
    const corner = cornerHit(marquee, clientX, clientY);
    if (corner) return cursorForPosition(corner);
    if (isInsideBounds(marquee, clientX, clientY)) return "move";
  }
  const element = getElementAtPosition(clientX, clientY, elements);
  return element ? "move" : "default";
};


export const onMouseUp = ({ action, elements, selectedElementIds, setSelectedElement, setMarquee }) => {
  if (action === "marquee-resize") {
    const bbox = computeSelectionBBox(elements.filter(el => selectedElementIds.includes(el.id)));
    setMarquee(bbox ? { x1: bbox.minX - 8, y1: bbox.minY - 8, x2: bbox.maxX + 8, y2: bbox.maxY + 8 } : null);
    setSelectedElement(null);
  }
};

import { getElementAtPosition, cursorForPosition, computeSelectionBBox, adjustElementCoordinates, adjustmentRequired } from "../utils/geometry";
import { buildMoveData, rotateHandleHit, tryBeginRotate } from "./shared";

export const onMouseDown = (ctx, clientX, clientY) => {
  const { elements, selectedElementIds, setSelectedElement, setSelectedElementIds, setElements, setAction, setMoveData, setMarquee } = ctx;
  if (tryBeginRotate(ctx, clientX, clientY)) return;
  const element = getElementAtPosition(clientX, clientY, elements);

  if (!element) {
    setSelectedElementIds([]);
    setMarquee(null);
    return;
  }

  const isAlreadySelected = selectedElementIds.includes(element.id);

  
  if (element.position !== "inside" && selectedElementIds.length === 1 && isAlreadySelected) {
    setSelectedElement({ ...element });
    setElements(prev => prev); 
    setAction("resize");
    return;
  }

  const idsToMove = isAlreadySelected ? selectedElementIds : [element.id];
  if (!isAlreadySelected) setSelectedElementIds([element.id]);

  const targets = elements.filter(el => idsToMove.includes(el.id));
  const data = buildMoveData(targets, clientX, clientY);
  const bbox = computeSelectionBBox(targets);
  if (bbox) setMarquee({ x1: bbox.minX - 8, y1: bbox.minY - 8, x2: bbox.maxX + 8, y2: bbox.maxY + 8 });
  setMoveData(data);
  setElements(prev => prev);
  setAction("move");
};

export const getCursor = ({ elements, selectedElementIds, marquee, zoom }, clientX, clientY) => {
  if (marquee && selectedElementIds.length > 0 && rotateHandleHit(marquee, clientX, clientY, zoom)) return "grab";
  const element = getElementAtPosition(clientX, clientY, elements);
  if (!element) return "default";
  if (selectedElementIds.includes(element.id)) return "move";
  if (element.position !== "inside") return cursorForPosition(element.position);
  return "move";
};


export const onMouseUp = ({ action, selectedElement, elements, setSelectedElement, updateElement }) => {
  if (action !== "resize" || !selectedElement) return;
  const { id, type } = selectedElement;
  const element = elements.find(el => el.id === id);
  if (element && adjustmentRequired(type)) {
    const { x1, y1, x2, y2 } = adjustElementCoordinates(element);
    updateElement(id, x1, y1, x2, y2, type);
  }
  setSelectedElement(null);
};

import { createElement } from "./elements";

// translate every element listed in moveData
export const applyGroupTranslate = (elements, moveData, x, y) =>
  elements.map(el => {
    const data = moveData[el.id];
    if (!data) return el;
    if (data.type === "pen") {
      return {
        ...el,
        points: data.originalPoints.map((_, i) => ({
          x: x - data.xOffsets[i],
          y: y - data.yOffsets[i],
        })),
      };
    }
    const newX1 = x - data.offsetX;
    const newY1 = y - data.offsetY;
    return createElement(newX1, newY1, newX1 + data.width, newY1 + data.height, data.type, data.color, el.id, { angle: data.angle, src: data.src });
  });

// scale every element listed in origElements
export const applyGroupScale = (elements, origElements, origBbox, marqueeCoords, padding) => {
  const newMinX = Math.min(marqueeCoords.x1, marqueeCoords.x2) + padding;
  const newMinY = Math.min(marqueeCoords.y1, marqueeCoords.y2) + padding;
  const newMaxX = Math.max(marqueeCoords.x1, marqueeCoords.x2) - padding;
  const newMaxY = Math.max(marqueeCoords.y1, marqueeCoords.y2) - padding;
  const origW = origBbox.maxX - origBbox.minX;
  const origH = origBbox.maxY - origBbox.minY;
  if (origW === 0 || origH === 0) return elements;
  const sx = (newMaxX - newMinX) / origW;
  const sy = (newMaxY - newMinY) / origH;
  const scaleX = v => newMinX + (v - origBbox.minX) * sx;
  const scaleY = v => newMinY + (v - origBbox.minY) * sy;

  return elements.map(el => {
    const origEl = origElements[el.id];
    if (!origEl) return el;
    if (origEl.type === "pen") {
      return { ...el, points: origEl.points.map(p => ({ x: scaleX(p.x), y: scaleY(p.y) })) };
    }
    return createElement(scaleX(origEl.x1), scaleY(origEl.y1), scaleX(origEl.x2), scaleY(origEl.y2), origEl.type, origEl.color, el.id, { angle: origEl.angle, src: origEl.src });
  });
};

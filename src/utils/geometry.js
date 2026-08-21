export const distance = (a, b) => Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));

export const rotatePoint = (x, y, cx, cy, angle) => {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const dx = x - cx, dy = y - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
};

export const getElementCenter = el => {
  if (el.type === "pen") {
    const xs = el.points.map(p => p.x), ys = el.points.map(p => p.y);
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  }
  return { x: (el.x1 + el.x2) / 2, y: (el.y1 + el.y2) / 2 };
};

// element outline points in world space, with rotation applied
export const getElementWorldPoints = el => {
  const { x1, y1, x2, y2 } = el;
  const points =
    el.type === "pen"
      ? el.points
      : el.type === "line"
        ? [{ x: x1, y: y1 }, { x: x2, y: y2 }]
        : [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }];
  if (!el.angle) return points;
  const { x: cx, y: cy } = getElementCenter(el);
  return points.map(p => rotatePoint(p.x, p.y, cx, cy, el.angle));
};

export const nearPoint = (x, y, x1, y1, name) => {
  return Math.abs(x - x1) < 5 && Math.abs(y - y1) < 5 ? name : null;
};

export const onLine = (x1, y1, x2, y2, x, y, maxDistance = 1) => {
  const a = { x: x1, y: y1 };
  const b = { x: x2, y: y2 };
  const c = { x, y };
  const offset = distance(a, b) - (distance(a, c) + distance(b, c));
  return Math.abs(offset) < maxDistance ? "inside" : null;
};

export const positionInElement = (x, y, element) => {
  const { type, x1, x2, y1, y2 } = element;
  // hit-test rotated elements in their unrotated local space
  if (element.angle) {
    const { x: cx, y: cy } = getElementCenter(element);
    ({ x, y } = rotatePoint(x, y, cx, cy, -element.angle));
  }
  switch (type) {
    case "line":
      const on = onLine(x1, y1, x2, y2, x, y);
      const start = nearPoint(x, y, x1, y1, "start");
      const end = nearPoint(x, y, x2, y2, "end");
      return start || end || on;
    case "rectangle":
    case "image":
      const topLeft = nearPoint(x, y, x1, y1, "tl");
      const topRight = nearPoint(x, y, x2, y1, "tr");
      const bottomLeft = nearPoint(x, y, x1, y2, "bl");
      const bottomRight = nearPoint(x, y, x2, y2, "br");
      const inside = x >= x1 && x <= x2 && y >= y1 && y <= y2 ? "inside" : null;
      return topLeft || topRight || bottomLeft || bottomRight || inside;
    case "circle": {
      const tlC = nearPoint(x, y, x1, y1, "tl");
      const trC = nearPoint(x, y, x2, y1, "tr");
      const blC = nearPoint(x, y, x1, y2, "bl");
      const brC = nearPoint(x, y, x2, y2, "br");
      const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
      const rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
      const insideC = rx > 0 && ry > 0 && ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 ? "inside" : null;
      return tlC || trC || blC || brC || insideC;
    }
    case "pen":
      const betweenAnyPoint = element.points.some((point, index) => {
        const nextPoint = element.points[index + 1];
        if (!nextPoint) return false;
        return onLine(point.x, point.y, nextPoint.x, nextPoint.y, x, y, 5) != null;
      });
      return betweenAnyPoint ? "inside" : null;
    default:
      throw new Error(`unrecognised: ${type}`);
  }
};

export const getElementAtPosition = (x, y, elements) => {
  return elements
    .map(element => ({ ...element, position: positionInElement(x, y, element) }))
    .find(element => element.position !== null);
};

export const adjustElementCoordinates = element => {
  const { type, x1, y1, x2, y2 } = element;
  if (type === "rectangle" || type === "circle" || type === "image") {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    return { x1: minX, y1: minY, x2: maxX, y2: maxY };
  } else {
    if (x1 < x2 || (x1 === x2 && y1 < y2)) {
      return { x1, y1, x2, y2 };
    } else {
      return { x1: x2, y1: y2, x2: x1, y2: y1 };
    }
  }
};

export const cursorForPosition = position => {
  switch (position) {
    case "tl":
    case "br":
    case "start":
    case "end":
      return "nwse-resize";
    case "tr":
    case "bl":
      return "nesw-resize";
    default:
      return "move";
  }
};

export const resizedCoordinates = (clientX, clientY, position, coordinates) => {
  const { x1, y1, x2, y2 } = coordinates;
  switch (position) {
    case "tl":
    case "start":
      return { x1: clientX, y1: clientY, x2, y2 };
    case "tr":
      return { x1, y1: clientY, x2: clientX, y2 };
    case "bl":
      return { x1: clientX, y1, x2, y2: clientY };
    case "br":
    case "end":
      return { x1, y1, x2: clientX, y2: clientY };
    default:
      return null;
  }
};


export const resizedCoordinatesRotated = (px, py, position, coordinates, angle, lockRatio = false) => {
  if (!angle && !lockRatio) return resizedCoordinates(px, py, position, coordinates);
  const { x1, y1, x2, y2 } = coordinates;
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
  const corners = { tl: [x1, y1], tr: [x2, y1], bl: [x1, y2], br: [x2, y2], start: [x1, y1], end: [x2, y2] };
  const opposite = { tl: "br", br: "tl", tr: "bl", bl: "tr", start: "end", end: "start" }[position];
  if (!opposite) return null;
  const [fx, fy] = corners[opposite];
  const fixed = rotatePoint(fx, fy, cx, cy, angle);

  if (lockRatio) {
    const w0 = Math.abs(x2 - x1), h0 = Math.abs(y2 - y1);
    const v = rotatePoint(px - fixed.x, py - fixed.y, 0, 0, -angle);
    const s = Math.max(w0 ? Math.abs(v.x) / w0 : 0, h0 ? Math.abs(v.y) / h0 : 0);
    const snapped = rotatePoint(Math.sign(v.x || 1) * w0 * s, Math.sign(v.y || 1) * h0 * s, 0, 0, angle);
    px = fixed.x + snapped.x;
    py = fixed.y + snapped.y;
  }

  const ncx = (fixed.x + px) / 2, ncy = (fixed.y + py) / 2;
  const f = rotatePoint(fixed.x, fixed.y, ncx, ncy, -angle);
  const d = rotatePoint(px, py, ncx, ncy, -angle);
  switch (position) {
    case "tl":
    case "start":
      return { x1: d.x, y1: d.y, x2: f.x, y2: f.y };
    case "br":
    case "end":
      return { x1: f.x, y1: f.y, x2: d.x, y2: d.y };
    case "tr":
      return { x1: f.x, y1: d.y, x2: d.x, y2: f.y };
    case "bl":
      return { x1: d.x, y1: f.y, x2: f.x, y2: d.y };
    default:
      return null;
  }
};

export const adjustmentRequired = type => ["line", "rectangle", "circle", "image"].includes(type);

export const elementInMarquee = (element, mx1, my1, mx2, my2) => {
  const left = Math.min(mx1, mx2);
  const right = Math.max(mx1, mx2);
  const top = Math.min(my1, my2);
  const bottom = Math.max(my1, my2);
  const inBounds = p => p.x >= left && p.x <= right && p.y >= top && p.y <= bottom;
  const points = getElementWorldPoints(element);
  return element.type === "pen" ? points.some(inBounds) : points.every(inBounds);
};

export const computeSelectionBBox = selectedElements => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  selectedElements.forEach(el => {
    getElementWorldPoints(el).forEach(p => {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    });
  });
  return minX !== Infinity ? { minX, minY, maxX, maxY } : null;
};

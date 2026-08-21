import rough from "roughjs/bundled/rough.esm";
import { getStroke } from "perfect-freehand";
import { v4 as uuidv4 } from "uuid";
import { getElementCenter } from "./geometry";
import { getCachedImage } from "./imageCache";

const generator = rough.generator();

export const createElement = (x1, y1, x2, y2, type, color = "#363636", existingId = null, options = {}) => {
  const id = existingId ?? uuidv4();
  const { angle = 0, src = null } = options;
  switch (type) {
    case "line":
    case "rectangle":
    case "circle": {
      const roughElement =
        type === "line"
          ? generator.line(x1, y1, x2, y2, { bowing: 2, strokeWidth: 3, stroke: color })
          : type === "rectangle"
            ? generator.rectangle(x1, y1, x2 - x1, y2 - y1, { bowing: 2, strokeWidth: 3, stroke: color })
            : generator.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1), Math.abs(y2 - y1), { bowing: 2, strokeWidth: 3, stroke: color });
      return { id, x1, y1, x2, y2, type, roughElement, color, angle };
    }
    case "pen":
      return { id, type, points: [{ x: x1, y: y1 }], color, angle };
    case "image":
      return { id, x1, y1, x2, y2, type, src, angle };
    default:
      throw new Error(`unrecognized: ${type}`);
  }
};

const SVGpathData = stroke => {
  if (!stroke.length) return "";
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...stroke[0], "Q"],
  );
  d.push("Z");
  return d.join(" ");
};

export const drawElement = (roughCanvas, context, element) => {
  const opacity = element.opacity ?? 1;
  context.save();
  context.globalAlpha = opacity;

  if (element.angle) {
    const { x: cx, y: cy } = getElementCenter(element);
    context.translate(cx, cy);
    context.rotate(element.angle);
    context.translate(-cx, -cy);
  }

  switch (element.type) {
    case "line":
    case "rectangle":
    case "circle":
      roughCanvas.draw(element.roughElement);
      break;
    case "pen":
      const stroke = SVGpathData(
        getStroke(element.points, {
          size: 8,
          thinning: 0.3,
          smoothing: 0.5,
          streamline: 0.7,
        }),
      );
      context.fillStyle = element.color;
      context.fill(new Path2D(stroke));
      break;
    case "image": {
      const img = getCachedImage(element.src);
      const x = Math.min(element.x1, element.x2);
      const y = Math.min(element.y1, element.y2);
      const w = Math.abs(element.x2 - element.x1);
      const h = Math.abs(element.y2 - element.y1);
      if (img) {
        context.drawImage(img, x, y, w, h);
      } else {
        // still decoding — placeholder until the cache callback repaints
        context.fillStyle = "#f0f0f0";
        context.fillRect(x, y, w, h);
        context.strokeStyle = "#bbbbbb";
        context.strokeRect(x, y, w, h);
      }
      break;
    }
    default:
      throw new Error(`unrecognised: ${element.type}`);
  }

  context.restore();
};

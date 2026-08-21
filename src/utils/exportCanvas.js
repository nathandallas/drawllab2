import rough from "roughjs/bundled/rough.esm";
import { drawElement } from "./elements";
import { computeSelectionBBox } from "./geometry";
import { ensureImagesLoaded } from "./imageCache";
import { EXPORT_PADDING } from "./constants/canvas";


export const exportPNG = async (elements, { includeBackground }) => {
  if (!elements.length) return;
  await ensureImagesLoaded(elements);

  const bbox = computeSelectionBBox(elements);
  const w = bbox.maxX - bbox.minX + EXPORT_PADDING * 2;
  const h = bbox.maxY - bbox.minY + EXPORT_PADDING * 2;
  const scale = Math.min(2, 4096 / w, 4096 / h);

  const off = document.createElement("canvas");
  off.width = Math.ceil(w * scale);
  off.height = Math.ceil(h * scale);
  const context = off.getContext("2d");
  if (includeBackground) {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, off.width, off.height);
  }
  context.setTransform(scale, 0, 0, scale, (EXPORT_PADDING - bbox.minX) * scale, (EXPORT_PADDING - bbox.minY) * scale);
  const roughCanvas = rough.canvas(off);
  elements.forEach(el => drawElement(roughCanvas, context, el));

  off.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `drawllab-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}.png`;
    a.click();
    URL.revokeObjectURL(url);
  });
};

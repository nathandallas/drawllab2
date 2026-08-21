import { createElement } from "./elements";

const STORAGE_KEY = "drawllab-elements";

export const loadElements = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw).map(el =>
      el.type === "pen" || el.type === "image"
        ? el
        : createElement(el.x1, el.y1, el.x2, el.y2, el.type, el.color, el.id, { angle: el.angle }),
    );
  } catch {
    return [];
  }
};

export const saveElements = elements => {
  try {
    const serializable = elements.map(({ roughElement, ...rest }) => rest);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch (e) {
    console.warn("drawllab: failed to persist elements", e);
  }
};

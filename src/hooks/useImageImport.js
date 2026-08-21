import { useEffect, useRef } from "react";
import { createElement } from "../utils/elements";
import { primeImage } from "../utils/imageCache";
import { IMAGE_MAX_DIMENSION, MARQUEE_PADDING } from "../utils/constants/canvas";

const readAsDataURL = file =>
  new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });

const loadImage = src =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const isEditable = el => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

const useImageImport = ({ canvasRef, viewport, screenToWorld, windowSize, setElements, setSelectedElementIds, setMarquee, setTool }) => {
  const insertImageFile = async (file, worldPoint) => {
    if (!file?.type?.startsWith("image/")) return;
    let src = await readAsDataURL(file);
    let img = await loadImage(src);

    // downscale large images to keep data URLs (and localStorage) manageable
    const maxSide = Math.max(img.width, img.height);
    if (maxSide > IMAGE_MAX_DIMENSION) {
      const scale = IMAGE_MAX_DIMENSION / maxSide;
      const off = document.createElement("canvas");
      off.width = Math.round(img.width * scale);
      off.height = Math.round(img.height * scale);
      off.getContext("2d").drawImage(img, 0, 0, off.width, off.height);
      src = off.toDataURL(file.type === "image/jpeg" ? "image/jpeg" : "image/png", 0.85);
      img = await loadImage(src);
    }
    primeImage(src, img);

    // place at the drop point or viewport center, scaled down to fit half the screen
    const center = worldPoint ?? screenToWorld(windowSize.w / 2, windowSize.h / 2);
    const fit = Math.min(1, (windowSize.w * 0.5) / viewport.zoom / img.width, (windowSize.h * 0.5) / viewport.zoom / img.height);
    const w = img.width * fit;
    const h = img.height * fit;
    const element = createElement(center.x - w / 2, center.y - h / 2, center.x + w / 2, center.y + h / 2, "image", undefined, null, { src });

    setElements(prev => [...prev, element]);
    setSelectedElementIds([element.id]);
    setMarquee({ x1: element.x1 - MARQUEE_PADDING, y1: element.y1 - MARQUEE_PADDING, x2: element.x2 + MARQUEE_PADDING, y2: element.y2 + MARQUEE_PADDING });
    setTool("move");
  };

  const insertRef = useRef();
  insertRef.current = insertImageFile;
  const screenToWorldRef = useRef();
  screenToWorldRef.current = screenToWorld;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onDragOver = e => e.preventDefault();
    const onDrop = e => {
      e.preventDefault();
      const file = [...e.dataTransfer.files].find(f => f.type.startsWith("image/"));
      if (file) insertRef.current(file, screenToWorldRef.current(e.clientX, e.clientY));
    };
    const onPaste = e => {
      if (isEditable(e.target)) return;
      const item = [...e.clipboardData.items].find(i => i.type.startsWith("image/"));
      if (item) insertRef.current(item.getAsFile());
    };
    canvas.addEventListener("dragover", onDragOver);
    canvas.addEventListener("drop", onDrop);
    document.addEventListener("paste", onPaste);
    return () => {
      canvas.removeEventListener("dragover", onDragOver);
      canvas.removeEventListener("drop", onDrop);
      document.removeEventListener("paste", onPaste);
    };
  }, [canvasRef]);

  return { insertImageFile };
};

export default useImageImport;

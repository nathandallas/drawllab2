import "./Canvas.css";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createElement } from "../utils/elements";
import { resizedCoordinates, resizedCoordinatesRotated, computeSelectionBBox, rotatePoint } from "../utils/geometry";
import { setImageLoadCallback } from "../utils/imageCache";
import { renderCanvas } from "../utils/canvasRenderer";
import { applyGroupTranslate, applyGroupScale } from "../utils/transforms";
import { loadElements, saveElements } from "../utils/storage";
import { exportPNG } from "../utils/exportCanvas";
import { WORLD_WIDTH, WORLD_HEIGHT, MARQUEE_PADDING } from "../utils/constants/canvas";
import useHistory from "../hooks/useHistory";
import useViewport from "../hooks/useViewport";
import useWindowSize from "../hooks/useWindowSize";
import useCanvasShortcuts from "../hooks/useCanvasShortcuts";
import useForceLightTheme from "../hooks/useForceLightTheme";
import useImageImport from "../hooks/useImageImport";
import NavBar from "./NavBar/NavBar";
import Toolbar from "./canvas/Toolbar/Toolbar";
import ZoomControls from "./canvas/ZoomControls/ZoomControls";
import CanvasActions from "./canvas/CanvasActions/CanvasActions";
import ImageActions from "./canvas/ImageActions/ImageActions";
import { TOOLS } from "../tools";

const CanvasPage = () => {
  // drawing state: list of elements plus undo/redo, current gesture, active tool,
  // and selection bookkeeping (single hit, multi-marquee, in-flight drag snapshot).
  const [initialElements] = useState(loadElements);
  const [elements, setElements, undo, redo] = useHistory(initialElements);
  const [action, setAction] = useState("none");
  const [tool, setTool] = useState("pen");
  const [selectedElement, setSelectedElement] = useState(null);
  const [selectedElementIds, setSelectedElementIds] = useState([]);
  const [marquee, setMarquee] = useState(null);
  const [moveData, setMoveData] = useState(null);
  const [selectedColor, setSelectedColor] = useState("#363636");
  // ids the eraser is hovering — rendered semi-transparent until mouse-up confirms deletion
  const [fadingIds, setFadingIds] = useState(() => new Set());
  // bumped when an async image decode lands, forcing a repaint
  const [imageTick, setImageTick] = useState(0);

  const canvasRef = useRef(null);
  const windowSize = useWindowSize();
  const { viewport, screenToWorld, zoomAtPoint, beginPan, updatePan, endPan } = useViewport(canvasRef);
  const { isSpaceDown } = useCanvasShortcuts({ undo, redo });
  useForceLightTheme();
  const { insertImageFile } = useImageImport({ canvasRef, viewport, screenToWorld, windowSize, setElements, setSelectedElementIds, setMarquee, setTool });

  // persist on every change
  useEffect(() => {
    saveElements(elements);
  }, [elements]);

  useEffect(() => {
    setImageLoadCallback(() => setImageTick(t => t + 1));
    return () => setImageLoadCallback(null);
  }, []);

  // main render loop — paints before the next frame to prevent flicker during drag/resize
  useLayoutEffect(() => {
    renderCanvas(canvasRef.current, {
      elements,
      viewport,
      marquee,
      fadingIds,
      worldWidth: WORLD_WIDTH,
      worldHeight: WORLD_HEIGHT,
      showRotateHandle: selectedElementIds.length > 0 && ["pointer", "marquee", "move"].includes(tool),
    });
  }, [elements, marquee, fadingIds, viewport, windowSize, selectedElementIds, tool, imageTick]);

  // mutate one element by id. shapes are recreated from new coords; pen strokes append a point.
  // the `true` flag tells useHistory to overwrite the latest entry, so dragging produces one
  // undo step rather than hundreds.
  const updateElement = (id, x1, y1, x2, y2, type) => {
    const elementsCopy = [...elements];
    const index = elementsCopy.findIndex(el => el.id === id);
    switch (type) {
      case "line":
      case "rectangle":
      case "circle":
      case "image": {
        const { color, angle, src } = elementsCopy[index];
        elementsCopy[index] = createElement(x1, y1, x2, y2, type, color, id, { angle, src });
        break;
      }
      case "pen":
        elementsCopy[index].points = [...elementsCopy[index].points, { x: x2, y: y2 }];
        break;
      default:
        throw new Error(`unrecognised: ${type}`);
    }
    setElements(elementsCopy, true);
  };

  // clear selection when switching away from a selection-related tool
  useEffect(() => {
    if (tool !== "pointer" && tool !== "marquee" && tool !== "move") {
      setSelectedElementIds([]);
      setMarquee(null);
    }
  }, [tool]);

  // show a grab/grabbing cursor while panning, holding space, or with the hand tool active
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (action === "pan") canvas.style.cursor = "grabbing";
    else if (isSpaceDown || tool === "hand") canvas.style.cursor = "grab";
  }, [action, isSpaceDown, tool]);

  // bundle everything a tool handler needs into one object. each tool module in ../tools
  // receives this and reads/mutates the relevant pieces of canvas state.
  const getCtx = () => ({
    elements,
    action,
    zoom: viewport.zoom,
    selectedElement,
    selectedElementIds,
    marquee,
    moveData,
    selectedColor,
    setElements,
    setAction,
    setSelectedElement,
    setSelectedElementIds,
    setMarquee,
    setMoveData,
    setFadingIds,
    updateElement,
  });

  // pointer-down: start a pan if space/middle-click is held, otherwise delegate to the active tool
  const handleMouseDown = e => {
    const { clientX, clientY } = e;

    // pan if space is held, middle-click, or the hand tool is active
    if (isSpaceDown || e.button === 1 || tool === "hand") {
      beginPan(clientX, clientY);
      setAction("pan");
      return;
    }

    const { x, y } = screenToWorld(clientX, clientY);
    TOOLS[tool]?.onMouseDown(getCtx(), x, y);
  };

  // pointer-move: dispatches based on the current action (draw / erase / move / resize / marquee / pan)
  const handleMouseMove = e => {
    const { clientX, clientY } = e;

    // safety net: if no button is currently pressed but a drag is still in progress
    // (e.g. user released outside the canvas), cancel the action
    if (e.buttons === 0 && action !== "none") {
      setAction("none");
      setMoveData(null);
      endPan();
      return;
    }

    // active pan drag: update viewport by the cursor delta from the gesture start
    if (action === "pan") {
      e.target.style.cursor = "grabbing";
      updatePan(clientX, clientY);
      return;
    }

    // hint that panning is available on space
    if (isSpaceDown) {
      e.target.style.cursor = "grab";
      return;
    }

    // ask the active tool what cursor is appropriate at this world position
    const { x, y } = screenToWorld(clientX, clientY);
    e.target.style.cursor = TOOLS[tool]?.getCursor(getCtx(), x, y) ?? "default";

    if (action === "erase") {
      TOOLS[tool]?.onMouseMove?.(getCtx(), x, y);
    } else if (action === "draw") {
      const { id, x1, y1 } = elements[elements.length - 1];
      updateElement(id, x1, y1, x, y, tool);
    } else if (action === "marquee") {
      setMarquee(prev => ({ ...prev, x2: x, y2: y, isDragging: true }));
    } else if (action === "move" && moveData) {
      const next = applyGroupTranslate(elements, moveData, x, y);
      setElements(next, true);
      const bbox = computeSelectionBBox(next.filter(el => selectedElementIds.includes(el.id)));
      if (bbox) {
        setMarquee({
          x1: bbox.minX - MARQUEE_PADDING,
          y1: bbox.minY - MARQUEE_PADDING,
          x2: bbox.maxX + MARQUEE_PADDING,
          y2: bbox.maxY + MARQUEE_PADDING,
        });
      }
    } else if (action === "rotate" && moveData?.rotate) {
      e.target.style.cursor = "grabbing";
      const { groupCx, groupCy, startPointerAngle, items } = moveData.rotate;
      const delta = Math.atan2(y - groupCy, x - groupCx) - startPointerAngle;
      const next = elements.map(el => {
        const it = items[el.id];
        if (!it) return el;
        const angle = it.startAngle + delta;
        const { x: ncx, y: ncy } = rotatePoint(it.cx, it.cy, groupCx, groupCy, delta);
        const dx = ncx - it.cx, dy = ncy - it.cy;
        if (el.type === "pen") return { ...el, angle, points: it.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
        return createElement(it.x1 + dx, it.y1 + dy, it.x2 + dx, it.y2 + dy, el.type, el.color, el.id, { angle, src: el.src });
      });
      setElements(next, true);
      const bbox = computeSelectionBBox(next.filter(el => selectedElementIds.includes(el.id)));
      if (bbox) {
        setMarquee({
          x1: bbox.minX - MARQUEE_PADDING,
          y1: bbox.minY - MARQUEE_PADDING,
          x2: bbox.maxX + MARQUEE_PADDING,
          y2: bbox.maxY + MARQUEE_PADDING,
        });
      }
    } else if (action === "marquee-resize" && selectedElement && moveData) {
      const { position, x1, y1, x2, y2 } = selectedElement;
      let coords;
      if (e.shiftKey) {
        // constrain the inner content box, not the padded marquee, so the ratio is exact
        const p = MARQUEE_PADDING;
        const inner = resizedCoordinatesRotated(
          x + (position.includes("l") ? p : -p),
          y + (position.startsWith("t") ? p : -p),
          position,
          { x1: x1 + p, y1: y1 + p, x2: x2 - p, y2: y2 - p },
          0,
          true,
        );
        coords = inner && { x1: inner.x1 - p, y1: inner.y1 - p, x2: inner.x2 + p, y2: inner.y2 + p };
      } else {
        coords = resizedCoordinates(x, y, position, { x1, y1, x2, y2 });
      }
      if (!coords) return;
      setMarquee(prev => ({ ...prev, ...coords }));

      const { origBbox, origElements } = moveData;
      if (origBbox) {
        setElements(applyGroupScale(elements, origElements, origBbox, coords, MARQUEE_PADDING), true);
      }
    } else if (action === "resize" && selectedElement) {
      const { id, type, position, ...coordinates } = selectedElement;
      const { x1, y1, x2, y2 } = resizedCoordinatesRotated(x, y, position, coordinates, selectedElement.angle ?? 0, e.shiftKey);
      updateElement(id, x1, y1, x2, y2, type);
    }
  };

  // end pans cleanly
  const handleMouseUp = () => {
    if (action === "pan") {
      endPan();
      setAction("none");
      return;
    }
    TOOLS[tool]?.onMouseUp(getCtx());
    setAction("none");
    setMoveData(null);
  };

  return (
    <>
      <Toolbar tool={tool} setTool={setTool} selectedColor={selectedColor} onColorChange={color => setSelectedColor(color.hex)} />
      <CanvasActions
        onUndo={undo}
        onRedo={redo}
        onClear={() => {
          setElements([]);
          setSelectedElementIds([]);
        }}
      />
      <ZoomControls viewport={viewport} zoomAtPoint={zoomAtPoint} anchorX={windowSize.w / 3} anchorY={windowSize.h / 3} />
      <ImageActions onUploadFile={insertImageFile} onExport={opts => exportPNG(elements, opts)} canExport={elements.length > 0} />
      <NavBar className="canvas-nav" />
      <canvas
        id="canvas"
        ref={canvasRef}
        width={windowSize.w}
        height={windowSize.h}
        onPointerDown={handleMouseDown}
        onPointerMove={handleMouseMove}
        onPointerUp={handleMouseUp}
        onPointerCancel={handleMouseUp}>
        Canvas
      </canvas>
    </>
  );
};

export default CanvasPage;

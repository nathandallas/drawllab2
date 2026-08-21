import { useEffect, useRef, useState } from "react";
import { ImagePlus, Download } from "lucide-react";
import RoughBorder from "../../ui/RoughBorder";
import Panel from "../../ui/Panel/Panel";
import "./ImageActions.css";

const ImageActions = ({ onUploadFile, onExport, canExport }) => {
  const [showExport, setShowExport] = useState(false);
  const [includeBackground, setIncludeBackground] = useState(true);
  const fileInputRef = useRef(null);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!showExport) return;
    const handleClickOutside = e => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) setShowExport(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showExport]);

  return (
    <div className="canvas-tools-io">
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        className="canvas-tools-io__file"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) onUploadFile(file);
          e.target.value = "";
        }}
      />
      <div className="canvas-tools__button surface lift" title="add image" onClick={() => fileInputRef.current?.click()}>
        <RoughBorder color="var(--text-primary)" strokeWidth={3} />
        <ImagePlus />
      </div>
      <div className="canvas-tools-io__anchor" ref={popoverRef}>
        <div
          className={`canvas-tools__button surface lift${canExport ? "" : " canvas-tools-io__button--disabled"}`}
          title={canExport ? "download png" : "canvas is empty"}
          onClick={() => canExport && setShowExport(s => !s)}>
          <RoughBorder color="var(--text-primary)" strokeWidth={3} />
          <Download />
        </div>
        {showExport && (
          <Panel className="canvas-tools-io__popover">
            <label className="canvas-tools-io__option">
              <input type="checkbox" checked={includeBackground} onChange={e => setIncludeBackground(e.target.checked)} />
              <span className="canvas-tools-io__checkbox" />
              include background
            </label>
            <div
              className="canvas-tools__button surface lift"
              onClick={() => {
                onExport({ includeBackground });
                setShowExport(false);
              }}>
              <RoughBorder color="var(--text-primary)" strokeWidth={3} />
              <h2>download</h2>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
};

export default ImageActions;

const cache = new Map();
const pending = new Set();
let onLoad = null;

export const setImageLoadCallback = cb => (onLoad = cb);

export const primeImage = (src, img) => cache.set(src, img);

export const getCachedImage = src => {
  const img = cache.get(src);
  if (img || pending.has(src)) return img;
  pending.add(src);
  const el = new Image();
  el.onload = () => {
    cache.set(src, el);
    pending.delete(src);
    onLoad?.();
  };
  el.onerror = () => pending.delete(src);
  el.src = src;
};

export const ensureImagesLoaded = elements =>
  Promise.all(
    elements
      .filter(el => el.type === "image" && !cache.has(el.src))
      .map(
        el =>
          new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
              cache.set(el.src, img);
              resolve();
            };
            img.onerror = resolve;
            img.src = el.src;
          }),
      ),
  );

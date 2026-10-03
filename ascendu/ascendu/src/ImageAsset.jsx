import React from "react";

const imagePreloads = new Map();

export function preloadImageAsset(src) {
  if (!src || typeof window === "undefined") return Promise.resolve(false);
  if (imagePreloads.has(src)) return imagePreloads.get(src);

  const image = new window.Image();
  image.decoding = "async";
  image.fetchPriority = "high";
  image.src = src;
  const preload = image.decode().then(() => true).catch(() => {
    imagePreloads.delete(src);
    return false;
  });
  imagePreloads.set(src, preload);
  return preload;
}

export default function ImageAsset({ onError, ...props }) {
  const handleError = event => {
    onError?.(event);
    if (event.defaultPrevented) return;
    const image = event.currentTarget;
    image.hidden = true;
    image.dataset.lumoraImageError = "true";
  };

  return <img {...props} decoding={props.decoding || "async"} onError={handleError}/>;
}

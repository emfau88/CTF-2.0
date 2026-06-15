import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://127.0.0.1:5190/CTF/",
});

const { window } = dom;

for (const [key, value] of Object.entries({
  window,
  document: window.document,
  navigator: window.navigator,
  Element: window.Element,
  HTMLElement: window.HTMLElement,
  HTMLCanvasElement: window.HTMLCanvasElement,
  HTMLVideoElement: window.HTMLVideoElement,
  DOMRect: window.DOMRect,
  Event: window.Event,
  KeyboardEvent: window.KeyboardEvent,
  MouseEvent: window.MouseEvent,
  Node: window.Node,
  Image: window.Image,
  self: window,
})) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value,
  });
}

if (!("matchMedia" in window)) {
  Object.defineProperty(window, "matchMedia", {
    value: () => ({
      matches: false,
      media: "",
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

const canvasContext = new Proxy({
  canvas: null as HTMLCanvasElement | null,
  createImageData: (width = 1, height = 1) => ({
    data: new Uint8ClampedArray(width * height * 4),
  }),
  createLinearGradient: () => ({ addColorStop: () => {} }),
  getImageData: (x = 0, y = 0, width = 1, height = 1) => ({
    data: new Uint8ClampedArray(width * height * 4),
    height,
    width,
    x,
    y,
  }),
  measureText: () => ({ width: 0 }),
}, {
  get(target, property) {
    if (property in target) {
      return target[property as keyof typeof target];
    }
    return () => {};
  },
  set: () => true,
});

Object.defineProperty(window.HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  value(this: HTMLCanvasElement) {
    canvasContext.canvas = this;
    return canvasContext;
  },
});

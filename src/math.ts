export type Vec2 = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type InputVector = Vec2 & { length: number };
export const len = (x: number, y: number) => Math.hypot(x, y);
export const pointInRect = (x: number, y: number, r: Rect) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export function insetRect(r: Rect, ratio: number): Rect {
  const safeRatio = Math.max(0, Math.min(ratio, .49));
  const insetX = r.w * safeRatio;
  const insetY = r.h * safeRatio;
  return { x: r.x + insetX, y: r.y + insetY, w: r.w - insetX * 2, h: r.h - insetY * 2 };
}
export function segmentsIntersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2) {
  const ccw = (p1: Vec2, p2: Vec2, p3: Vec2) => (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x);
  return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
}
export function lineIntersectsRect(a: Vec2, b: Vec2, r: Rect) {
  if (pointInRect(a.x, a.y, r) || pointInRect(b.x, b.y, r)) return true;
  const tl = { x: r.x, y: r.y }, tr = { x: r.x + r.w, y: r.y };
  const br = { x: r.x + r.w, y: r.y + r.h }, bl = { x: r.x, y: r.y + r.h };
  return segmentsIntersect(a, b, tl, tr) || segmentsIntersect(a, b, tr, br) || segmentsIntersect(a, b, br, bl) || segmentsIntersect(a, b, bl, tl);
}
export function circleRect(cx: number, cy: number, radius: number, r: Rect) {
  const nx = Math.max(r.x, Math.min(cx, r.x + r.w));
  const ny = Math.max(r.y, Math.min(cy, r.y + r.h));
  return (cx - nx) ** 2 + (cy - ny) ** 2 < radius ** 2;
}
export function resolveCircleRect(pos: Vec2, radius: number, r: Rect): (Vec2 & { depth: number }) | null {
  const nx = Math.max(r.x, Math.min(pos.x, r.x + r.w));
  const ny = Math.max(r.y, Math.min(pos.y, r.y + r.h));
  let dx = pos.x - nx, dy = pos.y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= radius * radius) return null;
  if (d2 < 0.0001) {
    const left = Math.abs(pos.x - r.x), right = Math.abs(r.x + r.w - pos.x), top = Math.abs(pos.y - r.y), bottom = Math.abs(r.y + r.h - pos.y);
    const m = Math.min(left, right, top, bottom);
    if (m === left) return { x: -1, y: 0, depth: radius + left };
    if (m === right) return { x: 1, y: 0, depth: radius + right };
    if (m === top) return { x: 0, y: -1, depth: radius + top };
    return { x: 0, y: 1, depth: radius + bottom };
  }
  const d = Math.sqrt(d2);
  dx /= d; dy /= d;
  return { x: dx, y: dy, depth: radius - d };
}

export function rayCircleDistance(origin: Vec2, direction: Vec2, center: Vec2, radius: number) {
  const ox = origin.x - center.x, oy = origin.y - center.y;
  const projection = ox * direction.x + oy * direction.y;
  const discriminant = projection * projection - (ox * ox + oy * oy - radius * radius);
  if (discriminant < 0) return null;
  const near = -projection - Math.sqrt(discriminant);
  const far = -projection + Math.sqrt(discriminant);
  return near >= 0 ? near : far >= 0 ? far : null;
}

export function rayRectDistance(origin: Vec2, direction: Vec2, rect: Rect) {
  let near = 0, far = Infinity;
  for (const axis of ["x", "y"] as const) {
    const min = rect[axis];
    const max = min + (axis === "x" ? rect.w : rect.h);
    const value = origin[axis], delta = direction[axis];
    if (Math.abs(delta) < .00001) {
      if (value < min || value > max) return null;
      continue;
    }
    const a = (min - value) / delta, b = (max - value) / delta;
    near = Math.max(near, Math.min(a, b));
    far = Math.min(far, Math.max(a, b));
    if (near > far) return null;
  }
  return far >= 0 ? Math.max(0, near) : null;
}

export function pointSegmentDistance(point: Vec2, start: Vec2, end: Vec2) {
  const dx = end.x - start.x, dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return len(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return len(point.x - (start.x + dx * t), point.y - (start.y + dy * t));
}

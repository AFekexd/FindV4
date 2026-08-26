import type { Point } from '../types';

export const PIXELS_PER_METER = 20; // 20 canvas units = 1 meter

export function snapToGrid(point: Point, gridSize: number): Point {
  if (gridSize <= 1) return { ...point };
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
}

export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function distanceInMeters(p1: Point, p2: Point): number {
  return distance(p1, p2) / PIXELS_PER_METER;
}

export function pointInPolygon(point: Point, vs: Point[]): boolean {
  if (!vs || vs.length < 3) return false;
  const { x, y } = point;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i].x;
    const yi = vs[i].y;
    const xj = vs[j].x;
    const yj = vs[j].y;
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function polygonCentroid(polygon: Point[]): Point {
  if (!polygon || polygon.length === 0) return { x: 0, y: 0 };
  let xSum = 0;
  let ySum = 0;
  for (const p of polygon) {
    xSum += p.x;
    ySum += p.y;
  }
  return {
    x: Math.round(xSum / polygon.length),
    y: Math.round(ySum / polygon.length),
  };
}

export function polygonArea(polygon: Point[]): number {
  if (!polygon || polygon.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    area += polygon[i].x * polygon[j].y;
    area -= polygon[j].x * polygon[i].y;
  }
  return Math.abs(area / 2);
}

export function polygonAreaInSquareMeters(polygon: Point[]): number {
  const pxArea = polygonArea(polygon);
  return pxArea / (PIXELS_PER_METER * PIXELS_PER_METER);
}

export function getBoundingBox(polygon: Point[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (!polygon || polygon.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  let minX = polygon[0].x;
  let maxX = polygon[0].x;
  let minY = polygon[0].y;
  let maxY = polygon[0].y;

  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function generateRectPolygon(start: Point, end: Point): Point[] {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

export function getTurnDirection(
  p1: Point,
  p2: Point,
  p3: Point
): 'straight' | 'turn_left' | 'turn_right' {
  const v1 = { x: p2.x - p1.x, y: p2.y - p1.y };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

  const cross = v1.x * v2.y - v1.y * v2.x;
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

  if (mag1 === 0 || mag2 === 0) return 'straight';

  const cosAngle = dot / (mag1 * mag2);
  const angleRad = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
  const angleDeg = (angleRad * 180) / Math.PI;

  if (angleDeg < 25) return 'straight';
  return cross > 0 ? 'turn_right' : 'turn_left';
}

export interface PolygonEdge {
  index: number;
  start: Point;
  end: Point;
  midPoint: Point;
  lengthPixels: number;
  lengthMeters: number;
  angleDeg: number;
}

/**
 * Returns all edge segments of a polygon with lengths in meters and midpoints
 */
export function getPolygonEdges(polygon: Point[]): PolygonEdge[] {
  if (!polygon || polygon.length < 2) return [];
  const edges: PolygonEdge[] = [];

  for (let i = 0; i < polygon.length; i++) {
    const nextIdx = (i + 1) % polygon.length;
    const start = polygon[i];
    const end = polygon[nextIdx];
    const lenPx = distance(start, end);
    const midPoint = {
      x: Math.round((start.x + end.x) / 2),
      y: Math.round((start.y + end.y) / 2),
    };
    const angleRad = Math.atan2(end.y - start.y, end.x - start.x);
    const angleDeg = (angleRad * 180) / Math.PI;

    edges.push({
      index: i,
      start,
      end,
      midPoint,
      lengthPixels: lenPx,
      lengthMeters: Math.round((lenPx / PIXELS_PER_METER) * 100) / 100,
      angleDeg,
    });
  }

  return edges;
}

/**
 * Inserts a new vertex along an edge at edgeIndex, splitting the wall into two segments
 */
export function insertVertexInPolygon(
  polygon: Point[],
  edgeIndex: number,
  newPoint?: Point
): Point[] {
  if (!polygon || polygon.length < 3) return polygon;
  const insertAt = (edgeIndex + 1) % (polygon.length + 1);
  const start = polygon[edgeIndex];
  const end = polygon[(edgeIndex + 1) % polygon.length];
  const ptToInsert = newPoint || {
    x: Math.round((start.x + end.x) / 2),
    y: Math.round((start.y + end.y) / 2),
  };

  const next = [...polygon];
  next.splice(edgeIndex + 1, 0, ptToInsert);
  return next;
}

/**
 * Removes a vertex from a polygon if it has at least 4 vertices
 */
export function removeVertexFromPolygon(polygon: Point[], vertexIndex: number): Point[] {
  if (!polygon || polygon.length <= 3) return polygon;
  return polygon.filter((_, idx) => idx !== vertexIndex);
}

/**
 * Calculates the total perimeter of a polygon in meters
 */
export function polygonPerimeterInMeters(polygon: Point[]): number {
  if (!polygon || polygon.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < polygon.length; i++) {
    const nextIdx = (i + 1) % polygon.length;
    total += distance(polygon[i], polygon[nextIdx]);
  }
  return Math.round((total / PIXELS_PER_METER) * 100) / 100;
}

export function closestPointOnSegment(p: Point, a: Point, b: Point): Point {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (l2 === 0) return { ...a };
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2)
  );
  return {
    x: Math.round(a.x + t * (b.x - a.x)),
    y: Math.round(a.y + t * (b.y - a.y)),
  };
}

export function pointToSegmentDistance(p: Point, a: Point, b: Point): number {
  const cp = closestPointOnSegment(p, a, b);
  return distance(p, cp);
}

export function doSegmentsIntersect(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point
): boolean {
  function ccw(A: Point, B: Point, C: Point) {
    return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
  }
  return (
    ccw(p1, p3, p4) !== ccw(p2, p3, p4) &&
    ccw(p1, p2, p3) !== ccw(p1, p2, p4)
  );
}

/**
 * Checks whether a line segment between p1 and p2 cuts through the interior or perimeter of a polygon
 */
export function segmentIntersectsPolygon(p1: Point, p2: Point, polygon: Point[]): boolean {
  if (!polygon || polygon.length < 3) return false;
  if (distance(p1, p2) < 2) return false;

  const edges = getPolygonEdges(polygon);
  for (const edge of edges) {
    if (doSegmentsIntersect(p1, p2, edge.start, edge.end)) {
      return true;
    }
  }

  // Check if interior midpoint or sample points are inside the polygon
  const samples = [0.25, 0.5, 0.75];
  for (const t of samples) {
    const pt: Point = {
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y),
    };
    if (pointInPolygon(pt, polygon)) {
      return true;
    }
  }

  return false;
}

/**
 * Validates whether a corridor path segment from p1 to p2 has a clear line-of-sight
 * without cutting through foreign room boundaries or impenetrable solid walls.
 */
export function hasClearLineOfSight(
  p1: Point,
  p2: Point,
  rooms: { id: string; polygon: Point[] }[],
  ignoreRoomIds: string[] = []
): boolean {
  if (distance(p1, p2) < 2) return true;

  for (const room of rooms) {
    if (ignoreRoomIds.includes(room.id)) continue;
    if (segmentIntersectsPolygon(p1, p2, room.polygon)) {
      return false;
    }
  }

  return true;
}



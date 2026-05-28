interface LatLng {
  latitud: number
  longitud: number
}

interface SnappedPoint {
  lat: number
  lng: number
}

function closestPointOnSegment(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): { x: number; y: number; distSq: number } {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return { x: ax, y: ay, distSq: (px - ax) ** 2 + (py - ay) ** 2 }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))
  const cx = ax + t * dx
  const cy = ay + t * dy
  return { x: cx, y: cy, distSq: (px - cx) ** 2 + (py - cy) ** 2 }
}

export function snapToPolyline(lat: number, lng: number, shape: LatLng[]): SnappedPoint {
  if (shape.length === 0) return { lat, lng }
  if (shape.length === 1) return { lat: shape[0].latitud, lng: shape[0].longitud }

  let best = { x: shape[0].latitud, y: shape[0].longitud, distSq: Infinity }

  for (let i = 0; i < shape.length - 1; i++) {
    const a = shape[i]
    const b = shape[i + 1]
    const candidate = closestPointOnSegment(
      lat, lng,
      a.latitud, a.longitud,
      b.latitud, b.longitud,
    )
    if (candidate.distSq < best.distSq) best = candidate
  }

  return { lat: best.x, lng: best.y }
}

export interface LatLng { lat: number; lng: number }

// Centripetal parameterization (alpha=0.5) prevents cusps and self-intersections
// at sharp corners — a known limitation of uniform Catmull-Rom.
function tj(ti: number, pi: LatLng, pj: LatLng): number {
  const dx = pj.lat - pi.lat
  const dy = pj.lng - pi.lng
  return ti + Math.pow(Math.sqrt(dx * dx + dy * dy), 0.5)
}

function lerpPt(a: LatLng, b: LatLng, ta: number, tb: number, t: number): LatLng {
  if (Math.abs(tb - ta) < 1e-10) return { lat: a.lat, lng: a.lng }
  const r = (t - ta) / (tb - ta)
  return { lat: a.lat + r * (b.lat - a.lat), lng: a.lng + r * (b.lng - a.lng) }
}

function crPoint(p0: LatLng, p1: LatLng, p2: LatLng, p3: LatLng, t: number): LatLng {
  const t0 = 0
  const t1 = tj(t0, p0, p1)
  const t2 = tj(t1, p1, p2)
  const t3 = tj(t2, p2, p3)
  const tc = t1 + t * (t2 - t1)

  const A1 = lerpPt(p0, p1, t0, t1, tc)
  const A2 = lerpPt(p1, p2, t1, t2, tc)
  const A3 = lerpPt(p2, p3, t2, t3, tc)
  const B1 = lerpPt(A1, A2, t0, t2, tc)
  const B2 = lerpPt(A2, A3, t1, t3, tc)
  return lerpPt(B1, B2, t1, t2, tc)
}

export function catmullRomSmooth(points: LatLng[], segments = 4): LatLng[] {
  if (points.length < 2) return points
  const pts = [points[0], ...points, points[points.length - 1]]
  const result: LatLng[] = []
  for (let i = 1; i < pts.length - 2; i++) {
    for (let j = 0; j < segments; j++) {
      result.push(crPoint(pts[i - 1], pts[i], pts[i + 1], pts[i + 2], j / segments))
    }
  }
  result.push(points[points.length - 1])
  return result
}

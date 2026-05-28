const EARTH_RADIUS_M = 6_371_000

interface LatLng {
  latitud: number
  longitud: number
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.latitud - a.latitud)
  const dLng = toRad(b.longitud - a.longitud)
  const sinDLat = Math.sin(dLat / 2)
  const sinDLng = Math.sin(dLng / 2)
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.latitud)) * Math.cos(toRad(b.latitud)) * sinDLng * sinDLng
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

import type { BusUbicacion, LineaEMT, LlegadaLinea, ParadaEMT, ShapesByDirection } from '../types/emt.types'

export async function fetchLineas(): Promise<LineaEMT[]> {
  const res = await fetch('/api/emt/lineas')
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `Error ${res.status} al obtener líneas`)
  }
  return res.json()
}

export async function fetchUbicaciones(linea: string): Promise<BusUbicacion[]> {
  const res = await fetch(`/api/emt/ubicaciones?linea=${encodeURIComponent(linea)}`, { cache: 'no-store' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `Error ${res.status} al obtener ubicaciones`)
  }
  return res.json()
}

export async function fetchParadas(linea: string): Promise<ParadaEMT[]> {
  const res = await fetch(`/api/emt/paradas?linea=${encodeURIComponent(linea)}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `Error ${res.status} al obtener paradas`)
  }
  return res.json()
}

export async function fetchShapes(linea: string): Promise<ShapesByDirection> {
  const res = await fetch(`/api/emt/shapes?linea=${encodeURIComponent(linea)}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `Error ${res.status} al obtener shapes`)
  }
  return res.json()
}

export async function fetchLlegadas(parada: string): Promise<LlegadaLinea[]> {
  const res = await fetch(`/api/emt/llegadas?parada=${encodeURIComponent(parada)}`)
  console.warn('fetchLlegadas', parada, res)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `Error ${res.status} al obtener llegadas`)
  }
  console.warn('fetchLlegadas response:', await res.json())
  return res.json()
}

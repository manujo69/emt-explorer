'use client'

import { useEffect, useState } from 'react'
import { Polyline, Marker, useMap } from '@vis.gl/react-google-maps'
import { useEMTStore, selectLineaSeleccionada, selectSentidosActivos, selectSetParadaSeleccionada } from '../store/emtStore'
import { useParadas } from '../hooks/useParadas'
import { useShapes } from '../hooks/useShapes'
import { snapToPolyline } from '@/shared/utils/snapToPolyline'
import { catmullRomSmooth } from '@/shared/utils/catmullRomSmooth'
import { getSentidoColor } from '../utils/lineaColors'
import type { ParadaEMT } from '../types/emt.types'
const MIN_STOP_PX = 28

function stopIconSize(zoom: number): number {
  if (zoom >= 16) return 24
  if (zoom >= 15) return 16
  if (zoom >= 14) return 12
  if (zoom >= 13) return 10
  return 8
}

function groupBySentido(paradas: ParadaEMT[]): Map<number, ParadaEMT[]> {
  const map = new Map<number, ParadaEMT[]>()
  for (const p of paradas) {
    if (!map.has(p.sentido)) map.set(p.sentido, [])
    map.get(p.sentido)!.push(p)
  }
  return map
}

function toMercatorPx(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = (Math.pow(2, zoom) * 256) / 360
  const x = (lng + 180) * scale
  const latRad = (lat * Math.PI) / 180
  const y = (180 - (Math.log(Math.tan(Math.PI / 4 + latRad / 2)) * 180) / Math.PI) * scale
  return { x, y }
}

function thinParadas(paradas: ParadaEMT[], zoom: number): ParadaEMT[] {
  if (paradas.length <= 1) return paradas
  const result: ParadaEMT[] = [paradas[0]]
  for (let i = 1; i < paradas.length - 1; i++) {
    const last = result[result.length - 1]
    const a = toMercatorPx(last.latitud, last.longitud, zoom)
    const b = toMercatorPx(paradas[i].latitud, paradas[i].longitud, zoom)
    const dx = a.x - b.x
    const dy = a.y - b.y
    if (Math.sqrt(dx * dx + dy * dy) >= MIN_STOP_PX) result.push(paradas[i])
  }
  result.push(paradas[paradas.length - 1])
  return result
}

export function RutaLinea() {
  const linea = useEMTStore(selectLineaSeleccionada)
  const sentidosActivos = useEMTStore(selectSentidosActivos)
  const setParadaSeleccionada = useEMTStore(selectSetParadaSeleccionada)
  const { data: paradas = [] } = useParadas(linea)
  const { data: shapes = {} } = useShapes(linea)
  const map = useMap()
  const [zoom, setZoom] = useState<number>(() => map?.getZoom() ?? 13)

  useEffect(() => {
    if (!map) return
    const listener = map.addListener('zoom_changed', () => {
      setZoom(map.getZoom() ?? 13)
    })
    return () => window.google.maps.event.removeListener(listener)
  }, [map])

  if (!linea || paradas.length === 0) return null

  const hasShapes = Object.keys(shapes).length > 0
  const porSentido = groupBySentido(paradas)
  const paradasVisibles = thinParadas(
    paradas.filter(p => sentidosActivos.includes(p.sentido)),
    zoom,
  )

  return (
    <>
      {sentidosActivos.map(sentido => {
        const shapePts = shapes[sentido]
        if (hasShapes && (!shapePts || shapePts.length === 0)) return null
        const rawPath = hasShapes
          ? shapePts!.map(s => ({ lat: s.latitud, lng: s.longitud }))
          : (porSentido.get(sentido) ?? []).map(s => ({ lat: s.latitud, lng: s.longitud }))
        const path = catmullRomSmooth(rawPath, hasShapes ? 4 : 8)
        return (
          <Polyline
            key={`ruta-${sentido}`}
            path={path}
            strokeColor={getSentidoColor(linea, sentido)}
            strokeWeight={6}
            strokeOpacity={0.7}
          />
        )
      })}

      {paradasVisibles.map(p => {
        const shapeForSentido = shapes[p.sentido]
        const pos = shapeForSentido?.length
          ? snapToPolyline(p.latitud, p.longitud, shapeForSentido)
          : { lat: p.latitud, lng: p.longitud }
        const size = stopIconSize(zoom)
        const color = getSentidoColor(linea, p.sentido)
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
          <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="white" stroke="${color}" stroke-width="2"/>
        </svg>`
        const icon: google.maps.Icon = {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
          scaledSize: new window.google.maps.Size(size, size),
          anchor: new window.google.maps.Point(size / 2, size / 2),
        }
        return (
          <Marker
            key={`parada-${p.sentido}-${p.codParada}`}
            position={pos}
            zIndex={1}
            title={`${p.codParada} — ${p.nombreParada}`}
            icon={icon}
            onClick={() => setParadaSeleccionada({ codParada: p.codParada, nombreParada: p.nombreParada, latitud: pos.lat, longitud: pos.lng, sentido: p.sentido })}
          />
        )
      })}
    </>
  )
}

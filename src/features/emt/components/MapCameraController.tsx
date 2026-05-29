'use client'

import { useEffect } from 'react'
import { useMap } from 'react-map-gl/maplibre'
import { useEMTStore, selectLineaSeleccionada } from '../store/emtStore'
import { useParadas } from '../hooks/useParadas'

export function MapCameraController() {
  const linea = useEMTStore(selectLineaSeleccionada)
  const { data: paradas = [] } = useParadas(linea)
  const { current: map } = useMap()

  useEffect(() => {
    if (!linea || paradas.length === 0 || !map) return

    const lngs = paradas.map(p => p.longitud)
    const lats = paradas.map(p => p.latitud)
    const bounds: [number, number, number, number] = [
      Math.min(...lngs),
      Math.min(...lats),
      Math.max(...lngs),
      Math.max(...lats),
    ]

    map.fitBounds(bounds, { padding: 40 })
  }, [map, linea, paradas])

  return null
}

'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import { ErrorMessage } from '@/shared/components/ErrorMessage'
import { formatErrorMessage } from '@/shared/utils/formatErrorMessage'
import { useEMTStore, selectLineaSeleccionada, selectSentidosActivos } from '../store/emtStore'
import { useUbicaciones } from '../hooks/useUbicaciones'
import { useShapes } from '../hooks/useShapes'
import { snapToPolyline } from '@/shared/utils/snapToPolyline'
import { BusMarker } from './BusMarker'
import { RutaLinea } from './RutaLinea'
import { ParadaModal } from './ParadaModal'
import { MapCameraController } from './MapCameraController'

const MALAGA_CENTER: [number, number] = [36.7213, -4.4214]
const INITIAL_ZOOM = 13
const CARTO_POSITRON_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
const CARTO_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

function BusMarkersLayer() {
  const linea = useEMTStore(selectLineaSeleccionada)
  const sentidosActivos = useEMTStore(selectSentidosActivos)
  const { data: rawBuses = [] } = useUbicaciones(linea)
  const { data: shapes = {} } = useShapes(linea)
  const map = useMap()
  const [zoom, setZoom] = useState<number>(() => map.getZoom())

  useEffect(() => {
    const handler = () => setZoom(map.getZoom())
    map.on('zoomend', handler)
    return () => { map.off('zoomend', handler) }
  }, [map])

  const buses = rawBuses
    .filter(b => sentidosActivos.includes(b.sentido))
    .map(b => {
      const shape = shapes[b.sentido]
      if (!shape?.length) return b
      const snapped = snapToPolyline(b.latitud, b.longitud, shape)
      return { ...b, latitud: snapped.lat, longitud: snapped.lng }
    })

  return (
    <>
      {buses.map(bus => (
        <BusMarker key={bus.codBus} bus={bus} zoom={zoom} />
      ))}
    </>
  )
}

export function MapaEMT() {
  const linea = useEMTStore(selectLineaSeleccionada)
  const { isLoading, isError, error, isStale } = useUbicaciones(linea)

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={MALAGA_CENTER}
        zoom={INITIAL_ZOOM}
        className="h-full w-full"
      >
        <TileLayer url={CARTO_POSITRON_URL} attribution={CARTO_ATTRIBUTION} />
        <MapCameraController />
        <RutaLinea />
        <BusMarkersLayer />
        <ParadaModal />
      </MapContainer>

      {isLoading && (
        <div className="absolute right-2 top-2 rounded-md bg-white p-2 shadow-md">
          <LoadingSpinner label="Actualizando posiciones..." />
        </div>
      )}

      {isStale && !isLoading && !isError && (
        <div role="status" className="absolute right-2 top-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 shadow-md">
          Datos desactualizados
        </div>
      )}

      {isError && (
        <div className="absolute right-2 top-2 max-w-xs">
          <ErrorMessage message={formatErrorMessage(error)} />
        </div>
      )}
    </div>
  )
}

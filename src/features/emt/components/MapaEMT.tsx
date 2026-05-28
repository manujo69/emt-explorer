'use client'

import { useEffect, useState } from 'react'
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import { ErrorMessage } from '@/shared/components/ErrorMessage'
import { formatErrorMessage } from '@/shared/utils/formatErrorMessage'
import { useEMTStore, selectLineaSeleccionada, selectSentidosActivos } from '../store/emtStore'
import MAP_STYLES from '../utils/mapStyles'
import { useUbicaciones } from '../hooks/useUbicaciones'
import { useShapes } from '../hooks/useShapes'
import { snapToPolyline } from '@/shared/utils/snapToPolyline'
import { BusMarker } from './BusMarker'
import { RutaLinea } from './RutaLinea'
import { ParadaModal } from './ParadaModal'
import { MapCameraController } from './MapCameraController'

const MALAGA_CENTER = { lat: 36.7213, lng: -4.4214 }
const INITIAL_ZOOM = 13

function BusMarkersLayer() {
  const linea = useEMTStore(selectLineaSeleccionada)
  const sentidosActivos = useEMTStore(selectSentidosActivos)
  const { data: rawBuses = [] } = useUbicaciones(linea)
  const { data: shapes = {} } = useShapes(linea)
  const map = useMap()
  const [zoom, setZoom] = useState<number>(() => map?.getZoom() ?? INITIAL_ZOOM)

  useEffect(() => {
    if (!map) return
    const listener = map.addListener('zoom_changed', () => {
      setZoom(map.getZoom() ?? INITIAL_ZOOM)
    })
    return () => window.google.maps.event.removeListener(listener)
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
      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
        <Map
          defaultCenter={MALAGA_CENTER}
          defaultZoom={INITIAL_ZOOM}
          styles={MAP_STYLES}
          mapTypeControl={false}
          className="h-full w-full"
        >
          <MapCameraController />
          <RutaLinea />
          <BusMarkersLayer />
          <ParadaModal />
        </Map>
      </APIProvider>

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

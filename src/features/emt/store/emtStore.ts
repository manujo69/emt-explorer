import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface ParadaSeleccionada {
  codParada: string
  nombreParada: string
  latitud: number
  longitud: number
  sentido: number
}

interface EMTState {
  lineaSeleccionada: string | null
  sentidosActivos: number[]
  paradaSeleccionada: ParadaSeleccionada | null
}

interface EMTActions {
  setLineaSeleccionada: (linea: string | null) => void
  toggleSentido: (sentido: number) => void
  setParadaSeleccionada: (parada: ParadaSeleccionada | null) => void
}

type EMTStoreType = EMTState & EMTActions

export const useEMTStore = create<EMTStoreType>()(
  devtools(
    (set) => ({
      lineaSeleccionada: null,
      sentidosActivos: [1, 2],
      paradaSeleccionada: null,
      setLineaSeleccionada: (linea) => set({ lineaSeleccionada: linea, sentidosActivos: [1, 2], paradaSeleccionada: null }),
      toggleSentido: (sentido) =>
        set((state) => {
          const isActive = state.sentidosActivos.includes(sentido)
          const next = isActive
            ? state.sentidosActivos.filter((s) => s !== sentido)
            : [...state.sentidosActivos, sentido]
          return { sentidosActivos: next.length === 0 ? [sentido === 1 ? 2 : 1] : next }
        }),
      setParadaSeleccionada: (parada) => set({ paradaSeleccionada: parada }),
    }),
    { name: 'emt-store' },
  ),
)

export const selectLineaSeleccionada = (s: EMTStoreType): string | null =>
  s.lineaSeleccionada

export const selectSetLineaSeleccionada = (s: EMTStoreType): EMTActions['setLineaSeleccionada'] =>
  s.setLineaSeleccionada

export const selectSentidosActivos = (s: EMTStoreType): number[] =>
  s.sentidosActivos

export const selectToggleSentido = (s: EMTStoreType): EMTActions['toggleSentido'] =>
  s.toggleSentido

export const selectParadaSeleccionada = (s: EMTStoreType): ParadaSeleccionada | null =>
  s.paradaSeleccionada

export const selectSetParadaSeleccionada = (s: EMTStoreType): EMTActions['setParadaSeleccionada'] =>
  s.setParadaSeleccionada

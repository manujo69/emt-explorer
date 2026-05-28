'use client'

import { useQuery } from '@tanstack/react-query'
import { emtKeys } from '../services/emtQueryKeys'
import { fetchUbicaciones } from '../services/emtApi'

export function useUbicaciones(linea: string | null) {
  return useQuery({
    queryKey: emtKeys.ubicaciones(linea ?? ''),
    queryFn: () => fetchUbicaciones(linea!),
    enabled: Boolean(linea),
    refetchInterval: 30_000,
    staleTime: 25_000,
    refetchOnWindowFocus: true,
    retry: 1,
  })
}

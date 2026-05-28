'use client'

import { useQuery } from '@tanstack/react-query'
import { emtKeys } from '../services/emtQueryKeys'
import { fetchShapes } from '../services/emtApi'

export function useShapes(linea: string | null) {
  return useQuery({
    queryKey: emtKeys.shapes(linea ?? ''),
    queryFn: () => fetchShapes(linea!),
    enabled: Boolean(linea),
    staleTime: 1_800_000,
  })
}

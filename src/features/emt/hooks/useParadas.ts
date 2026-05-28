'use client'

import { useQuery } from '@tanstack/react-query'
import { emtKeys } from '../services/emtQueryKeys'
import { fetchParadas } from '../services/emtApi'

export function useParadas(linea: string | null) {
  return useQuery({
    queryKey: emtKeys.paradas(linea ?? ''),
    queryFn: () => fetchParadas(linea!),
    enabled: Boolean(linea),
    staleTime: 3_600_000,
    retry: 1,
  })
}

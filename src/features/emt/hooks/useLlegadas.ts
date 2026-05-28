'use client'

import { useQuery } from '@tanstack/react-query'
import { emtKeys } from '../services/emtQueryKeys'
import { fetchLlegadas } from '../services/emtApi'

export function useLlegadas(codParada: string | null) {
  return useQuery({
    queryKey: emtKeys.llegadas(codParada ?? ''),
    queryFn: () => fetchLlegadas(codParada!),
    enabled: Boolean(codParada),
    refetchInterval: 30_000,
    staleTime: 25_000,
    retry: 1,
  })
}

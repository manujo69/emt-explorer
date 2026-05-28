'use client'

import { useQuery } from '@tanstack/react-query'
import { emtKeys } from '../services/emtQueryKeys'
import { fetchLineas } from '../services/emtApi'

export function useLineas() {
  return useQuery({
    queryKey: emtKeys.lineas(),
    queryFn: fetchLineas,
    staleTime: 55_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
  })
}

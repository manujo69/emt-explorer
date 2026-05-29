'use client'

import dynamic from 'next/dynamic'
import { LineaSelector } from '@/features/emt/components/LineaSelector'
import { SentidoFilter } from '@/features/emt/components/SentidoFilter'
import { MapSkeleton } from '@/shared/components/MapSkeleton'

const MapaEMT = dynamic(
  () => import('@/features/emt/components/MapaEMT').then(m => m.MapaEMT),
  { loading: () => <MapSkeleton />, ssr: false },
)

export function AppShell() {
  return (
    <main className="flex h-screen flex-col overflow-hidden">
      <header className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-800 shrink-0 whitespace-nowrap">EMT Málaga</h1>
        <div className="flex items-center gap-4 min-w-0">
          <LineaSelector />
          <div className="shrink-0">
            <SentidoFilter />
          </div>
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-hidden">
        <MapaEMT />
      </div>
    </main>
  )
}

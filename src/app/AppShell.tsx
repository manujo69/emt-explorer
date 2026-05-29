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
    <main className="flex h-screen flex-col">
      <header className="flex items-center gap-4 border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-800">EMT Málaga</h1>
        <LineaSelector />
        <SentidoFilter />
      </header>
      <div className="flex-1">
        <MapaEMT />
      </div>
    </main>
  )
}

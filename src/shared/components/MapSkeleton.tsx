'use client'

export function MapSkeleton() {
  return (
    <div
      role="status"
      aria-label="Cargando mapa..."
      className="h-full w-full animate-pulse bg-gray-200"
    />
  )
}

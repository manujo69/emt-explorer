'use client'

interface LoadingSpinnerProps {
  label?: string
}

export function LoadingSpinner({ label = 'Cargando...' }: LoadingSpinnerProps) {
  return (
    <div role="status" className="flex items-center gap-2">
      <div
        className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
        aria-hidden="true"
      />
      <span className="text-sm text-gray-600">{label}</span>
    </div>
  )
}

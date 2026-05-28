'use client'

interface ErrorMessageProps {
  message: string
  onRetry?: () => void
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-md border border-red-200 bg-red-50 p-3">
      <p className="text-sm text-red-700">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="self-start rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
        >
          Reintentar
        </button>
      )}
    </div>
  )
}

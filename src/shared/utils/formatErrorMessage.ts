export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return 'Ha ocurrido un error inesperado. Por favor, inténtalo de nuevo.'
}

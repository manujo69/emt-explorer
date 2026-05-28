export const emtKeys = {
  all: ['emt'] as const,
  lineas: () => ['emt', 'lineas'] as const,
  ubicaciones: (linea: string) => ['emt', 'ubicaciones', linea] as const,
  paradas: (linea: string) => ['emt', 'paradas', linea] as const,
  llegadas: (parada: string) => ['emt', 'llegadas', parada] as const,
  shapes: (linea: string) => ['emt', 'shapes', linea] as const,
} as const

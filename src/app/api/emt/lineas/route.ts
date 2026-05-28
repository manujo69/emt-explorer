import { NextResponse } from 'next/server'
import { EMT_LINEAS_URL } from '../constants'
import { parseLineasCSV } from '@/shared/utils/csvParser'

export async function GET(): Promise<NextResponse> {
  try {
    const res = await fetch(EMT_LINEAS_URL, { next: { revalidate: 1800 } })

    if (!res.ok) {
      return NextResponse.json(
        { error: `Error al obtener líneas del origen: ${res.statusText}` },
        { status: res.status },
      )
    }

    const LINEAS_EXCLUIDAS = new Set(['91', '92', '93'])

    const csv = await res.text()
    const lineas = parseLineasCSV(csv)
      .filter(l => !LINEAS_EXCLUIDAS.has(l.codLinea))
    lineas.sort((a, b) => a.codLinea.localeCompare(b.codLinea))

    return NextResponse.json(lineas)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json(
      { error: `Error interno al procesar líneas: ${message}` },
      { status: 500 },
    )
  }
}

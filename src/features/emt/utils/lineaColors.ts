const LINEA_COLOR: Record<string, string> = {
  '1':   '#D1DB8F',
  '2':   '#E38C3B',
  '3':   '#002292',
  '4':   '#6DBA4A',
  '5':   '#ED2630',
  '7':   '#F3E62B',
  '8':   '#F3E62B',
  '9':   '#002292',
  '10':  '#F19C2A',
  '11':  '#ED2630',
  '14':  '#E38C3B',
  '15':  '#EE4146',
  '17':  '#F1BA87',
  '18':  '#0F2F98',
  '19':  '#000000',
  '20':  '#6DBA4A',
  '21':  '#EE894E',
  '22':  '#F08646',
  '23':  '#449ECE',
  '25':  '#EB8A52',
  '27':  '#16ADEA',
  '28':  '#6DBA4A',
  '29':  '#3C9613',
  '30':  '#EA2629',
  '31':  '#F3E62B',
  '32':  '#F1A355',
  '33':  '#5CCCE3',
  '34':  '#F3E62B',
  '35':  '#9BCA61',
  '36':  '#F079AB',
  '37':  '#E38C3B',
  '38':  '#F3E62B',
  '40':  '#9F95CB',
  // Líneas nocturnas — código numérico (API) y letra (alias)
  '41':  '#EA2629', 'N1': '#EA2629',
  '42':  '#16ADEA', 'N2': '#16ADEA',
  '43':  '#002292', 'N3': '#002292',
  '44':  '#20A24F', 'N4': '#20A24F',
  // Servicios especiales
  '65':  '#F19440', 'L':  '#F19440',
  '70':  '#2B7313', 'E':  '#2B7313',
  '92':  '#EE4146',
  '93':  '#16ADEA',
  // Líneas circulares
  'A':   '#EE4146', '75':  '#EE4146',
  'C1':  '#4B8DCA', '71':  '#4B8DCA',
  'C2':  '#2CCD3D', '72':  '#2CCD3D',
  'C3':  '#EE32ED', '73':  '#EE32ED',
  'C5':  '#20A24F', '62':  '#20A24F',
  'C6':  '#ED2630', '76':  '#ED2630',
  'C8':  '#ED2630', '78':  '#ED2630',
}

const FALLBACK = '#6b7280'

const LINEA_LABEL: Record<string, string> = {
  '41': 'N1', '42': 'N2', '43': 'N3', '44': 'N4',
  '62': 'C5', '65': 'L',  '70': 'E',  '75': 'A',
  '71': 'C1', '72': 'C2', '73': 'C3',
  '76': 'C6', '78': 'C8',
}

export function getLineaLabel(codLinea: string, nombreLinea?: string): string {
  if (LINEA_LABEL[codLinea]) return LINEA_LABEL[codLinea]
  if (nombreLinea) {
    const noctMatch = /\bNocturno\s+(\d+)/i.exec(nombreLinea)
    if (noctMatch) return `N${noctMatch[1]}`
    const circMatch = /\bCIRCULAR\s+(\d+)/i.exec(nombreLinea)
    if (circMatch) return `C${circMatch[1]}`
    const cMatch = /\b(C[3568])\b/.exec(nombreLinea)
    if (cMatch) return cMatch[1]
    if (/Aeropuerto/i.test(nombreLinea)) return 'A'
  }
  return codLinea
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b]
    .map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
    .join('')
}

function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount))
}

export function getLineaColor(codLinea: string | null): string {
  return LINEA_COLOR[codLinea ?? ''] ?? FALLBACK
}

export function getSentidoColor(codLinea: string | null, sentido: number): string {
  const base = LINEA_COLOR[codLinea ?? ''] ?? FALLBACK
  return sentido === 1 ? darken(base, 0.3) : base
}

export function getTextShadow(textColor: '#ffffff' | '#000000'): string {
  return textColor === '#ffffff'
    ? '0 1px 1px rgba(0,0,0,0.55)'
    : '0 1px 1px rgba(255,255,255,0.55)'
}

export function getTextColor(hex: string): '#ffffff' | '#000000' {
  const [r, g, b] = hexToRgb(hex)
  const toLinear = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
  return L > 0.25 ? '#000000' : '#ffffff'
}

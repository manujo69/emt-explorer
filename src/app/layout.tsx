import type { Metadata } from 'next'
import { Providers } from '@/providers/Providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'EMT Málaga Map',
  description: 'Mapa en tiempo real de los autobuses de la EMT de Málaga',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

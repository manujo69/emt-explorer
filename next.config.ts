import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  devIndicators: false,
  outputFileTracingIncludes: {
    '/api/emt/shapes': ['./data/gtfs/**'],
  },
}

export default nextConfig

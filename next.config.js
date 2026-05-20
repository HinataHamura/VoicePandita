/** @type {import('next').NextConfig} */
let nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] },
    cpus: 1,
  },
}

try {
  const withPWA = require('next-pwa')({
    dest: 'public',
    disable: process.env.NODE_ENV === 'development',
    register: true,
    skipWaiting: true,
  })
  module.exports = withPWA(nextConfig)
} catch {
  // next-pwa not installed yet - run without PWA for now
  module.exports = nextConfig
}

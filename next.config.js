/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [],

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Stops the browser from guessing content types
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          // Prevents Sam from being embedded in iframes on other sites (clickjacking)
          { key: 'X-Frame-Options',           value: 'DENY' },
          // Stops browsers from sending the full URL to third parties in Referer header
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          // Prevents the browser from storing Sam pages in shared caches
          { key: 'Cache-Control',             value: 'no-store' },
          // Locks down what the page can load — prevents XSS via injected scripts
          {
            key:   'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval needed by Next.js dev
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com",
              "font-src 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig

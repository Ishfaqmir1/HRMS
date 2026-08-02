/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  // ─── Package imports optimization ──────────────────────────────────────
  // Prevents barrel imports from bundling entire libraries — critical for
  // lucide-react (tree-shakes individual icon imports) and recharts.
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-dropdown-menu',
      '@tanstack/react-query',
      '@tanstack/react-table',
    ],
  },

  async rewrites() {
    return [
      {
        source: '/storage/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/storage/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;

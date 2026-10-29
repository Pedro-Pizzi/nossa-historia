import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Fotos privadas devem passar sempre pela rota que verifica a sessão.
  images: { unoptimized: true },
  serverExternalPackages: ["pg", "@electric-sql/pglite"],
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Cache-Control", value: "private, no-store, max-age=0" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
      ],
    }];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Evita que o Next adote um lockfile de diretórios acima do projeto.
    root: __dirname,
  },
  images: {
    // Thumbnails automáticas dos vídeos do YouTube (seção VIDEOS).
    remotePatterns: [new URL("https://i.ytimg.com/vi/**")],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // O site não deve ser embutido em iframes de terceiros (clickjacking, sobretudo no /painel).
          // Não afeta os players do Spotify/YouTube que o site embute.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;

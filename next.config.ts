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
};

export default nextConfig;

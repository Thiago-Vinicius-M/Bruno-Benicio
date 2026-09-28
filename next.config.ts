import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Evita que o Next adote um lockfile de diretórios acima do projeto.
    root: __dirname,
  },
};

export default nextConfig;

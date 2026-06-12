import type { NextConfig } from 'next';

// Static export: build generuje czyste HTML-e do out/ (spec renderu, sekcja „Architektura").
// trailingSlash daje out/tabela/index.html zamiast out/tabela.html — przewidywalne ścieżki.
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
};

export default nextConfig;

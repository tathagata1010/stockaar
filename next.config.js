/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // pdfjs-dist ships .mjs files that webpack's RSC bundler mishandles
    // (throws "Object.defineProperty called on non-object"). Load it at runtime
    // from node_modules instead so Node's native ESM loader handles it.
    serverComponentsExternalPackages: ["pdf-parse", "pdfjs-dist"],
  },
};
module.exports = nextConfig;

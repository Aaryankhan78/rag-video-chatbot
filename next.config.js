/** @type {import('next').NextConfig} */
const nextConfig = {
  // had issues with chromadb trying to use node apis in edge runtime
  // keeping everything in nodejs runtime
  experimental: {
    serverComponentsExternalPackages: ["chromadb", "langchain"],
  },
};

module.exports = nextConfig;

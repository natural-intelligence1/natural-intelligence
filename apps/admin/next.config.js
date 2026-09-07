/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@natural-intelligence/db", "@natural-intelligence/design-tokens", "@natural-intelligence/ui"],
  experimental: {
    // Ensure the canonical role-route document is bundled into the serverless
    // build so the /route-map panel can read it at runtime.
    outputFileTracingIncludes: {
      "/route-map": ["./ROLE-ROUTE-MAP.md"],
    },
  },
}

module.exports = nextConfig

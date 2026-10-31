import type { NextConfig } from "next";

// Para abrir o app pelo celular em desenvolvimento, informe o IP do computador em DEV_ORIGINS
// (ex.: DEV_ORIGINS=192.168.0.20). Ver docs/07-base-nextjs.md.
const origensDev = process.env.DEV_ORIGINS?.split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(origensDev?.length ? { allowedDevOrigins: origensDev } : {}),
};

export default nextConfig;

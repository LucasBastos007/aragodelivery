import type { NextConfig } from "next"

const securityHeaders = [
  // Impede clickjacking — página não pode ser colocada em iframe de outro domínio
  { key: "X-Frame-Options", value: "DENY" },
  // Impede MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Limita informação de referer ao origin
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Força HTTPS por 1 ano (ativar só após confirmar HTTPS em produção)
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Desativa permissões de câmera/microfone desnecessárias; geolocation só com permissão
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), usb=()" },
  // DNS prefetch para performance
  { key: "X-DNS-Prefetch-Control", value: "on" },
]

const nextConfig: NextConfig = {
  // Esconde o header X-Powered-By: Next.js para não vazar tecnologia
  poweredByHeader: false,

  async headers() {
    return [
      {
        // Security headers em todas as rotas
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // sw.js nunca deve ser cacheado — browser precisa buscar a versão mais recente
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        // manifest.json também sempre fresco
        source: "/manifest.json",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ]
  },
}

export default nextConfig

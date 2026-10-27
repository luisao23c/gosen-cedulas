import type { NextConfig } from "next";

/**
 * Orígenes admitidos para los recursos internos del modo desarrollo
 * (`/_next/*`, el websocket del HMR y las fuentes de `next/font`).
 *
 * Next solo acepta `localhost` de serie. Si el servidor de desarrollo se abre
 * desde el celular por la red local (`http://192.168.x.x:3000`) o por un túnel
 * (Cloudflare, ngrok…), esos recursos internos se responden con **403** y el
 * navegador del teléfono se queda con el HTML que mandó el servidor, pero **sin
 * React**: los botones no abren los diálogos, los selectores no responden y el
 * mapa no se dibuja (nunca se ejecuta el efecto que carga Leaflet).
 *
 * Solo afecta a `next dev`: la app compilada (`next build` + `next start`) no
 * aplica esta comprobación, así que en producción no hace falta tocar nada.
 */

const esProduccion = process.env.NODE_ENV === "production";

/**
 * Política de contenido (solo producción: el modo desarrollo necesita `eval` y websockets).
 *
 * Next y MUI (emotion) insertan scripts y estilos en línea, por eso `'unsafe-inline'`; lo que sí
 * se cierra es todo lo demás: nada de plugins, nada de incrustar la app en otro sitio, formularios
 * solo hacia sí misma y conexiones/imágenes solo a los servicios que el mapa necesita
 * (teselas y buscador de OpenStreetMap).
 */
const POLITICA_DE_CONTENIDO = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
  "font-src 'self' data:",
  "connect-src 'self' https://nominatim.openstreetmap.org",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const CABECERAS_DE_SEGURIDAD = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // La ubicación solo se usa en la propia app (mapa y checada de llegada); nada más
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=()" },
  ...(esProduccion
    ? [
        { key: "Content-Security-Policy", value: POLITICA_DE_CONTENIDO },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      ]
    : []),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: [
    // La PC en la red local, que es la dirección que se abre desde el celular
    "192.168.1.13",
    // Túneles rápidos de Cloudflare: la URL cambia en cada arranque
    "*.trycloudflare.com",
  ],
  // No anunciar con qué está hecho el servidor
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: CABECERAS_DE_SEGURIDAD },
      // El service worker nunca se guarda en caché: así una versión nueva llega a todos al abrir la app
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;

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
const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: [
    // La PC en la red local, que es la dirección que se abre desde el celular
    "192.168.1.13",
    // Túneles rápidos de Cloudflare: la URL cambia en cada arranque
    "*.trycloudflare.com",
  ],
};

export default nextConfig;

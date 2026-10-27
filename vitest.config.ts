import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * Pruebas automáticas (`npm test`).
 *
 *  · `pruebas/unidad`      → lógica pura (permisos, ranking, fases del préstamo, fechas, validaciones).
 *                            No necesitan base de datos.
 *  · `pruebas/integracion` → capa de datos contra una base MySQL de PRUEBA (`gosen_test`). Si MySQL
 *                            no responde, se saltan solas. Ver `npm run db:preparar-pruebas`.
 */
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['pruebas/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20000,
    // Las pruebas de integración comparten una base: se ejecutan una detrás de otra
    fileParallelism: false,
    // La capa de datos lee estas variables al importarse. Se fijan aquí (y no se heredan de la
    // terminal) para que una variable de la base real —o de una remota— nunca llegue a las pruebas.
    env: {
      DB_HOST: process.env.DB_HOST_PRUEBAS ?? '127.0.0.1',
      DB_PUERTO: process.env.DB_PUERTO_PRUEBAS ?? '3306',
      DB_USUARIO: process.env.DB_USUARIO_PRUEBAS ?? 'gosen',
      DB_CONTRASENA: process.env.DB_CONTRASENA_PRUEBAS ?? 'gosen_dev',
      DB_NOMBRE: process.env.DB_NOMBRE_PRUEBAS ?? 'gosen_test',
      DB_SSL: 'false',
      DB_CONEXIONES: '4',
    },
  },
})

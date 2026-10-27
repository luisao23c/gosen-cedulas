/**
 * Conexión de ADMINISTRACIÓN para los scripts que crean o alteran tablas (migraciones, setup).
 *
 *  · MySQL propio:  usa root (DB_USUARIO_ROOT / DB_CONTRASENA_ROOT), porque el usuario de la
 *    aplicación no tiene permiso para crear ni alterar tablas.
 *  · Base gestionada (Aiven, TiDB…): DB_REMOTA=true usa la cuenta del proveedor
 *    (DB_USUARIO / DB_CONTRASENA), que ya puede alterar su propia base.
 *  · DB_SSL=true activa TLS (las bases gestionadas lo exigen).
 */
export function configuracionAdmin() {
  const remota = process.env.DB_REMOTA === 'true'
  return {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PUERTO ?? 3306),
    user: remota ? (process.env.DB_USUARIO ?? 'gosen') : (process.env.DB_USUARIO_ROOT ?? 'root'),
    password: remota ? (process.env.DB_CONTRASENA ?? '') : (process.env.DB_CONTRASENA_ROOT ?? ''),
    database: process.env.DB_NOMBRE ?? 'gosen',
    ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
  }
}

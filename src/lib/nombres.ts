/**
 * Utilidades de presentación de nombres (infraestructura, por eso en inglés
 * el nombre de archivo, pero el vocabulario del dominio va en español).
 */

/**
 * Iniciales para avatares: primeras letras de las dos primeras palabras.
 * «María Gómez Ruiz» → «MG» · «Administrador» → «A».
 */
export function inicialesDe(nombre: string): string {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte.charAt(0))
    .join('')
    .toUpperCase()
}

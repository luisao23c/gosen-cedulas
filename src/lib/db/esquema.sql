-- ============================================================
--  Gosen · esquema de base de datos (MySQL 8.4 / utf8mb4)
--  Se aplica con:  npm run db:setup
--  ⚠️  REINICIA los datos: borra las tablas y las vuelve a crear
--      con los datos de prueba (desarrollo).
-- ============================================================

SET NAMES utf8mb4;

-- Reinicio completo: el orden de borrado importa mientras haya claves ajenas,
-- por eso se apagan las comprobaciones SOLO durante este archivo.
SET FOREIGN_KEY_CHECKS = 0;
-- `cedula` es el nombre ANTERIOR de `celula` (ver npm run db:migrar-celulas):
-- se incluye en el borrado para que una base a medio migrar no deje una tabla
-- huérfana con claves ajenas apuntando a la que sí se va a crear.
DROP TABLE IF EXISTS rol_permiso, servidor_evento, evento, prestamo, equipo, ministerio,
  celula_criterio_opcion, celula_criterio, integrante_respuesta, campo_opcion, campo,
  asistencia, reunion, integrante, usuario, celula, cedula, rama, rol;
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- RAMA — unidad superior, contiene varias células
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rama (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre      VARCHAR(120) NOT NULL,
  descripcion VARCHAR(500) NULL,
  lider_id    INT UNSIGNED NULL,          -- usuario líder de la rama
  activa      TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rama_nombre (nombre),
  KEY idx_rama_lider (lider_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- CELULA — unidad operativa dentro de una rama
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS celula (
  id         INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  rama_id    INT UNSIGNED    NOT NULL,
  nombre     VARCHAR(120)    NOT NULL,
  lider_id   INT UNSIGNED    NULL,        -- usuario líder de la célula
  dia_semana TINYINT         NULL,        -- 0 domingo … 6 sábado
  hora       TIME            NULL,        -- HH:MM de la reunión
  latitud    DECIMAL(10,7)   NULL,        -- punto marcado en el mapa
  longitud   DECIMAL(10,7)   NULL,
  direccion  VARCHAR(300)    NULL,        -- dirección aproximada del punto
  activa     TINYINT(1)      NOT NULL DEFAULT 1,
  creado_en  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_celula_rama_nombre (rama_id, nombre),
  KEY idx_celula_rama (rama_id),
  KEY idx_celula_lider (lider_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- INTEGRANTE — persona inscrita en una célula (no es una cuenta)
--   `situacion` es la pertenencia (activo/visitante/inactivo/egresado), que no
--   hay que confundir con `origen_estado` (de dónde es la persona).
--   La ubicación se marca en el mapa: NO hay domicilio escrito a mano (MEMORY §7).
--   «Desactivar en vez de borrar» (MEMORY §4): la baja es situacion=INACTIVO.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS integrante (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  celula_id        INT UNSIGNED NOT NULL,
  nombre           VARCHAR(120) NOT NULL,
  apellido_paterno VARCHAR(120) NOT NULL,
  apellido_materno VARCHAR(120) NULL,
  fecha_nacimiento DATE         NULL,     -- cumpleaños (se ignora el año)
  -- Ubicación: punto marcado en el mapa donde vive (sustituye al domicilio)
  latitud          DECIMAL(10,7) NULL,
  longitud         DECIMAL(10,7) NULL,
  direccion        VARCHAR(300)  NULL,    -- dirección aproximada del punto
  -- De dónde es (dos campos: permite agrupar por estado)
  origen_ciudad    VARCHAR(120) NULL,
  origen_estado    VARCHAR(120) NULL,
  -- Iglesia
  hizo_encuentro   TINYINT(1)   NOT NULL DEFAULT 0,
  fecha_encuentro  DATE         NULL,
  bautizado        TINYINT(1)   NOT NULL DEFAULT 0,
  fecha_bautizo    DATE         NULL,
  situacion        ENUM('ACTIVO','VISITANTE','INACTIVO','EGRESADO') NOT NULL DEFAULT 'ACTIVO',
  -- Contacto
  telefono         VARCHAR(30)  NULL,
  notas            VARCHAR(1000) NULL,
  creado_en        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en   DATETIME     NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_integrante_celula (celula_id),
  KEY idx_integrante_nombre (apellido_paterno, apellido_materno, nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- REUNION — un encuentro de una célula en una fecha (uno por día)
--   Es el «papel» donde se escriben las asistencias de ese día.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reunion (
  id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  celula_id INT UNSIGNED NOT NULL,
  fecha     DATE         NOT NULL,
  creado_en DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_reunion_celula_fecha (celula_id, fecha),
  KEY idx_reunion_celula (celula_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- ASISTENCIA — cómo le fue a cada integrante en esa reunión
--   `situacion` (en `integrante`) es la pertenencia; esto es la asistencia.
--   Se conserva aunque el integrante se dé de baja: es su historial.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asistencia (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  reunion_id    INT UNSIGNED NOT NULL,
  integrante_id INT UNSIGNED NOT NULL,
  estado        ENUM('PRESENTE','AUSENTE','TARDANZA','JUSTIFICADO') NOT NULL DEFAULT 'PRESENTE',
  PRIMARY KEY (id),
  UNIQUE KEY uq_asistencia_reunion_integrante (reunion_id, integrante_id),
  KEY idx_asistencia_integrante (integrante_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- MINISTERIO — área de servicio (cámaras, alabanza, sonido…).
--   No cuelga de una rama: cruza las ramas. Por eso los roles de ministerio
--   tienen su propio alcance (MINISTERIO) y solo ven lo suyo.
--   Las cuentas de sus integrantes son `usuario` con rol de alcance MINISTERIO
--   y `ministerio_id`: ahí empieza su sesión.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ministerio (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre      VARCHAR(120) NOT NULL,
  descripcion VARCHAR(500) NULL,
  encargado_id INT UNSIGNED NULL,        -- usuario que lo lleva
  activo      TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ministerio_nombre (nombre),
  KEY idx_ministerio_encargado (encargado_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- EQUIPO — inventario de un ministerio.
--   `estatus` es el estado administrativo (disponible, prestado, en
--   mantenimiento, fuera de servicio); si está prestado se deduce además del
--   historial de préstamos. «Dar de baja» = estatus BAJA (no se borra).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS equipo (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ministerio_id INT UNSIGNED NOT NULL,
  nombre        VARCHAR(120) NOT NULL,
  descripcion   VARCHAR(500) NULL,
  estatus       ENUM('DISPONIBLE','PRESTADO','MANTENIMIENTO','BAJA') NOT NULL DEFAULT 'DISPONIBLE',
  creado_en     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME    NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_equipo_ministerio_nombre (ministerio_id, nombre),
  KEY idx_equipo_ministerio (ministerio_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- PRESTAMO — un equipo que salió y (ojalá) volvió.
--   `responsable_id` es quien lo trae (responde por él) y `asignado_a_id`
--   a quién se le asignó; pueden ser la misma persona. Mientras
--   `devuelto_en` sea NULL, el equipo está fuera: una cuenta puede traer
--   varios equipos a la vez (varios préstamos abiertos).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prestamo (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  equipo_id         INT UNSIGNED NOT NULL,
  responsable_id    INT UNSIGNED NOT NULL,
  asignado_a_id     INT UNSIGNED NULL,
  prestado_en       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  devuelto_en       DATETIME     NULL,
  estado_entrega    ENUM('BUENO','CON_DETALLE','DANADO') NOT NULL DEFAULT 'BUENO',
  estado_devolucion ENUM('BUENO','CON_DETALLE','DANADO') NULL,
  notas             VARCHAR(500) NULL,
  registrado_por_id INT UNSIGNED NULL,   -- cuenta que registró el préstamo
  devuelto_por_id   INT UNSIGNED NULL,   -- cuenta que registró la devolución
  PRIMARY KEY (id),
  KEY idx_prestamo_equipo (equipo_id),
  KEY idx_prestamo_responsable (responsable_id),
  KEY idx_prestamo_asignado (asignado_a_id),
  KEY idx_prestamo_abiertos (devuelto_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- EVENTO — día en que sirve el ministerio.
--   `hora_llegada` es a qué hora tienen que estar (con eso se sabe si
--   llegaron a tiempo) y la ubicación, el punto donde hay que estar: la
--   checada se mide contra ese punto.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evento (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ministerio_id INT UNSIGNED NOT NULL,
  nombre        VARCHAR(120) NOT NULL,
  descripcion   VARCHAR(500) NULL,
  fecha         DATE         NOT NULL,
  hora_llegada  TIME         NULL,
  latitud       DECIMAL(10,7) NULL,      -- punto marcado en el mapa
  longitud      DECIMAL(10,7) NULL,
  direccion     VARCHAR(300)  NULL,
  creado_por_id INT UNSIGNED NULL,
  activo        TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_evento_ministerio (ministerio_id),
  KEY idx_evento_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- SERVIDOR_EVENTO — un turno: quién sirve en qué evento.
--   `confirmado` = «sí voy»; `llego_en` = «ya estoy aquí», con el punto donde
--   se marcó (el del celular de quien checa) y quién lo registró, porque el
--   encargado también puede marcar por alguien que no trae teléfono.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS servidor_evento (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  evento_id         INT UNSIGNED NOT NULL,
  usuario_id        INT UNSIGNED NOT NULL,
  confirmado        TINYINT(1)   NOT NULL DEFAULT 0,
  confirmado_en     DATETIME     NULL,
  llego_en          DATETIME     NULL,
  latitud           DECIMAL(10,7) NULL,
  longitud          DECIMAL(10,7) NULL,
  direccion         VARCHAR(300)  NULL,
  registrado_por_id INT UNSIGNED NULL,
  creado_en         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_servidor_evento_usuario (evento_id, usuario_id),
  KEY idx_servidor_evento_usuario (usuario_id),
  KEY idx_servidor_evento_evento (evento_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- CAMPO — catálogo de campos diferenciadores («Estado civil», «Rango de edad»…).
--   Son las preguntas con las que una célula dice a quién le sirve. El
--   administrador los gestiona desde /panel/campos; no se escriben en el código.
--   `tipo` decide la forma de la respuesta: SELECT (opciones) o RANGO (numérico).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campo (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre          VARCHAR(120) NOT NULL,
  tipo            ENUM('SELECT','RANGO') NOT NULL DEFAULT 'SELECT',
  descripcion     VARCHAR(300) NULL,
  unidad          VARCHAR(30)  NULL,     -- solo RANGO: «años», "cm"…
  limite_inferior INT NULL,              -- solo RANGO: lo menor admisible al responder
  limite_superior INT NULL,              -- solo RANGO: lo mayor admisible al responder
  activo          TINYINT(1)   NOT NULL DEFAULT 1,  -- ocultar sin borrar (ya hay respuestas)
  orden           INT          NOT NULL DEFAULT 0,
  creado_en       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_campo_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- CAMPO_OPCION — respuestas posibles de un campo SELECT
--   («Soltero», «Casado», «Divorciado»). Las opciones no se borran, se
--   desactivan borrándolas: la respuesta ya dada queda igual.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campo_opcion (
  id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  campo_id INT UNSIGNED NOT NULL,
  etiqueta VARCHAR(120) NOT NULL,
  orden    INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_campo_opcion (campo_id, etiqueta),
  KEY idx_campo_opcion_campo (campo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- INTEGRANTE_RESPUESTA — qué respondió una persona a un campo.
--   `opcion_id` para SELECT, `valor` (numérico) para RANGO. Una fila por
--   campo y persona: volver a responder sobrescribe la anterior.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS integrante_respuesta (
  integrante_id INT UNSIGNED NOT NULL,
  campo_id      INT UNSIGNED NOT NULL,
  opcion_id     INT UNSIGNED NULL,
  valor         INT          NULL,
  PRIMARY KEY (integrante_id, campo_id),
  KEY idx_respuesta_campo (campo_id),
  KEY idx_respuesta_opcion (opcion_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- CELULA_CRITERIO — qué respuestas le sirven a una célula.
--   `obligatorio` = si no se cumple, la célula no se recomienda; si no, es
--   una preferencia que suma al puntaje. En RANGO va el intervalo admitido.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS celula_criterio (
  celula_id   INT UNSIGNED NOT NULL,
  campo_id    INT UNSIGNED NOT NULL,
  obligatorio TINYINT(1)   NOT NULL DEFAULT 1,
  minimo      INT          NULL,
  maximo      INT          NULL,
  PRIMARY KEY (celula_id, campo_id),
  KEY idx_criterio_campo (campo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- CELULA_CRITERIO_OPCION — opciones aceptadas por una célula en un campo SELECT
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS celula_criterio_opcion (
  celula_id  INT UNSIGNED NOT NULL,
  campo_id   INT UNSIGNED NOT NULL,
  opcion_id  INT UNSIGNED NOT NULL,
  PRIMARY KEY (celula_id, campo_id, opcion_id),
  KEY idx_criterio_opcion_opcion (opcion_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- ROL — conjunto de permisos con un alcance. Lo crean los administradores
--       desde /panel/roles. `es_sistema = 1` marca al Administrador, que
--       está protegido (no se edita ni se borra y siempre tiene todo).
--       Los roles base (Administrador, Líder de rama, Líder de célula) los
--       inserta scripts/crear-esquema.mjs desde src/lib/auth/catalogo.ts.
--       ⚠️ Si cambias estas dos tablas, replica el cambio en
--       scripts/migrar-roles.mjs (que las crea en bases ya existentes).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rol (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre      VARCHAR(60)  NOT NULL,
  descripcion VARCHAR(200) NULL,
  alcance     ENUM('ORGANIZACION','RAMA','CELULA','MINISTERIO') NOT NULL,
  es_sistema  TINYINT(1)   NOT NULL DEFAULT 0,
  creado_en   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rol_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- ROL_PERMISO — qué puede hacer cada rol: pares recurso + acción
--               (los valores válidos los fija src/lib/auth/catalogo.ts)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rol_permiso (
  rol_id  INT UNSIGNED NOT NULL,
  recurso VARCHAR(30)  NOT NULL,
  accion  VARCHAR(30)  NOT NULL,
  PRIMARY KEY (rol_id, recurso, accion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- USUARIO — cuenta con rol y alcance (no confundir con Integrante)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuario (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  email          VARCHAR(190)  NOT NULL,
  nombre         VARCHAR(120)  NOT NULL,
  contrasena_hash VARCHAR(255) NOT NULL,   -- scrypt$N$r$p$salt$hash
  rol_id         INT UNSIGNED  NOT NULL,   -- rol: define permisos y alcance
  rama_id        INT UNSIGNED  NULL,       -- si el rol tiene alcance RAMA (o CELULA: su rama)
  celula_id      INT UNSIGNED  NULL,       -- si el rol tiene alcance CELULA
  ministerio_id  INT UNSIGNED  NULL,       -- si el rol tiene alcance MINISTERIO
  activo         TINYINT(1)    NOT NULL DEFAULT 1,
  creado_en      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuario_email (email),
  KEY idx_usuario_rol (rol_id),
  KEY idx_usuario_rama (rama_id),
  KEY idx_usuario_celula (celula_id),
  KEY idx_usuario_ministerio (ministerio_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Relaciones (se añaden al final: las tablas ya existen todas)
-- Se crea el juego entero cada vez, así que no hay que comprobar
-- si la restricción existe.
-- ------------------------------------------------------------
ALTER TABLE rol_permiso
  ADD CONSTRAINT fk_rolpermiso_rol FOREIGN KEY (rol_id) REFERENCES rol (id)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE integrante
  ADD CONSTRAINT fk_integrante_celula FOREIGN KEY (celula_id) REFERENCES celula (id)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE reunion
  ADD CONSTRAINT fk_reunion_celula FOREIGN KEY (celula_id) REFERENCES celula (id)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE asistencia
  ADD CONSTRAINT fk_asistencia_reunion FOREIGN KEY (reunion_id) REFERENCES reunion (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT fk_asistencia_integrante FOREIGN KEY (integrante_id) REFERENCES integrante (id)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE rama
  ADD CONSTRAINT fk_rama_lider    FOREIGN KEY (lider_id)  REFERENCES usuario (id)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE celula
  ADD CONSTRAINT fk_celula_rama   FOREIGN KEY (rama_id)   REFERENCES rama (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT fk_celula_lider  FOREIGN KEY (lider_id)  REFERENCES usuario (id)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE usuario
  ADD CONSTRAINT fk_usuario_rol    FOREIGN KEY (rol_id)    REFERENCES rol (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT fk_usuario_rama   FOREIGN KEY (rama_id)   REFERENCES rama (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT fk_usuario_celula FOREIGN KEY (celula_id) REFERENCES celula (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT fk_usuario_ministerio FOREIGN KEY (ministerio_id) REFERENCES ministerio (id)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Campos diferenciadores: catálogo, respuestas y criterios de las células
ALTER TABLE campo_opcion
  ADD CONSTRAINT fk_campoopcion_campo FOREIGN KEY (campo_id) REFERENCES campo (id)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE integrante_respuesta
  ADD CONSTRAINT fk_respuesta_integrante FOREIGN KEY (integrante_id) REFERENCES integrante (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT fk_respuesta_campo FOREIGN KEY (campo_id) REFERENCES campo (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT fk_respuesta_opcion FOREIGN KEY (opcion_id) REFERENCES campo_opcion (id)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE celula_criterio
  ADD CONSTRAINT fk_criterio_celula FOREIGN KEY (celula_id) REFERENCES celula (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT fk_criterio_campo FOREIGN KEY (campo_id) REFERENCES campo (id)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE celula_criterio_opcion
  ADD CONSTRAINT fk_criterioopcion_celula FOREIGN KEY (celula_id) REFERENCES celula (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT fk_criterioopcion_campo FOREIGN KEY (campo_id) REFERENCES campo (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT fk_criterioopcion_opcion FOREIGN KEY (opcion_id) REFERENCES campo_opcion (id)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Ministerio: equipo, préstamos y eventos de servicio
ALTER TABLE ministerio
  ADD CONSTRAINT fk_ministerio_encargado FOREIGN KEY (encargado_id) REFERENCES usuario (id)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE equipo
  ADD CONSTRAINT fk_equipo_ministerio FOREIGN KEY (ministerio_id) REFERENCES ministerio (id)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE prestamo
  ADD CONSTRAINT fk_prestamo_equipo FOREIGN KEY (equipo_id) REFERENCES equipo (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT fk_prestamo_responsable FOREIGN KEY (responsable_id) REFERENCES usuario (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT fk_prestamo_asignado FOREIGN KEY (asignado_a_id) REFERENCES usuario (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT fk_prestamo_registrado FOREIGN KEY (registrado_por_id) REFERENCES usuario (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT fk_prestamo_devuelto FOREIGN KEY (devuelto_por_id) REFERENCES usuario (id)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE evento
  ADD CONSTRAINT fk_evento_ministerio FOREIGN KEY (ministerio_id) REFERENCES ministerio (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT fk_evento_creador FOREIGN KEY (creado_por_id) REFERENCES usuario (id)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE servidor_evento
  ADD CONSTRAINT fk_servidor_evento_evento FOREIGN KEY (evento_id) REFERENCES evento (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT fk_servidor_evento_usuario FOREIGN KEY (usuario_id) REFERENCES usuario (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT fk_servidor_evento_registro FOREIGN KEY (registrado_por_id) REFERENCES usuario (id)
    ON DELETE SET NULL ON UPDATE CASCADE;

SET FOREIGN_KEY_CHECKS = 1;

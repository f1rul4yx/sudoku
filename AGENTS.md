# AGENTS.md

App web de sudoku (una copia del patrón de tuxman/nometoco del mismo autor). Todo el texto de la UI y los logs está en **español**: mantén esa convención.

## Arquitectura (cómo están las piezas)

- `build/src/server.js` — único entrypoint (Express 4 + `pg` + JWT/bcrypt). Todas las rutas viven aquí.
- `build/public/index.html` — **todo el frontend en un solo archivo** (CSS + JS inline). Tablero, juego, tutorial, historial, generador de folios A4 e interacción están ahí. Cualquier cambio de UI se hace en este archivo.
- `build/public/js/sudoku.js` — módulo **UMD compartido**: el servidor lo hace `require` para generar sudokus con solución única, y el navegador lo usa (`window.SudokuLib`) para validación/conflictos. No uses builtins de Node; debe funcionar en ambos lados. Si tocas la generación, la salida debe seguir teniendo solución única (`countSolutions(puzzle,2) === 1`).
- El esquema de BD **se crea solo al arrancar** (`initDatabase()` dentro de server.js). No hay migraciones: para cambiar columnas/tablas edita ahí.
- La API usa snake_case en BD y camelCase en JSON (`mapGame()`). Para añadir endpoints: middleware `authenticateToken` + filtros de propiedad `... AND user_id = $X` (todos los datos son por usuario, menos `POST /api/print` y `GET /api/health` que son públicos; `print` no persiste nada).

## Comandos

- Despliegue: `docker compose up -d` (app + postgres). Imagen: `f1rul4yx/sudoku:latest` construida desde `./build` (`docker build -t f1rul4yx/sudoku:latest ./build`).
- Sin Docker: `cd build && npm install && node src/server.js` (usa vars `DB_*`, `PORT` por defecto 3000).
- **No hay suite de tests** (ni script `npm test`). La verificación manual usada:
  - Sintaxis servidor: `node --check build/src/server.js`
  - Sintaxis del JS inline del index (es recurrente romperlo): extraer y comprobar el `<script>` embebido antes de cambiar el frontend.
- Servidor de pruebas local hasta ahora: Postgres 18 nativo `initdb` en `/tmp/opencode/pgdata` (usuario `sudoku`), app con `JWT_SECRET` local + curl, y e2e con `puppeteer-core` + chromium del sistema (scripts en `/tmp/opencode/e2e`, fuera del repo).

## Gotchas

- **Local `npm install`**: este npm (>11) bloquea scripts de instalación; el `package.json` ya incluye `allowScripts` para bcrypt. Si falta el binario nativo: `npm install-scripts approve bcrypt && npm rebuild bcrypt`. bcrypt sigue en `^5.1.1` (con `tar`/`node-pre-gyp` en el lock; subir a `bcrypt@6` lo elimina, pendiente).
- `package-lock.json` está committeado (como en nometoco): regenéralo al tocar dependencias y súbelo.
- **Puerto**: la app escucha 3000 interno; el host usa `${APP_PORT}` del `.env`. tuxman ocupa el 3000 del host → sudoku se levanta con `APP_PORT=3001`.
- `JWT_SECRET` se genera con `echo "JWT_SECRET=$(openssl rand -hex 32)" > .env` (mín. recomendado 32 caracteres).
- **Persistencia**: todo vive en la BD, montada en `./data` (bind mount, propiedad de root). No borrar esa carpeta. Las variables POSTGRES_* solo se aplican la primera vez que se crea el volumen; cambiarlas después rompe la conexión.
- `data/` y `.env` están en `.gitignore`; no committear secretos.
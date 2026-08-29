# AGENTS.md

App web de sudoku (una copia del patrón de tuxman/nometoco del mismo autor). Todo el texto de la UI y los logs está en **español**: mantén esa convención.

## Arquitectura (cómo están las piezas)

- `build/src/server.js` — único entrypoint (Express 4 + `pg` + JWT/bcrypt). Todas las rutas viven aquí.
- `build/public/index.html` — **todo el frontend en un solo archivo** (CSS + JS inline). Tablero, juego, tutorial, historial, generador de folios A4 e interacción están ahí. Cualquier cambio de UI se hace en este archivo. Los filtros del historial (nivel/fecha/orden) se aplican **en el cliente** sobre lo que ya devuelve `/api/history`: `renderHistory(refetch)` con caché en `historyCache`; `go('history')` llama con `true` (refetch) mientras que los `<select>` del panel llaman sin argumento (usan la caché).
- `build/public/js/sudoku.js` — módulo **UMD compartido**: el servidor lo hace `require` para generar sudokus con solución única, y el navegador lo usa (`window.SudokuLib`) para validación/conflictos. No uses builtins de Node; debe funcionar en ambos lados. Si tocas la generación, la salida debe seguir teniendo solución única (`countSolutions(puzzle,2) === 1`).
- El esquema de BD **se crea solo al arrancar** (`initDatabase()` dentro de server.js). No hay migraciones: para cambiar columnas/tablas edita ahí.
- La API usa snake_case en BD y camelCase en JSON (`mapGame()`). Para añadir endpoints: middleware `authenticateToken` + filtros de propiedad `... AND user_id = $X` (todos los datos son por usuario, menos `POST /api/print` y `GET /api/health` que son públicos; `print` no persiste nada). Las notas/candidatos viven en `games.notes VARCHAR(243)` = 3 hex por casilla (máscara de 9 bits), columna añadida con `ADD COLUMN IF NOT EXISTS` dentro de `initDatabase()`; el `PUT /api/games/:id` las guarda con `COALESCE($3, notes)` y valida `^[0-9a-fA-F]{0,243}$`.

## Comandos

- Despliegue: `docker compose up -d` (app + postgres). El servicio `app` del compose **solo referencia la imagen** `f1rul4yx/sudoku:latest` (no tiene `build:`), así que para actualizar una instalación: local `docker build -t f1rul4yx/sudoku:latest ./build && docker push f1rul4yx/sudoku:latest`; en el servidor `docker compose pull && docker compose up -d` (sin `pull`, `up -d` reutiliza la imagen cacheada).
- Sin Docker: `cd build && npm install && node src/server.js` (usa vars `DB_*`, `PORT` por defecto 3000).
- **No hay suite de tests** (ni script `npm test`). Verificación manual recurrente:
  - Sintaxis servidor: `node --check build/src/server.js`
  - Sintaxis del JS inline del index (es recurrente romperlo, tras cada cambio del archivo):
    `python3 -c "import re;h=open('build/public/index.html').read();b=re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>',h,re.S);open('/tmp/opencode/inline.js','w').write('\n;\n'.join(b))" && node --check /tmp/opencode/inline.js`
- Harnesses de lógica (sudoku.js, print, notas) y e2e con `puppeteer-core` + chromium del sistema viven en `/tmp/opencode` (fuera del repo; no versionados). Lanzar los e2e con `NODE_PATH=/tmp/opencode/e2e/node_modules node /tmp/opencode/e2e_*.js`; el servidor de pruebas se arranca con `setsid` (si no, el shell del agente lo mata al terminar).
- Servidor de pruebas local hasta ahora: Postgres nativo `initdb` en `/tmp/opencode/pgdata` (usuario `sudoku`), app con `JWT_SECRET` local + curl.

## Gotchas

- **Local `npm install`**: este npm (>11) bloquea scripts de instalación; el `package.json` ya incluye `allowScripts` para bcrypt. Si falta el binario nativo: `npm install-scripts approve bcrypt && npm rebuild bcrypt`. bcrypt sigue en `^5.1.1` (con `tar`/`node-pre-gyp` en el lock; subir a `bcrypt@6` lo elimina, pendiente).
- `package-lock.json` está committeado (como en nometoco): regenéralo al tocar dependencias y súbelo.
- **Puerto**: la app escucha 3000 interno; el host usa `${APP_PORT}` del `.env`. tuxman ocupa el 3000 del host → sudoku se levanta con `APP_PORT=3001`.
- **Impresión A4/A5** (en el index: `PRINT_SIZE`, `gridHTML`, `buildPrintHTML`): la tabla `PRINT_SIZE` **necesita la clave 3** (≈89/63 mm, igual que la 4) porque hay páginas remanentes de 3 sudokus; y `.sheet.a4 { min-height: 276mm }` — con 277mm Firefox mete hojas en blanco al exportar. Las soluciones se empaquetan fijas (12 por hoja A4 a [46,12], 6 por carilla A5 a [52,12]) **independientes** del `perPage`.
- `JWT_SECRET` se genera con `echo "JWT_SECRET=$(openssl rand -hex 32)" > .env` (mín. recomendado 32 caracteres).
- **Persistencia**: todo vive en la BD, montada en `./data` (bind mount, propiedad de root). No borrar esa carpeta. Las variables POSTGRES_* solo se aplican la primera vez que se crea el volumen; cambiarlas después rompe la conexión.
- `data/` y `.env` están en `.gitignore`; no committear secretos.
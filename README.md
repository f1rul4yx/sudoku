# sudoku

Web para jugar al sudoku: tutorial para principiantes, partidas por dificultad con progreso guardado, historial de sudokus completados y generación de folios A4 imprimibles para encuadernar tu propio libro.

## Qué es

Aplicación web con sistema de usuarios (JWT) donde cada jugador:

- Aprende a jugar al sudoku desde cero con un **tutorial** para principiantes.
- Juega **sudokus aleatorios** eligiendo la dificultad (fácil, medio, difícil, experto).
- Deja una partida **a medias y la retoma** cuando quiera: el progreso se guarda automáticamente.
- Consulta su **historial** con todos los sudokus completados y su fecha de finalización.
- Genera **folios A4 imprimibles** con el número de sudokus que quiera y la dificultad que elija.
- Aprende a **encuadernar los folios** para hacer un libro y no llevarlos sueltos.

## Instalación

```bash
git clone https://github.com/f1rul4yx/sudoku.git
cd sudoku
```

Crea un archivo `.env` con las variables obligatorias:

```env
DB_PASSWORD=MiPasswordSegura123
JWT_SECRET=UnSecretoMuyLargoDe32CaracteresOMas
APP_PORT=3000
```

Variables de entorno disponibles:

| Variable | Por defecto | Descripción |
|---|---|---|
| `APP_PORT` | `3000` | Puerto expuesto |
| `JWT_SECRET` | — | Secret JWT (mín. 32 caracteres) |
| `DB_PASSWORD` | — | Contraseña de PostgreSQL |
| `DB_HOST` | `db` | Host de la base de datos |
| `DB_PORT` | `5432` | Puerto de PostgreSQL |
| `DB_USER` | `sudoku` | Usuario de la base de datos |
| `DB_NAME` | `sudoku` | Nombre de la base de datos |

## Uso

```bash
docker compose up -d
```

Accede a `http://TU_IP:3000` y regístrate desde la pantalla de inicio.

```bash
docker compose down       # Parar
docker compose restart    # Reiniciar
docker compose logs -f    # Ver logs
```

## Build

```bash
docker build -t f1rul4yx/sudoku:latest ./build
docker push f1rul4yx/sudoku:latest
```
# Aprendamos Las Tablas (PWA + Cloudflare)

Juego de tablas de multiplicar como **PWA**, con API en **Cloudflare Workers**, base de datos **D1** y usuarios autenticados por sesión (cookie HttpOnly).

## Requisitos

- [Node.js](https://nodejs.org/) 18+
- Cuenta de [Cloudflare](https://dash.cloudflare.com/)
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (`npm install` lo incluye)

## Desarrollo local

```bash
npm install
npm run db:migrate:local
npm run dev
```

Abre la URL que muestra Wrangler (normalmente `http://localhost:8787`).

## Desplegar en Cloudflare

1. Crea la base D1:

```bash
npx wrangler d1 create tablasmult-db
```

2. Copia el `database_id` que devuelve el comando y pégalo en `wrangler.jsonc` (sustituye el UUID de ejemplo).

3. Aplica migraciones en producción:

```bash
npm run db:migrate:remote
```

4. Despliega:

```bash
npm run deploy
```

La app quedará en `https://tablasmult.<tu-subdominio>.workers.dev` (o el dominio que configures).

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/register` | Registro (`username`, `password`, `displayName`) |
| POST | `/api/auth/login` | Inicio de sesión |
| POST | `/api/auth/logout` | Cerrar sesión |
| GET | `/api/auth/me` | Usuario actual |
| POST | `/api/scores` | Guardar puntaje (requiere sesión) |
| GET | `/api/scores/leaderboard` | Top 10 (`?difficulty=facil\|medio\|dificil\|all`) |
| GET | `/api/scores/me` | Historial del usuario |

## Notas

- Las contraseñas se guardan con **PBKDF2-SHA256** (100k iteraciones).
- Las sesiones viven en D1 y expiran a los 7 días.
- Puedes jugar sin cuenta; el ranking en D1 requiere iniciar sesión.

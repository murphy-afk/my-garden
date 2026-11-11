# Garden

A web app to administer a flower and vegetable garden.

## Requirements

- Node.js 20 or newer
- MySQL 8, needed from session S02 onwards

## Setup

```
npm install
```

Then create the API configuration file by copying `server/.env.example` to `server/.env`, and fill in your MySQL credentials. The file is gitignored, so real values never reach the repository.

## Database

Create the schema in the database you just pointed at:

```
npm run db:migrate --workspace server
```

To see the app with something in it straight away, load the example data:

```
npm run db:seed --workspace server
```

The seed adds ten species, three areas and ten guides, and is safe to run again. Skip it to start from an empty garden instead, where the first-run guide walks you through adding your first area.

## Development

```
npm run dev
```

Starts both apps together:

| App    | Url                   |
| ------ | --------------------- |
| Client | http://localhost:5173 |
| API    | http://localhost:3001 |

The client proxies `/api` requests to the API, so the browser only ever talks to port 5173.

## Configuration

Every setting comes from environment variables, read by the API from `server/.env`. `server/.env.example` lists them all.

| Variable    | What it sets                    | Default |
| ----------- | ------------------------------- | ------- |
| `PORT`      | Port the API listens on         | `3001`  |
| `LOG_LEVEL` | `debug`, `info`, `warn`, `error` | `info`  |
| `DB_HOST`   | MySQL host                      |         |
| `DB_PORT`   | MySQL port                      | `3306`  |
| `DB_USER`   | MySQL user                      |         |
| `DB_PASSWORD` | MySQL password, may be empty   |         |
| `DB_NAME`   | MySQL database to use           |         |

## Scripts

| Script                              | What it does                                  |
| ----------------------------------- | --------------------------------------------- |
| `npm run dev`                       | Runs client and API together                  |
| `npm run build`                     | Typechecks and builds both workspaces         |
| `npm run typecheck`                 | Typechecks both workspaces                    |
| `npm run lint`                      | Runs ESLint over the whole repository         |
| `npm run db:migrate --workspace server`   | Creates or updates the database schema   |
| `npm run db:seed --workspace server`      | Loads the example species, areas and guides |

## Layout

| Path         | Contents                             |
| ------------ | ------------------------------------ |
| `client/`    | Vite, React and TypeScript front end |
| `server/`    | Express and TypeScript API           |
| `ROADMAP.md` | The session by session plan          |
| `AGENTS.md`  | Binding rules for work on this repo  |

Sessions are tracked in `ROADMAP.md`. Read `AGENTS.md` before changing anything.

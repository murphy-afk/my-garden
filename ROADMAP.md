# Garden App Roadmap

A web app to administer a flower and vegetable garden: layout, planting history, care logs, issues, harvest, seed saving, statistics and a guides library.

The roadmap is split into short sessions. Each session is meant to be finished in one sitting and leaves the app in a working, reviewable state.

---

## Stack

Chosen because it matches the stated preference (React + Express) and keeps the database on MySQL.

| Layer     | Choice                                   | Notes                                                                 |
| --------- | ---------------------------------------- | --------------------------------------------------------------------- |
| Frontend  | Vite + React + TypeScript                | Fast dev loop, TypeScript keeps the API contract honest               |
| UI        | Custom CSS + lucide-react                | Plain stylesheets, no CSS framework, icons from the library            |
| Data      | TanStack Query                            | Handles loading, caching and refetching of API data                   |
| Routing   | React Router                              |                                                                       |
| Backend   | Express + TypeScript (Node 20+)           |                                                                       |
| Database  | MySQL 8                                   | Required by the brief                                                 |
| Driver    | mysql2/promise connection pool            |                                                                       |
| Migrations| Prisma Migrate (or Knex, decided in S02) | Plain SQL migrations, no ORM magic on the query side                  |
| Testing   | Vitest (frontend), Vitest + supertest (API) |                                                                       |

Open decision to confirm in S02: Prisma Migrate for schema migrations, or Knex if a lighter tool is preferred. The app code talks to MySQL through plain SQL either way.

Deliberately deferred: authentication and multi-user support. The brief describes a single gardener, so the first version is a single user app. This is revisited in S14.

### Alternatives considered

The brief names React and Express but stays open to a different framework or language if it fits the project better. Options reviewed before settling:

- **Next.js on the front end.** Rejected for now. This is a private admin tool with no SEO value, and Next would add a second server framework sitting beside Express rather than replacing it.
- **Rails, Django or Laravel with MySQL.** These collapse client and server into one codebase and ship a mature admin layer, which would shorten S04 through S10. The cost is leaving React and Express entirely, which the brief prefers, and the domain model here is simple enough that the scaffolding advantage is small.
- **Go or Rust for the API.** Better throughput and stricter typing, but the workload is CRUD plus aggregation on a single user's data, so performance is not the constraint. It would also make maintenance harder for anyone maintaining a React codebase.

React, Express and MySQL stay. Reopen this only if S11 shows the statistics are too slow, and the first fix in that case is pushing aggregation into SQL views or a background worker, not changing language.

---

## Domain model at a glance

- **Species**: what can be planted, for example tomato, carrot, rose. Holds expected spacing, cycle and default care hints.
- **GardenArea**: a physical zone in the garden, for example raised bed A, patio pot 3, north border. Has position and size for the layout view.
- **Planting**: the central record. One organism or one spot in one area, planted on a date. Links a Species to a GardenArea.
- **Milestone**: dated lifecycle points on a Planting, for example sown, germinated, transplanted, first flower, first ripe fruit, died.
- **CareLog**: a dated action on a Planting, for example watered, pruned, tied up, fed. Type plus optional amount and note.
- **Issue**: a problem on a Planting, for example aphids, blight, bolting. Severity, status and resolution note.
- **Harvest**: what was picked from a Planting, with quantity, unit and date.
- **SeedSave**: whether and how seeds were kept after a Harvest.
- **Guide**: a gardening article with source URL, category, tags and body.

Everything the brief asks to track maps onto Planting plus one of Milestone, CareLog, Issue, Harvest or SeedSave. Statistics are computed from those tables rather than stored.

---

## Sessions

### S00. Repository and tooling
**Goal**: an empty but correctly configured repo.

- Init git, `.gitignore`, Node workspaces with `client` and `server` folders.
- ESLint + Prettier for both sides, TypeScript strict mode, shared `tsconfig.base.json`.
- Root `README.md` with run instructions.
- Add `AGENTS.md` with the project rules.

**Done when**: `npm run dev` starts both apps and a health check page renders. Lint and typecheck pass.

### S01. Design tokens and app shell
**Goal**: a navigable empty app.

- Custom CSS setup, no CSS framework installed. Design tokens live as CSS custom properties: palette, spacing scale, type scale, radii and shadows.
- A small reset, then one stylesheet per area of the app rather than one growing global file.
- Base layout with sidebar navigation and placeholder routes.
- lucide-react wired in, with a documented rule that icons come from the library.
- A shared `ApiClient` module on the frontend that all future calls go through.

**Done when**: the shell renders, every route shows a placeholder, no emoji character exists in the source tree, and the project has no CSS framework in its dependencies.

### S02. Database schema and migrations
**Goal**: the MySQL schema exists and is versioned.

- Create the MySQL database and the migration tooling decision.
- Migrations for Species, GardenArea, Planting, Milestone, CareLog, Issue, Harvest, SeedSave, Guide.
- Sensible indexes on foreign keys and on dates used by statistics.
- A seed script with a handful of species and two example areas.

**Done when**: migrations run from scratch on an empty MySQL instance, the seed script runs, and rollback works.

### S03. Backend foundation
**Goal**: an Express app that talks to MySQL safely.

- Config from environment variables, including a `.env.example`.
- mysql2 pool, a `withTransaction` helper, structured request logging.
- Error handling middleware with a consistent JSON error shape.
- A `/api/health` endpoint that reports database connectivity.

**Done when**: health endpoint returns database status, an error in a route returns the standard shape, no route swallows an exception.

### S04. Species CRUD
**Goal**: the catalogue of plant types is manageable.

- API: list, get, create, update, archive Species. Validation on name, category (vegetable, fruit, flower, herb), and optional growing metadata.
- Frontend: species list, create and edit forms, empty state.

**Done when**: a species can be created, edited and archived through the UI and survives a page reload.

### S05. Garden areas and layout
**Goal**: the physical garden is described in the app.

- API for GardenArea CRUD with name, type, dimensions and grid position.
- Frontend: a list view plus a simple grid canvas where areas are placed and resized with mouse or numeric inputs.
- Layout persists exactly as placed.

**Done when**: two areas can be drawn on the grid, saved, and reappear identically after reload.

### S06. Plantings
**Goal**: the central record exists.

- API for Planting: link a Species to a GardenArea, with planted date, quantity, source (seed, seedling, cutting) and an optional note.
- Frontend: plant a species into an area from the layout view, and a planting list filtered by area or species.
- Status field: active, ended.

**Done when**: a planting can be created from the layout, listed, and opened.

### S07. Milestones and the planting timeline
**Goal**: lifecycle events are recorded and readable.

- API for Milestone on a Planting, with a fixed vocabulary: sown, germinated, transplanted, first flower, first ripe fruit, began declining, died.
- Frontend: a vertical timeline on the planting detail page, with a form to add a milestone.

**Done when**: milestones can be added to a planting and appear in date order on the timeline.

### S08. Care logs: watering, pruning, tying
**Goal**: the recurring care questions in the brief are answerable.

- API for CareLog with type (watered, pruned, tied, fed), optional amount and note.
- Frontend: quick-add buttons on the planting detail page, and a care log list.
- A per-planting summary line: last watered, last pruned, tied or not.

**Done when**: adding a care log updates the summary line without a manual refresh.

### S09. Issues
**Goal**: problems are tracked to resolution.

- API for Issue with type, severity (low, medium, high), status (open, monitoring, resolved), and resolution note.
- Frontend: issue form on the planting detail page, an issues list filtered by status, and an indicator on the layout view for areas with open issues.

**Done when**: an issue can be opened, updated to resolved, and the layout indicator clears.

### S10. Harvest and seed saving
**Goal**: production and seed keeping are recorded.

- API for Harvest with quantity, unit and date, plus SeedSave linked to a harvest: kept yes or no, quantity, storage method, storage location.
- Frontend: harvest form on the planting detail page, a harvest list, and a seed inventory derived from SeedSave records.

**Done when**: two harvests and one seed save can be entered and both lists reflect them.

### S11. Statistics
**Goal**: the performance question in the brief is answered.

- Aggregation endpoints: yield per species and per area, harvests over time, average days from sown to first flower and to first fruit, watering and pruning frequency per species, survival rate, issues by type and severity.
- Frontend: a dashboard with charts, with a date range filter and a species or area filter.

**Done when**: with data entered across a few plantings, the dashboard shows correct numbers that match a manual count.

### S12. Guides library
**Goal**: the gardening knowledge section exists.

- API for Guide CRUD with category, tags, source URL and body. Categories seeded with vegetable growing, flower care, pests and diseases, soil and compost, seed saving.
- Frontend: guide list with category and tag filtering, a reader view, and an admin form for adding a guide.
- A seed set of roughly ten real guides with proper source attribution.

**Done when**: guides can be browsed by category, read, and new ones added from the admin form.

### S13. Consolidation and polish
**Goal**: the app is pleasant to use daily.

- Loading, empty and error states everywhere.
- Keyboard reachable forms, labels and focus rings on every control.
- Responsive check on the layout view and the dashboard.
- A first-run onboarding that creates the first garden area.

**Done when**: a new user can install the app, define an area, plant something and record a harvest without reading documentation.

### S14. Decisions to revisit
Not a build session. Confirm with the gardener before starting:

- Authentication and multi-user support, now that the app is useful.
- Backups and a documented restore procedure for the MySQL data.
- Deployment target, and whether the guides section should pull content from an external source.
- Whether the layout view should move from a grid canvas to a to-scale map.

---

## Requirements coverage

Every line of the original brief mapped to where it is handled, so nothing is lost.

| Requirement from the brief | Where it lands |
| -------------------------- | -------------- |
| A web app to administrate a flower or vegetable garden | The whole roadmap, S00 to S13 |
| React and Express, open to a better fit, database is MySQL | Stack and Alternatives considered |
| Input the layout of the garden | S05, garden areas and layout canvas |
| Track what was planted, where and when | S06, plantings linking a species to an area with a date |
| Whether a plant has issues | S09, issues with severity and status |
| Whether a plant dies | S07, died milestone, plus the planting status field |
| How many fruits or vegetables a plant produces | S10, harvest with quantity and unit |
| Whether seeds were kept afterwards | S10, seed save records and the derived seed inventory |
| How often a plant is watered | S08 logs, S11 watering frequency statistics |
| How often a plant is cut | S08 pruning logs, S11 pruning frequency statistics |
| Whether a plant was tied up | S08, tied or not summary line per planting |
| When a plant starts flowering | S07, first flower milestone |
| Any further information needed to keep track of the garden | The domain model, new care types and milestones extend without schema rewrites |
| Statistics on how plants are performing | S11, statistics dashboard |
| A section of guides, tips and tricks found online | S12, guides library with sources |
| A roadmap designed in small sessions | This file, 15 sessions each scoped to one sitting |
| An agents file holding the stated rules | AGENTS.md |

## Rules that apply to every session

The full list lives in `AGENTS.md`. The ones that shape the roadmap itself:

- Each session is small and ends with a working app.
- Nothing is committed without explicit permission.
- No emoji characters anywhere, in code or in documentation. Icons come from the icon library.
- No line consisting only of `>` or `/>`. JSX tags are closed on the line before.
- No emdashes in any text produced for this project.

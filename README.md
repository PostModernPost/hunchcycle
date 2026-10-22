# Hunchcycle

Lean startup coaching in one place: assumptions, experiments, runs, and the evidence behind every decision. See `BRIEF.md` for the full spec and `DECISIONS.md` for build choices.

## Local development

1. Copy `.env.example` to `.env` and point `DATABASE_URL` / `DIRECT_URL` at a Postgres database.
2. `npm install`
3. `npm run db:migrate` to create the tables.
4. Put the seed files in `seed/private/` (`interviews.xlsx`, `coaching-doc.docx`). This folder is gitignored because it contains real people's contact info.
5. `npm run seed` (wipes and reloads all data).
6. `npm run dev`

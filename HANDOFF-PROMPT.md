I'm continuing a project that was started in another Claude session. Please handle the setup for me, step by step, and only stop when you need something from me. I'm not a developer, so explain anything you need me to do in plain words.

**The project:** Hunchcycle, a web app for running lean startup coaching (assumptions, experiments, runs, evidence). The code is in my private GitHub repo `PostModernPost/hunchcycle`. Milestone 1 is done. The repo has three files you should read before anything else: `CLAUDE.md` (status and working notes), `BRIEF.md` (the full spec), and `DECISIONS.md` (choices made so far).

**Please do this, in order:**

1. **Get the code.** If this folder isn't already the hunchcycle repo, clone `https://github.com/PostModernPost/hunchcycle` here and work inside it. Then read `CLAUDE.md`, `BRIEF.md`, and `DECISIONS.md`.

2. **Check the tools.** Make sure Node.js (version 20 or newer) and git are installed. If something's missing, tell me exactly what to install.

3. **Install dependencies** with `npm install`.

4. **Put the seed files in place.** The import script needs two files that are deliberately kept out of GitHub because they contain real people's names and emails. They're somewhere on my computer, probably in Downloads:
   - the spreadsheet, named something like `Customer Interview Script (Responses).xlsx`
   - the coaching doc, named something like `Coaching - Adam Waitt.docx`

   Search for them, show me what you found, and once I confirm, copy them into `seed/private/` as `interviews.xlsx` and `coaching-doc.docx`. Copy them; don't move them. Check that `seed/private/` is in `.gitignore` before copying.

5. **Connect the database.** The app uses my Supabase project (ref `iumefduhzfimwiytqdcp`), which is empty right now. Create a `.env` file from `.env.example`. I'll need to give you two connection strings from the Supabase dashboard: the pooled one (port 6543) for `DATABASE_URL`, with `?pgbouncer=true` on the end, and the direct one (port 5432) for `DIRECT_URL`. Tell me where to find them and ask me to paste them. If I don't know the database password, walk me through resetting it. Also fill in `OWNER_PASSWORD`, `COACH_PASSWORD`, and `SESSION_SECRET` with random values for now. Never commit `.env`.

6. **Build the database and load the data.** Run `npm run db:migrate`, then `npm run seed`. The seed should report 33 people, 33 interviews, 13 assumptions, 8 experiments, and 13 runs. If the numbers don't match, stop and tell me.

7. **Start the app** with `npm run dev` and give me the localhost link so I can click around.

8. **Ask me the open questions** listed in `CLAUDE.md` (whether the Game Day Pilot launched, and whether the Google Ads test got any results), and update the seeded data based on my answers.

9. **Start Milestone 2** as described in `BRIEF.md` section 12: the board with drag and drop, the card drawer, and the stage gates. Stop when it's done, tell me what to try, and wait for me to check it before going further.

**Ground rules:** follow the scope cap in `BRIEF.md` section 11. Commit and push to `main` after each step that changes code. Don't deploy anything to Vercel until I say so. In anything you write for me or put in the app, don't use em dashes or en dashes.

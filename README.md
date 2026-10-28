# Railcore

The Discord bot for **Falkenberg Railways**, a Roblox railway simulator.

- **Verification**: a rules panel with a Verify button. It checks the account age against a minimum, has an anti-spam cooldown and alerts staff about new accounts. Verification lives in its own module, so a Roblox account link can be added later.
- **Tickets and staff applications**: Support, Bug Report and Staff Application tickets in private channels, with Claim and Close buttons. Applications get Accept / Deny buttons. Closed tickets produce an HTML transcript, which goes to a log channel and to the member by DM.
- **Moderation**: `/warn`, `/warnings`, `/clearwarn`, `/timeout`, `/untimeout`, `/kick`, `/ban`, `/unban` and `/purge`. Every action becomes a numbered case, the member gets a DM, and the action is posted to the mod log. Staff can't moderate equal or higher roles.
- **Server log**: message edits and deletions, members joining and leaving, role changes and nickname changes.
- **Configuration**: everything is set up in Discord with `/setup`, so no IDs live in the code.

Built with TypeScript, discord.js 14, PostgreSQL + Prisma and pino, and deployed with Docker.

---

## 1. Create the Discord bot

1. Open the [Discord Developer Portal](https://discord.com/developers/applications), click **New Application** and name it "Railcore".
2. Go to **Bot**, click **Reset Token** and copy the token. It goes into `.env` later; never share it.
3. Still on **Bot**, under **Privileged Gateway Intents**, turn on **Server Members Intent** and **Message Content Intent**. The bot refuses to start without them.
4. Invite the bot. Replace `APP_ID` with the **Application ID** from **General Information**:

   ```
   https://discord.com/oauth2/authorize?client_id=APP_ID&scope=bot+applications.commands&permissions=1099780189206
   ```

   This grants View Channels, Send Messages, Embed Links, Attach Files, Read Message History, Manage Channels, Manage Roles, Manage Messages, Kick Members, Ban Members and Moderate Members.

5. In **Server Settings → Roles**, drag the Railcore role **above** the Verified role, the application role, and every role the bot should be able to moderate. Discord only lets a bot manage roles below its own.

## 2. Run it locally

You need **Node.js 24** (LTS). Docker is not needed for development.

```bash
npm install
cp .env.example .env     # then fill in DISCORD_BOT_TOKEN and TEST_SERVER_ID
npm run db:dev           # starts a local Postgres (Prisma Dev) in the background
npm run db:migrate       # creates the tables
npm run commands:dev     # registers the slash commands on your test server
npm run dev              # starts the bot and restarts it when you save a file
```

`npm run db:dev` always uses ports 51214 (database) and 51215 (shadow database), which match the URLs in `.env.example`. If either port is taken, it stops with a clear error instead.

After a reboot, run `npm run db:dev` again before `npm run dev`.

### Environment variables

| Variable              | Needed for        | What it is                                                                                               |
| --------------------- | ----------------- | -------------------------------------------------------------------------------------------------------- |
| `DISCORD_BOT_TOKEN`   | always            | The bot token from the Developer Portal.                                                                 |
| `TEST_SERVER_ID`      | `commands:dev`    | ID of your test server (enable Developer Mode in Discord, then right-click the server → Copy Server ID). |
| `DATABASE_URL`        | local dev         | Postgres connection URL. In Docker it is built from the `POSTGRES_*` values and this line is ignored.    |
| `SHADOW_DATABASE_URL` | `db:migrate` only | Scratch database Prisma uses while creating migrations. Local development only.                          |
| `POSTGRES_USER`       | Docker            | Database user. Default `railcore`.                                                                       |
| `POSTGRES_PASSWORD`   | Docker            | Database password. Use letters and digits only, because it becomes part of a URL. **Change it.**         |
| `POSTGRES_DB`         | Docker            | Database name. Default `railcore`.                                                                       |
| `LOG_LEVEL`           | optional          | `fatal`, `error`, `warn`, `info` (default), `debug` or `trace`.                                          |
| `NODE_ENV`            | set by Docker     | `production` switches logs to JSON. Leave it unset locally for readable, colored logs.                   |

## 3. Register the slash commands

Discord only shows commands that have been registered. Register again whenever you add a command or change its name, description or options.

| Command                           | Where                          | When to use                                   |
| --------------------------------- | ------------------------------ | --------------------------------------------- |
| `npm run commands:dev`            | Only `TEST_SERVER_ID`, instant | While developing                              |
| `npm run commands:global`         | Every server the bot is in     | Production. Can take a few minutes to appear. |
| `npm run commands:dev -- --clear` | Removes the test-server copies | After going global, to avoid duplicates       |

If commands are registered both on the test server and globally, they show up twice on the test server. Clear the test-server copies with the last command.

## 4. Set it up in Discord

1. Run **`/setup`** and set each item from the menu:
   - **Verification**: verification channel, Verified role, minimum account age (default 7 days, `0` turns the check off).
   - **Tickets & applications**: ticket category, ticket log channel, staff roles, and the application role that accepted applicants get.
   - **Logs**: mod log channel and server log channel.

   The dashboard warns you when the bot is missing permissions in a channel you pick.

2. Run **`/verify-panel`**. It posts the panel in the verification channel.
3. Run **`/ticket-panel`** in the channel where members should open tickets.
4. Hide your normal channels from `@everyone` and allow the Verified role, so only verified members see them.

### Who can use what

- `/setup`, `/verify-panel`, `/ticket-panel`: **Manage Server**
- `/warn`, `/warnings`, `/clearwarn`, `/timeout`, `/untimeout`: **Moderate Members**
- `/kick`: **Kick Members** · `/ban`, `/unban`: **Ban Members** · `/purge`: **Manage Messages**
- Claiming tickets and reviewing applications: the **staff roles** from `/setup`. Administrators always count as staff.

You can change who sees each command per role or member in **Server Settings → Integrations → Railcore**. The role hierarchy still applies: nobody can moderate themselves, the owner, the bot, or someone with an equal or higher role.

## 5. Deploy on a VPS with Docker

On the server (any Linux VPS, 1 GB RAM is plenty):

```bash
# Install Docker Engine and the compose plugin once
curl -fsSL https://get.docker.com | sh

# Get the code and configure it
git clone <your-repo-url> railcore && cd railcore
cp .env.example .env
nano .env                # set DISCORD_BOT_TOKEN and a strong POSTGRES_PASSWORD

# Build and start the bot and Postgres in the background
docker compose up -d --build

# Register the commands for every server (once, and again after command changes)
docker compose run --rm bot node dist/scripts/deploy-commands.js --global

# Watch the logs
docker compose logs -f bot
```

- **Migrations** run automatically every time the bot container starts (`prisma migrate deploy`).
- **Restarts**: both containers restart on their own after crashes and reboots (`restart: unless-stopped`).
- **The database** is only reachable from inside Docker. No port is opened to the internet. Its data lives in the `pgdata` volume.
- **Logs** are JSON and rotate automatically (3 × 10 MB per container).

### Updating

```bash
git pull
docker compose up -d --build
# only if commands changed:
docker compose run --rm bot node dist/scripts/deploy-commands.js --global
```

### Backups

```bash
# Backup (the dump replaces existing tables when restored)
docker compose exec db pg_dump --clean --if-exists -U railcore railcore > railcore-$(date +%F).sql

# Restore: stop the bot first so nothing writes in the meantime
docker compose stop bot
docker compose exec -T db psql -U railcore railcore < railcore-2026-01-01.sql
docker compose start bot
```

Use your own `POSTGRES_USER` / `POSTGRES_DB` if you changed them.

> **Careful:** `docker compose down` stops everything but keeps the data. `docker compose down -v` also **deletes the database volume**, and all cases, tickets and settings with it.

## Scripts

| Script                    | What it does                                                           |
| ------------------------- | ---------------------------------------------------------------------- |
| `npm run dev`             | Start with auto-reload (tsx)                                           |
| `npm run build`           | Generate the Prisma client and compile to `dist/`                      |
| `npm start`               | Run the compiled bot from `dist/`                                      |
| `npm run commands:dev`    | Register slash commands on the test server (`-- --clear` removes them) |
| `npm run commands:global` | Register slash commands globally                                       |
| `npm run db:dev`          | Start the local Prisma Dev database                                    |
| `npm run db:migrate`      | Create and apply a migration after changing `prisma/schema.prisma`     |
| `npm run db:deploy`       | Apply existing migrations without creating new ones                    |
| `npm run typecheck`       | TypeScript check                                                       |
| `npm run lint`            | ESLint                                                                 |
| `npm run format`          | Prettier                                                               |
| `npm test`                | Unit tests (Node's built-in test runner)                               |

## Project structure

```
src/
├─ index.ts            Startup, intents, graceful shutdown
├─ env.ts              Validates .env
├─ text.ts             All user-facing text
├─ handlers.ts         Loads commands, events and interactions automatically
├─ commands/           Slash commands, one file each (admin/, verification/, tickets/, moderation/)
├─ events/             Discord events (interactions, server log, ready)
├─ interactions/       Buttons, select menus and modals (buttons/, selects/, modals/)
├─ services/           Feature logic: setup, verification, tickets, applications, transcripts, moderation, logs
├─ database/           Prisma client
├─ utils/              Embeds, errors, permissions, durations, cooldowns, logger
└─ scripts/            deploy-commands.ts
prisma/
├─ schema.prisma       Database schema
└─ migrations/         SQL migrations, applied in order
```

## Customizing

- **Wording**: every message, button label and command description is in [`src/text.ts`](src/text.ts). Edit freely, but keep the function signatures.
- **Colors and footer**: [`src/utils/embeds.ts`](src/utils/embeds.ts). Every embed in the bot is created there.
- **Ticket questions**: question text is in `src/text.ts` under `tickets.questions`. Lengths and order are in `QUESTIONS` in [`src/services/tickets.ts`](src/services/tickets.ts). A modal holds at most 5 questions.
- **A new command**: add a file in `src/commands/<group>/` that default-exports `defineCommand({ data, execute })`, then register the commands again. The loader picks the file up automatically.
- **A new button or modal**: add a file in `src/interactions/<buttons|selects|modals>/` that default-exports `defineComponent({ kind, id: 'scope:action', execute })`. A button with the custom ID `scope:action:arg1:arg2` calls that handler with `['arg1', 'arg2']`.
- **Database changes**: edit `prisma/schema.prisma`, then run `npm run db:migrate -- --name what-changed`. Commit the new folder in `prisma/migrations/`.

## Troubleshooting

| Symptom                                                                                | Fix                                                                                                                                                  |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Startup failed` with `Used disallowed intents`                                        | Turn on both privileged intents (step 1.3).                                                                                                          |
| `Startup failed` with `Can't reach database server` or `Connection terminated` (local) | The local Prisma Dev database stopped or froze. Run `npx prisma dev stop railcore`, wait about 15 seconds, then `npm run db:dev`. Your data is kept. |
| Users see "I'm missing a permission to do that"                                        | Check the bot's role position and its permissions in that channel. Picking a channel again in `/setup` tells you which permissions are missing.      |
| A command is missing                                                                   | Register the commands again (section 3).                                                                                                             |
| Commands show up twice                                                                 | Registered on the test server and globally: run `npm run commands:dev -- --clear`.                                                                   |
| Users see "Something went off the rails … Reference: `abc123`"                         | Search the logs for `"ref":"abc123"` (or `ref: "abc123"` locally) to find the full error.                                                            |

## Known limitations

- **Single bot process**: the settings cache and the ticket-close lock live in memory. Don't run two copies of the bot against the same database.
- **Server log content**: Discord only sends a message's old text if the bot had it cached. The cache covers messages sent since the last start, up to the last 200 per channel. Edits of older messages show the old text as "Unknown", and deletions of older messages aren't logged.
- **No "changed by" in the server log**: role and nickname changes don't say who made them. That would need audit-log lookups.
- **Attachment links in transcripts**: they point to Discord's CDN, which expires links after about a day. The text is kept for good; images and files are not.

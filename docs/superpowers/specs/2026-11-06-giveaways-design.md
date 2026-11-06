# Giveaways — design

Date: 2026-11-06. Status: approved by the user; review answers merged.

## Intent

The server owner wants to run giveaways (first one: Discord Nitro) that feel modern and clean:
staff post a giveaway, members join with one click and get an instant private confirmation, and
when time is up the bot picks winners at random and pings them. The host then sends the prize
by DM themselves. Everything user-facing is English, like the rest of the bot (`src/text.ts`).

Success: a staff member starts a giveaway in under a minute, members enter without friction or
confusion, the draw is fair and happens on time even if the bot restarted, and people who
shouldn't win (blocked, warned, recent winners) can't.

## Goals

- `/giveaway start` posts a giveaway embed with an **Enter** button.
- One click enters; the member gets an ephemeral confirmation.
- At the end time the bot draws winners at random, edits the embed and pings the winners.
- A blacklist, both manual (roles and individual users) and automatic (active warnings, recent
  winners), configurable in `/setup`.
- Host controls: end early, reroll, cancel.

## Non-goals

- Reaction-based entry (decided: button, because only a button can answer privately).
- Delivering the prize. The host DMs it by hand.
- DMing winners. Winners are pinged in the channel; that is the notification.
- Required roles / whitelist, bonus entries, per-giveaway blacklists, scheduled starts, images.
- Giveaway logs in the log channels.

## Anti-goals (failures even if it "works")

- A click that does nothing or gives no answer.
- A giveaway that never ends, or ends twice, after a bot restart or with two bot copies running.
- The same person drawn twice in one giveaway.
- A blocked or ineligible member winning.
- Hitting Discord rate limits because the embed is edited on every click.

## Constraints

- Follow existing patterns: commands via `defineCommand`, components via `defineComponent` with
  `scope:action[:arg]` custom IDs, embeds only through `utils/embeds.ts`, all text in `src/text.ts`,
  settings via `SETTINGS`/`GROUPS` in `src/services/setup.ts`, DMs via `services/dm.ts`
  (`sendDm` returns null when DMs are closed), periodic jobs started from `events/ready.ts`.
- Two bot copies (test and production) share code; each only handles its own server
  (`isServedGuild`) and has its own database, so they never race on the same giveaway.
  Background jobs still skip giveaways of other servers, like `ticketReminders.ts`.
- One `/setup` select menu holds at most 25 entries.
- Work ships one step at a time; the user click-tests each step in Discord before the next.

## What was decided (by the user)

**Entering**

- Button "🎉 Enter" under the giveaway message. One click enters.
- Ephemeral answer: "You're in!".
- Clicking again: "You're already entered." with a **Leave giveaway** button.
- Blocked: ephemeral refusal that names the reason (e.g. "You have an active warning.").

**Look** — layout A (compact), mocked up during brainstorming:

- Embed (brand color) titled `🎉 <prize>`. Description: "Click **Enter** below to join!", then
  **Ends:** relative Discord timestamp plus absolute date, **Winners:** n, **Hosted by:** @host.
- Entry count shown on the button: `🎉 Enter · 42`.
- When ended: embed turns grey, title `🎉 <prize> · Ended`, shows **Winner(s):**, **Entries:**,
  **Hosted by:**; button disabled with label "Ended".
- A new message in the same channel pings the winners: "🎉 Congratulations @x! You won
  **<prize>**. @host will DM you your prize."

**Hosting**

- Only owner/admins host. Which roles may host is configured in `/setup`.
- Host sets prize, duration and number of winners.
- Default giveaway channel and an optional ping role are set in `/setup`; `/giveaway start` can
  override the channel.

**Blacklist** — global, same for every giveaway:

- Manual: blocked roles (in `/setup`) and blocked users (`/giveaway block @user`,
  `/giveaway unblock @user`, `/giveaway blocklist`).
- Automatic, switchable in `/setup`: members with active warnings; winners of the last X days.

**Prize**: winners are pinged in the server; the host sends the prize by DM.

## Design (my calls unless marked as the user's)

### Commands — `/giveaway` with subcommands

| Subcommand  | Options                                                                                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `start`     | `prize` (string, required, max 200), `duration` (string, required, `parseDuration` format like `/timeout`: "2h", "1d12h"; min 1 minute, max 30 days), `winners` (int 1–20, default 1), `channel` (text channel, optional) |
| `end`       | `giveaway` (autocomplete over running giveaways) — ends now and draws                                                                                                                                                     |
| `reroll`    | `giveaway` (autocomplete over ended giveaways), `count` (int 1–20, default 1)                                                                                                                                             |
| `cancel`    | `giveaway` (autocomplete over running giveaways) — ends without winners                                                                                                                                                   |
| `block`     | `user` (required), `reason` (optional, max 200)                                                                                                                                                                           |
| `unblock`   | `user` (required)                                                                                                                                                                                                         |
| `blocklist` | — ephemeral list of blocked users with who blocked them and why                                                                                                                                                           |

All replies to the host are ephemeral except the giveaway post itself.

**Who may use it:** members with Manage Server, plus members with one of the
`giveawayHostRoleIds` roles. Because host roles may lack Manage Server, the command is registered
**without** `setDefaultMemberPermissions` and the check happens in code; others get an ephemeral
"You can't host giveaways."

Per subcommand (the user's decision):

- Manage Server: everything, on every giveaway.
- Host role: `start`, `block`, `unblock`, `blocklist`; `end`, `reroll`, `cancel` **only on
  giveaways they host** (`hostId`). Autocomplete shows them only their own giveaways; picking
  another host's id anyway gets "You can only manage your own giveaways."
- (Reading "Jo, aber nur sein eigenes Giveaways" as: host roles may block/unblock too, but only
  touch their own giveaways. Block lists are global, so "own" doesn't apply there.) (My call. Trade-off: every member sees `/giveaway` in the command
  list. The alternative is Manage Server only and per-role overrides in Discord's own
  Server Settings → Integrations, which would drop the host-roles setting.)

**Start flow:** resolve channel (option → `giveawayChannelId` → error "Set a giveaway channel in
/setup or pick one."). Check the bot can post there (`missingPermissions` with `POST_PERMISSIONS`).
Create the DB row, post the message (ping role mentioned in the message content above the embed,
with `allowedMentions` limited to that role), store `messageId`. If posting fails, delete the row
and report the error.

**Autocomplete:** the handler in `src/handlers.ts` / `interactionCreate` has no autocomplete
routing yet; add it for this command. Choices show prize plus status/end time, value is the
giveaway id. Limited to the current guild.

### Settings — new `/setup` group "Giveaways"

Goes into the main menu (16 entries today → 23).

| Key                          | Kind                         | Default | Meaning                                                         |
| ---------------------------- | ---------------------------- | ------- | --------------------------------------------------------------- |
| `giveawayChannelId`          | channel (`POST_PERMISSIONS`) | null    | default channel                                                 |
| `giveawayPingRoleId`         | pingRole                     | null    | pinged on start                                                 |
| `giveawayHostRoleIds`        | roles                        | []      | may host besides Manage Server                                  |
| `giveawayBlockedRoleIds`     | roles                        | []      | can't enter                                                     |
| `giveawayBlockWarned`        | toggle                       | off     | members with active warnings can't enter                        |
| `giveawayWarnDays`           | number (days, max 365)       | 0       | only warnings of the last X days count; 0 = all active warnings |
| `giveawayWinnerCooldownDays` | number (days, max 365)       | 0       | winners of the last X days can't enter; 0 = off                 |

"Active warning" = `ModCase` with `action: 'WARN'` and `clearedAt: null` (same rule as
`/warnings`), optionally limited by `createdAt >= now - giveawayWarnDays`.

### Data model (Prisma)

```prisma
model Giveaway {
  id          Int       @id @default(autoincrement())
  guildId     String
  channelId   String
  /// Null only while the message is being posted.
  messageId   String?   @unique
  hostId      String
  prize       String
  winnerCount Int
  endsAt      DateTime
  /// Set together with the winners in one conditional write; that write is what stops a second draw.
  endedAt     DateTime?
  /// Set once the ended embed, winner ping and host DM were attempted. Null after endedAt = retry.
  announcedAt DateTime?
  /// Set with endedAt when cancelled: no winners, no announcement.
  cancelledAt DateTime?
  createdAt   DateTime  @default(now())
  entries     GiveawayEntry[]
  winners     GiveawayWinner[]

  @@index([endedAt, endsAt])
  @@index([guildId, endedAt])
}

/// One row per win, rerolls included. `wonAt` drives the winner cooldown.
model GiveawayWinner {
  giveawayId Int
  userId     String
  wonAt      DateTime @default(now())
  giveaway   Giveaway @relation(fields: [giveawayId], references: [id], onDelete: Cascade)

  @@id([giveawayId, userId])
  @@index([userId, wonAt])
}

model GiveawayEntry {
  giveawayId Int
  userId     String
  createdAt  DateTime @default(now())
  giveaway   Giveaway @relation(fields: [giveawayId], references: [id], onDelete: Cascade)

  @@id([giveawayId, userId])
}

model GiveawayBlock {
  guildId   String
  userId    String
  addedById String
  reason    String?
  createdAt DateTime @default(now())

  @@id([guildId, userId])
}
```

Plus the seven `GuildConfig` columns above.

### Entering (button `giveaway:enter:<id>`)

1. Giveaway missing or ended → ephemeral "This giveaway has ended."
2. Eligibility check (shared function, see below) fails → ephemeral refusal with the reason.
3. Insert entry; a unique-key conflict means already entered → ephemeral "You're already
   entered." with button `giveaway:leave:<id>`.
4. New entry → ephemeral "You're in! Good luck in the **<prize>** giveaway."
5. Schedule an entry-count refresh of the giveaway message.

Leave button: deletes the entry, answers "You left the giveaway." (edits the ephemeral reply),
schedules a count refresh. Leaving an ended giveaway → "This giveaway has ended."

**Count refresh is debounced:** at most one message edit per giveaway every ~10 seconds,
showing the current count. In-memory timer is fine; losing a pending refresh on restart only
leaves a slightly stale number until the next click or the end edit.

### Eligibility (one function, used on enter and on draw)

In order, first failure wins (reason text in brackets):

1. Has a role in `giveawayBlockedRoleIds` ("You have a role that can't enter giveaways.")
2. In `GiveawayBlock` ("You are blocked from giveaways.")
3. `giveawayBlockWarned` and an active warning in range ("You have an active warning.")
4. `giveawayWinnerCooldownDays > 0` and a `GiveawayWinner` row for a giveaway of this guild
   with `wonAt >= now - X days` ("You won a giveaway in the last X days."). Counting from `wonAt`,
   not the giveaway's end, so a rerolled winner gets the full cooldown (my call, from review).

The host may enter their own giveaway (my call; they can block themselves by role if wanted).

### Ending and drawing

- A job started from `ready.ts` checks every 15 seconds for `endedAt IS NULL AND endsAt <= now`
  in served guilds. `/giveaway end` uses the same end routine immediately.
- **Draw, then commit atomically** (my call, from review — "claim first" could strand a giveaway
  as ended-without-winners after a crash): shuffle entries with `crypto.randomInt`
  (Fisher–Yates), walk the shuffled list, keep a candidate if they are still a guild member and
  pass eligibility, stop at `winnerCount`. Fetch members lazily as you walk, not all at once.
  Then in one transaction: `updateMany({ where: { id, endedAt: null }, data: { endedAt: now } })`,
  and only if `count === 1` insert the `GiveawayWinner` rows. A losing racer (job vs
  `/giveaway end`) discards its draw. A crash before the commit just redraws on the next tick.
- **Announce** (separate step, retried): edit the giveaway message to the ended state (disabled
  button, grey embed — add a grey color to `utils/embeds.ts`), post the winner ping message
  replying to the giveaway message with `allowedMentions` limited to the winners, DM the host,
  then set `announcedAt`. The job also picks up `endedAt IS NOT NULL AND announcedAt IS NULL`.
  Discord errors on individual steps (message gone, no permission) are logged and the step is
  skipped, so `announcedAt` still gets set; only a crash leaves it null and causes a retry.
  No valid entries → embed says "No valid entries.", no ping message.
- A pending entry-count refresh is dropped if the giveaway has ended by the time it fires, so it
  can't put the embed back into the running state.
- DM the host: "Your giveaway **<prize>** ended. Winner(s): @x. Send them their prize." (via
  `sendDm`; closed DMs are ignored).
- Giveaway message deleted while running counts as **cancel** (my call: a deleted post shouldn't
  still hand out a prize). Hook into the existing `events/messageDelete.ts` (and
  `messageDeleteBulk.ts`) by `messageId`. If the deletion was missed (bot offline) and the end
  routine finds the message or channel gone, it cancels instead of drawing and logs a warning.

### Cancel

`/giveaway cancel` (or deleting the post) sets `endedAt` and `cancelledAt` with no winners, using
the same conditional `endedAt: null` write as the draw. The embed (if it still exists) turns grey
with title `🎉 <prize> · Cancelled`, button disabled with label "Cancelled". No ping message,
no host DM. Cancelled giveaways can't be rerolled and don't appear in reroll autocomplete.
Schema: add `cancelledAt DateTime?` to `Giveaway`.

### Reroll

`/giveaway reroll` on an ended giveaway draws `count` new winners with the same draw, excluding
everyone who already won it. New winners get `GiveawayWinner` rows with `wonAt = now` (so the
winner cooldown applies to them in full), the ended embed is updated to list all winners, and a new
ping message announces the new winner(s). Nobody left → ephemeral "No eligible entries left."

### Tests

One `*.test.ts` with the pure parts: shuffle/draw picks distinct users, respects count, skips
ineligible candidates, handles fewer entries than winners. Matches the repo's `tsx --test` setup.

## Left to the builder

- Exact English wording beyond the strings above, and where in `text.ts` it lives.
- File layout (suggested: `services/giveaways.ts`, `commands/giveaway/giveaway.ts`,
  `interactions/buttons/giveaway-enter.ts`, `giveaway-leave.ts`).
- Order of build steps, with each step click-testable on its own.
- README section for the feature.

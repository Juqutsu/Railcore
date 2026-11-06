# Giveaways Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/giveaway` lets owners/admins and host roles run button-entry giveaways with a random, restart-safe draw, a configurable blacklist, reroll and cancel.

**Architecture:** One service (`src/services/giveaways.ts`) owns DB access, message rendering, eligibility and the end/announce routine; a pure helper (`src/utils/draw.ts`) does the random pick. One `/giveaway` command with subcommands, two buttons, a 15 s job started from `ready.ts`, a `messageDelete` hook, and autocomplete routing added to the existing interaction handler.

**Tech Stack:** TypeScript (Node ≥ 24), discord.js 14, Prisma 7 + Postgres, `tsx --test` with `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-06-giveaways-design.md` — read it first; every task implicitly includes the spec section it names.

## Global Constraints

- All user-facing text lives in `src/text.ts` under a new `giveaways` block (plus `setup.settings.*`, `setup.groups.giveaways`, `commands.*`, `options.*`). English only.
- Embeds only via `utils/embeds.ts`. Add `colors.muted = 0x4e5058` and `embeds.muted(title?, description?)` for ended/cancelled giveaways.
- Custom IDs: `giveaway:enter:<id>`, `giveaway:leave:<id>`.
- Limits from the spec: prize max 200 chars, block reason max 200, duration 1 minute – 30 days via `parseDuration`, winners 1–20 (default 1), reroll count 1–20 (default 1), setup day numbers max 365.
- Every mention-bearing message sets `allowedMentions` explicitly (ping role only on start; winners + host on the winner ping).
- Background job skips guilds where `!isServedGuild(guildId)`.
- One task = one click-testable step. After each task: `npm run typecheck`, `npm run lint`, `npm test` green, `npm run db:migrate` applied where the schema changed, `npm run commands:dev` where commands changed; then the user click-tests in Discord before the next task starts. Don't start a second bot while the user's `npm run dev` runs.
- Commit only after the user's click-test says OK.

## Review Focus

1. **Double-click on Enter** (two interactions before the first insert lands) → second click answers "You're already entered.", never an error. Pinned in Task 2 (insert via `createMany({ skipDuplicates: true })`, `count === 0` = already entered).
2. **Fewer valid entrants than winners** (incl. zero) → only the valid ones win; zero shows "No valid entries." and sends no ping. Pinned in Task 3 tests.
3. **Winner left the server or got blocked/warned after entering** → skipped at draw time, next candidate taken. Pinned in Task 3 (`pickWinners` skips `isValid === false`) and Task 4 (draw calls the eligibility check).
4. **Host role trying to end/reroll/cancel someone else's giveaway** → "You can only manage your own giveaways." Pinned in Task 3 `canManage` test.
5. **Bot offline when a giveaway's end time passes** → it ends on the first job tick after start, exactly once. Pinned in Task 3 (job query has no lower time bound; commit uses `endedAt: null` guard) and its click-test.

---

### Task 1: Schema + `/setup` "Giveaways" group

**Files:**

- Modify: `prisma/schema.prisma` (7 `GuildConfig` columns; models `Giveaway`, `GiveawayEntry`, `GiveawayWinner`, `GiveawayBlock` exactly as in spec "Data model", including `cancelledAt`)
- Create: migration via `npm run db:migrate -- --name giveaways`
- Modify: `src/services/setup.ts` (SETTINGS, GROUPS, `NumberSetting`, `formatValue`, number modal hint)
- Modify: `src/interactions/modals/setup-number.ts` only if the hint/invalid text needs the new zero label
- Modify: `src/text.ts` (`setup.groups.giveaways`, 7 `setup.settings` entries)
- Test: `src/services/setup.test.ts`

**Interfaces:**

- Produces: `GuildConfig` fields `giveawayChannelId: string | null`, `giveawayPingRoleId: string | null`, `giveawayHostRoleIds: string[]`, `giveawayBlockedRoleIds: string[]`, `giveawayBlockWarned: boolean` (default false), `giveawayWarnDays: number` (default 0), `giveawayWinnerCooldownDays: number` (default 0). Prisma models `Giveaway`, `GiveawayEntry`, `GiveawayWinner`, `GiveawayBlock`.
- Produces: `export const GROUPS` (now exported) and `export const GAME_GROUPS` from `setup.ts`.

- [ ] **Step 1: Write the failing test** in `setup.test.ts`

```ts
void test('each setup menu fits Discord’s 25-option limit', () => {
  const count = (game: boolean) =>
    GROUPS.filter((g) => GAME_GROUPS.includes(g.name) === game).flatMap((g) => g.keys).length +
    (game ? 1 : 0); // XP roles entry
  assert.ok(count(false) <= 25);
  assert.ok(count(true) <= 25);
});

void test('giveaway settings are in the Giveaways group', () => {
  const group = GROUPS.find((g) => g.name === 'giveaways');
  assert.deepEqual(group?.keys, [
    'giveawayChannelId',
    'giveawayPingRoleId',
    'giveawayHostRoleIds',
    'giveawayBlockedRoleIds',
    'giveawayBlockWarned',
    'giveawayWarnDays',
    'giveawayWinnerCooldownDays',
  ]);
});
```

- [ ] **Step 2: Run** `npm test` — Expected: FAIL (GROUPS not exported / no `giveaways` group).

- [ ] **Step 3: Implement**
  - Schema + migration (spec "Data model" plus the 7 columns).
  - SETTINGS kinds: `giveawayChannelId` channel with `POST`, `giveawayPingRoleId` pingRole, `giveawayHostRoleIds` roles, `giveawayBlockedRoleIds` roles, `giveawayBlockWarned` toggle, `giveawayWarnDays` number days max 365, `giveawayWinnerCooldownDays` number days max 365.
  - Group `giveaways` in the main menu (not in `GAME_GROUPS`), placed after `logs`.
  - `NumberSetting` gets optional `zero?: string`: shown by `formatValue` and the number modal hint instead of "Off" when the value is 0. `giveawayWarnDays` uses `zero: 'All active warnings'` (text in `text.ts`); the cooldown keeps the default "Off".
  - Labels/descriptions (English, in `text.ts`), e.g. "Giveaway channel" / "Default channel for /giveaway start.", "Giveaway ping role", "Giveaway host roles" / "Can host giveaways besides Manage Server.", "Giveaway blocked roles", "Block warned members", "Warning lookback", "Winner cooldown" / "Winners of the last X days can't enter."

- [ ] **Step 4: Run** `npm run typecheck && npm run lint && npm test` — Expected: PASS.

- [ ] **Step 5: Click-test (user):** `/setup` shows a "Giveaways" section with 7 rows; each can be set and cleared; warning lookback 0 shows "All active warnings".

- [ ] **Step 6: Commit** — `feat: giveaway settings and schema`

---

### Task 2: `/giveaway start`, Enter/Leave buttons, live count

**Files:**

- Create: `src/services/giveaways.ts`
- Create: `src/commands/giveaway/giveaway.ts`
- Create: `src/interactions/buttons/giveaway-enter.ts`, `src/interactions/buttons/giveaway-leave.ts`
- Modify: `src/utils/embeds.ts` (`colors.muted`, `embeds.muted`)
- Modify: `src/text.ts` (`giveaways` block, `commands.giveaway*`, `options.giveaway*`)
- Test: `src/services/giveaways.test.ts`

**Interfaces:**

- Consumes: Task 1 schema/config fields.
- Produces (in `giveaways.ts`):
  - `type GiveawayView = Giveaway & { winnerIds: string[] }`
  - `giveawayMessage(g: GiveawayView, entryCount: number): BaseMessageOptions` — running state = spec layout A; ended/cancelled state = muted embed, disabled button (see Task 3/5 for those states; implement all three here, they share the builder).
  - `isHost(member: GuildMember, config: GuildConfig): boolean` — Manage Server or any `giveawayHostRoleIds` role.
  - `requireHost(member, config): void` — throws `UserError(t.giveaways.cantHost)`.
  - `scheduleCountRefresh(client: Client, giveawayId: number): void` — debounced, ≤ 1 edit per giveaway per 10 s; re-reads the giveaway when it fires and does nothing if `endedAt` is set.
  - `startGiveaway(member: GuildMember, input: { prize: string; durationMs: number; winners: number; channel: GuildTextBasedChannel | null }): Promise<Giveaway>`

- [ ] **Step 1: Write the failing tests** in `giveaways.test.ts` (pure rendering; build a `GiveawayView` literal)

```ts
void test('running giveaway shows count on the enter button', () => {
  const msg = giveawayMessage(running({ id: 7 }), 42);
  const button = msg.components![0].toJSON().components[0];
  assert.equal(button.custom_id, 'giveaway:enter:7');
  assert.match(button.label!, /Enter · 42/);
  assert.notEqual(button.disabled, true);
  assert.match(embedOf(msg).title!, /^🎉 Discord Nitro$/);
});

void test('ended giveaway is grey with a disabled "Ended" button and lists winners', () => {
  const msg = giveawayMessage(running({ endedAt: new Date(), winnerIds: ['1', '2'] }), 128);
  const button = msg.components![0].toJSON().components[0];
  assert.equal(button.disabled, true);
  assert.equal(button.label, '🎉 Ended');
  assert.equal(embedOf(msg).color, 0x4e5058);
  assert.match(embedOf(msg).title!, /· Ended$/);
  assert.match(embedOf(msg).description!, /<@1>.*<@2>/s);
});

void test('ended without winners says "No valid entries."', () => {
  const msg = giveawayMessage(running({ endedAt: new Date(), winnerIds: [] }), 3);
  assert.match(embedOf(msg).description!, /No valid entries\./);
});

void test('cancelled giveaway shows "Cancelled"', () => {
  const now = new Date();
  const msg = giveawayMessage(running({ endedAt: now, cancelledAt: now }), 5);
  assert.equal(msg.components![0].toJSON().components[0].label, '🎉 Cancelled');
  assert.match(embedOf(msg).title!, /· Cancelled$/);
});
```

(`running(overrides)` and `embedOf(msg)` are small helpers in the test file.)

- [ ] **Step 2: Run** `npm test` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement `giveawayMessage`, `isHost`/`requireHost`, `embeds.muted`.** Running description per spec "Look": "Click **Enter** below to join!", **Ends:** `time(endsAt, 'R')` + `time(endsAt, 'f')`, **Winners:** n, **Hosted by:** `<@hostId>`.

- [ ] **Step 4: Run** `npm test` — Expected: PASS.

- [ ] **Step 5: Implement `/giveaway start`** in `commands/giveaway/giveaway.ts`: no `setDefaultMemberPermissions`, `setContexts(Guild)`; subcommand `start` with options `prize` (max 200), `duration` (string), `winners` (int 1–20), `channel` (GuildText/GuildAnnouncement). Flow = spec "Start flow": `requireHost`; `parseDuration` → null or `< 60_000` or `> 30 * 86_400_000` → `UserError`; channel option → `giveawayChannelId` → `UserError(t.giveaways.noChannel)`; `missingPermissions(channel, POST_PERMISSIONS)` non-empty → `UserError`; create row, send `{ content: pingRole ? <@&id> : undefined, ...giveawayMessage(g, 0), allowedMentions: { roles: pingRole ? [id] : [] } }`, store `messageId`; on send failure delete the row and rethrow. Ephemeral reply to host with a link to the post.

- [ ] **Step 6: Implement buttons** per spec "Entering":
  - `giveaway:enter:<id>` — not found or `endedAt` → ephemeral `t.giveaways.ended`; (eligibility comes in Task 4); `prisma.giveawayEntry.createMany({ data: [{ giveawayId, userId }], skipDuplicates: true })`; `count === 0` → ephemeral "You're already entered." + `giveaway:leave:<id>` danger button; else ephemeral "You're in! Good luck in the **<prize>** giveaway."; then `scheduleCountRefresh`.
  - `giveaway:leave:<id>` — ended → `interaction.update` with `t.giveaways.ended`; else `deleteMany` the entry, `interaction.update({ content: "You left the giveaway.", components: [] })`, `scheduleCountRefresh`.

- [ ] **Step 7: Run** `npm run typecheck && npm run lint && npm test && npm run commands:dev` — Expected: PASS, commands registered.

- [ ] **Step 8: Click-test (user):** start a 10-minute giveaway; ping role pinged; Enter → "You're in!"; Enter again → "already entered" + Leave works; button count updates within ~10 s; a member without Manage Server or host role gets "You can't host giveaways."

- [ ] **Step 9: Commit** — `feat: /giveaway start with button entry`

---

### Task 3: Draw, end job, `/giveaway end`, autocomplete

**Files:**

- Create: `src/utils/draw.ts`, `src/utils/draw.test.ts`
- Modify: `src/services/giveaways.ts`, `src/services/giveaways.test.ts`
- Modify: `src/commands/giveaway/giveaway.ts` (subcommand `end`, `autocomplete`)
- Modify: `src/handlers.ts` (`Command.autocomplete?`), `src/events/interactionCreate.ts` (route autocomplete)
- Modify: `src/events/ready.ts` (`startGiveaways(client)`)

**Interfaces:**

- Produces (`draw.ts`):
  - `shuffle<T>(items: readonly T[], randomInt?: (maxExclusive: number) => number): T[]` — Fisher–Yates, default `crypto.randomInt`, returns a copy.
  - `pickWinners(candidates: readonly string[], count: number, isValid: (id: string) => Promise<boolean>, randomInt?: (n: number) => number): Promise<string[]>` — shuffles, walks in order, keeps valid ones until `count`, returns ≤ `count` distinct ids.
- Produces (`giveaways.ts`):
  - `canManage(member: GuildMember, config: GuildConfig, g: Giveaway): boolean` — Manage Server: always; host role: only if `g.hostId === member.id`.
  - `requireManage(member, config, g): void` — throws `UserError(t.giveaways.notYours)` / `cantHost`.
  - `endGiveaway(client: Client, giveawayId: number): Promise<'ended' | 'already'>` — spec "Ending and drawing": draw, then one transaction `updateMany({ where: { id, endedAt: null }, data: { endedAt } })` + `giveawayWinner.createMany` only if `count === 1`; then `announce`. Message/channel gone at end → cancel instead (Task 5 provides `cancelGiveaway`; until then log and still end with no ping).
  - `announce(client: Client, giveawayId: number): Promise<void>` — edit message, winner ping replying to the giveaway message with `allowedMentions: { users: [...winners, hostId] }`, host DM via `sendDm`, set `announcedAt`. Each Discord step in its own try/catch → `logger.warn`.
  - `startGiveaways(client: Client<true>): void` — `setInterval` 15 s, `.unref()`; picks `{ endedAt: null, endsAt: { lte: now } }` → `endGiveaway`, and `{ endedAt: { not: null }, cancelledAt: null, announcedAt: null }` → `announce`; skips `!isServedGuild`.
  - `giveawayChoices(member: GuildMember, focused: string, state: 'running' | 'ended'): Promise<ApplicationCommandOptionChoiceData<number>[]>` — ≤ 25, current guild, filtered by `canManage`, name `"<prize> · ends <date>"` / `"<prize> · ended <date>"` clipped to 100 chars, value = id. `'ended'` excludes cancelled.
- Produces (`handlers.ts`): `Command.autocomplete?(interaction: AutocompleteInteraction<'cached'>): Promise<unknown>`; `interactionCreate` calls it for `interaction.isAutocomplete()` and on error logs and responds `[]`.

- [ ] **Step 1: Write failing tests** `draw.test.ts`

```ts
const seq =
  (...xs: number[]) =>
  () =>
    xs.shift() ?? 0; // fake randomInt
void test('picks distinct winners up to count', async () => {
  const w = await pickWinners(['a', 'b', 'c', 'd'], 2, async () => true);
  assert.equal(w.length, 2);
  assert.equal(new Set(w).size, 2);
});
void test('skips invalid candidates and takes the next one', async () => {
  const w = await pickWinners(['a', 'b', 'c'], 2, async (id) => id !== 'b');
  assert.deepEqual([...w].sort(), ['a', 'c']);
});
void test('fewer valid entrants than winners returns only the valid ones', async () => {
  assert.deepEqual(await pickWinners(['a'], 3, async () => true), ['a']);
  assert.deepEqual(await pickWinners([], 1, async () => true), []);
});
void test('shuffle is a permutation and does not mutate input', () => {
  const input = [1, 2, 3, 4];
  const out = shuffle(input, seq(0, 0, 0));
  assert.deepEqual([...out].sort(), [1, 2, 3, 4]);
  assert.deepEqual(input, [1, 2, 3, 4]);
});
```

and in `giveaways.test.ts`

```ts
void test('host role can only manage own giveaways; Manage Server manages all', () => {
  const config = cfg({ giveawayHostRoleIds: ['host'] });
  const g = { hostId: 'alice' } as Giveaway;
  assert.equal(canManage(member('alice', ['host']), config, g), true);
  assert.equal(canManage(member('bob', ['host']), config, g), false);
  assert.equal(canManage(member('admin', [], { manageGuild: true }), config, g), true);
  assert.equal(canManage(member('eve', []), config, g), false);
});
```

(`member(id, roleIds, opts)` builds a minimal `GuildMember`-shaped stub cast with `as unknown as GuildMember`.)

- [ ] **Step 2: Run** `npm test` — Expected: FAIL.

- [ ] **Step 3: Implement `draw.ts` and `canManage`/`requireManage`.** Run `npm test` — Expected: PASS.

- [ ] **Step 4: Implement `endGiveaway`, `announce`, `startGiveaways`, wire into `ready.ts`.** Draw validity for now = still a guild member (`guild.members.fetch(id)` → catch → false); Task 4 adds eligibility. Winner ping copy (spec): "🎉 Congratulations <@x>! You won **<prize>**. <@host> will DM you your prize." Host DM: "Your giveaway **<prize>** ended. Winner(s): … Send them their prize."

- [ ] **Step 5: Implement autocomplete routing, `/giveaway end`** (option `giveaway`, integer, autocomplete, required): load, guild check, `requireManage`, already ended → `UserError`; `deferReply(ephemeral)`; `endGiveaway`; reply "Ended." or "That giveaway already ended."

- [ ] **Step 6: Run** `npm run typecheck && npm run lint && npm test && npm run commands:dev` — Expected: PASS.

- [ ] **Step 7: Click-test (user):** 1-minute giveaway with 2 entrants and `winners: 1` ends within ~15 s of the end time; embed grey with winner; ping + host DM arrive. A 2-minute giveaway, stop the bot past its end, start again → ends once on start. `/giveaway end` autocomplete shows only own giveaways for a host-role member.

- [ ] **Step 8: Commit** — `feat: giveaway draw, end job and /giveaway end`

---

### Task 4: Blacklist — eligibility, `block` / `unblock` / `blocklist`

**Files:**

- Modify: `src/services/giveaways.ts`, `src/services/giveaways.test.ts`
- Modify: `src/commands/giveaway/giveaway.ts`
- Modify: `src/interactions/buttons/giveaway-enter.ts`
- Modify: `src/text.ts`

**Interfaces:**

- Produces:
  - `type EligibilityFacts = { roleIds: readonly string[]; blocked: boolean; hasActiveWarning: boolean; wonRecently: boolean }`
  - `ineligibleReason(facts: EligibilityFacts, config: GuildConfig): string | null` — pure; order and copy from spec "Eligibility"; warnings only count if `config.giveawayBlockWarned`; `wonRecently` only if `config.giveawayWinnerCooldownDays > 0` (cooldown text includes X).
  - `eligibilityFacts(member: GuildMember, config: GuildConfig, now: Date): Promise<EligibilityFacts>` — `GiveawayBlock` lookup; `ModCase` `{ action: 'WARN', clearedAt: null, targetId, guildId, createdAt: giveawayWarnDays ? { gte: now - days } : undefined }`; `GiveawayWinner` with `wonAt >= now - cooldown` joined to a giveaway of this guild.
  - `checkEligible(member, config, now): Promise<string | null>` = facts → reason. Used by Enter (before insert) and as `isValid` in the draw (member fetch + `checkEligible === null`).

- [ ] **Step 1: Write failing tests**

```ts
const base = { roleIds: [], blocked: false, hasActiveWarning: false, wonRecently: false };
void test('blocked role wins over everything else', () => {
  const c = cfg({ giveawayBlockedRoleIds: ['r'], giveawayBlockWarned: true });
  assert.match(ineligibleReason({ ...base, roleIds: ['r'], blocked: true }, c)!, /role/);
});
void test('manual block', () => {
  assert.match(ineligibleReason({ ...base, blocked: true }, cfg({}))!, /blocked/);
});
void test('warnings only count when the setting is on', () => {
  assert.equal(ineligibleReason({ ...base, hasActiveWarning: true }, cfg({})), null);
  assert.match(
    ineligibleReason({ ...base, hasActiveWarning: true }, cfg({ giveawayBlockWarned: true }))!,
    /active warning/,
  );
});
void test('winner cooldown names the days and is off at 0', () => {
  assert.equal(ineligibleReason({ ...base, wonRecently: true }, cfg({})), null);
  assert.match(
    ineligibleReason({ ...base, wonRecently: true }, cfg({ giveawayWinnerCooldownDays: 30 }))!,
    /last 30 days/,
  );
});
void test('eligible member gets null', () => {
  assert.equal(ineligibleReason(base, cfg({ giveawayBlockWarned: true })), null);
});
```

- [ ] **Step 2: Run** `npm test` — Expected: FAIL.

- [ ] **Step 3: Implement `ineligibleReason`, `eligibilityFacts`, `checkEligible`;** call in Enter (refusal: "❌ **You can't enter this giveaway.**\n<reason>") and in the draw's `isValid`. Run `npm test` — PASS.

- [ ] **Step 4: Implement subcommands** (all `requireHost`): `block` (`user` required, `reason` max 200; upsert `GiveawayBlock` with `addedById`), `unblock` (`user`; not blocked → `UserError`), `blocklist` (ephemeral embed, one line per block: `<@user> · by <@addedBy> · <reason or "no reason"> · time(createdAt,'d')`, clipped to 4096).

- [ ] **Step 5: Run** `npm run typecheck && npm run lint && npm test && npm run commands:dev` — PASS.

- [ ] **Step 6: Click-test (user):** blocked user, blocked role, warned member (toggle on), recent winner (cooldown set) each get the right refusal; `blocklist` shows entries; a member blocked after entering doesn't win.

- [ ] **Step 7: Commit** — `feat: giveaway blacklist`

---

### Task 5: Reroll, cancel, delete-as-cancel, README

**Files:**

- Modify: `src/services/giveaways.ts`, `src/commands/giveaway/giveaway.ts`
- Modify: `src/events/messageDelete.ts`, `src/events/messageDeleteBulk.ts`
- Modify: `src/text.ts`, `README.md` (Features, Commands, "Set it up in Discord")

**Interfaces:**

- Produces:
  - `cancelGiveaway(client: Client, where: { id: number } | { messageId: string }): Promise<boolean>` — conditional `updateMany({ where: { ...where, endedAt: null }, data: { endedAt: now, cancelledAt: now } })`; true if it cancelled; then best-effort edit of the message to the cancelled state. No ping, no DM.
  - `rerollGiveaway(client: Client, giveawayId: number, count: number): Promise<string[]>` — spec "Reroll": candidates = entries minus existing winners, same `pickWinners` + eligibility; insert `GiveawayWinner` rows (`wonAt` now); edit embed to list all winners; post a new ping for the new winners only. Returns new winner ids (empty → caller shows "No eligible entries left.").
  - `endGiveaway` (Task 3) now calls `cancelGiveaway` when the message or channel is gone.

- [ ] **Step 1: Implement `cancelGiveaway`, `rerollGiveaway`** and subcommands `cancel` (autocomplete `'running'`) and `reroll` (autocomplete `'ended'`, `count` 1–20); both `requireManage`; reroll on a cancelled or running giveaway → `UserError`.

- [ ] **Step 2: Hook deletes.** In `messageDelete.ts`, before the existing `partial`/`bot` early return, call `void cancelGiveaway(client, { messageId: message.id })` (works for uncached messages, since only the id is needed). In `messageDeleteBulk.ts`, do the same for each id in `messages.keys()`.

- [ ] **Step 3: README** — feature bullet, `/giveaway` subcommands in the commands table, the Giveaways setup rows in "Set it up in Discord".

- [ ] **Step 4: Run** `npm run typecheck && npm run lint && npm test && npm run commands:dev` — PASS.

- [ ] **Step 5: Click-test (user):** reroll gives a different winner and pings only them; reroll when all entrants already won → "No eligible entries left."; `/giveaway cancel` greys the post as Cancelled with no ping; deleting a running giveaway's post → it never draws (check DB/`/giveaway end` autocomplete no longer lists it).

- [ ] **Step 6: Commit** — `feat: giveaway reroll and cancel`

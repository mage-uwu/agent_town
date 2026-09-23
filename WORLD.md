# One world, built together

Agent Town has exactly one shared world: one immutable seed, one coordinate space,
one persistent database, and one authoritative multiplayer service. Every connection
routes to `agent-town-single-world-v1`. There is no room ID, world picker, or player-specific map.

## Play and build

Install Node 20+ and pnpm, then:

```sh
pnpm install --frozen-lockfile
pnpm run build:site
pnpm run dev:world
# Open http://127.0.0.1:8787/world/
```

The checked-in `world/engine.wasm` is usable without a C compiler. Rebuilding it
requires LLVM Clang with the wasm32 target and wasm-ld (for example `brew install llvm lld`).
Set `CLANG` if your compiler is elsewhere. To stage the existing binary, run
`pnpm run build && node scripts/build-site.js` instead of `build:site`.

WASD/arrows move. Click a neighboring tile, or face it and press E. Actions 1–6
collect, build wood walls, build stone walls, lay floors, build bridges, and remove
construction. The inventory pays construction costs. A felled tree grants four
wood; a wall costs two, floor one, bridge three. Removal returns one material.
M opens the atlas; +/− changes zoom. The starting clearing has wood east, stone
west, iron south, and fiber north. Separate browser profiles/devices are separate
guest players. One guest session can have one connection at a time.

`pnpm start` also serves a **local-only preview** at `/world/index.html`. This uses
the same terrain and C rules, saving edits on that device, and explicitly labels
itself offline. It is a development preview, not another hosted world.

## Small C engine, large flat map

`engine/world.c` is freestanding C11: integer arithmetic, no allocator, libc, WASI,
clock, operating system, or graphics dependency. The actual WASM build has no host
imports and a fixed 128 KiB memory. Browser rendering uses Canvas and the existing
procedural player sprites. Every terrain and construction rule runs in C.

The coordinate range is [-1,048,576, 1,048,576) on each axis: 2,097,152 squared,
about 4.4 trillion possible tiles. They are **not allocated**. Deterministic
coordinate hashing and integer interpolated noise generate 32×32 chunks on demand.
The browser retains at most 128 base chunks. Forest, beach, ocean, volcanic, and
jungle regions are generated from elevation, heat, and moisture fields; elevation
only selects terrain, with no Z levels. Water and lava block walking. Bridges cross
water. Trees, boulders, iron deposits, and fiber have finite harvest durability.

The Dwarf Fortress reference is the tile grid, compact material/object data, and
separation of simulation from display. This is original code, not the DF engine.
There are no citizens, job queues, fluid simulation, pathfinding, underground
layers, or Minecraft-style crafting recipes yet.

A tile is one uint32: biome (bits 0–7), ground (8–15), object (16–23), remaining
hits (24–31). The C API exposes generation, chunk generation, walkability, and
command application. `world/core.js` wraps that ABI for browser and server alike.
Changing generation or rule semantics requires an engine version and a migration;
the authority refuses to open persisted data with a different seed/version.

## Multiplayer authority and persistence

A Cloudflare Worker routes **all** sessions to one SQLite-backed Durable Object.
That object's own WASM instance applies commands. Clients send sequence-numbered
intent (move/harvest/build/remove), never authoritative position, inventory, or
terrain. The server derives the target tile, checks reach, occupancy, movement,
materials, and command frequency. A synchronous transaction commits the player,
sequence, tile edit, and world revision together. Competing resource commands are
serialized; the last hit can pay out only once.

Terrain needs no database rows until edited. SQLite stores tile overrides indexed
by chunk plus guest inventories/positions. Joining and crossing a chunk boundary
send a 5×5-chunk edit snapshot; live player events are broadcast to connected peers.
The client keeps nearby overrides and renders bounded terrain around the player.
WebSockets use Cloudflare's hibernation API; session metadata is in attachments,
not a live global socket map. A guest's opaque HttpOnly cookie is separate from
the public player ID. Losing that cookie loses access to that guest character;
account recovery is not implemented.

The current authority is intentionally capped at **32 simultaneous players**.
This is a tested multiplayer foundation, not a claim of 32-player load testing or
MMO-scale operation. A future capacity expansion should partition authority by
geography while preserving this single world's coordinates and identity. Production
work still includes account recovery, abuse controls for guest creation, moderation,
backups, metrics/load testing, and an explicit cross-region ownership protocol if
geographic partitioning is added. There is no private build ownership yet: anyone
can remove construction, as expected for this initial shared sandbox.

## Validation and deployment

```sh
pnpm test               # 22 generator + C/WASM checks; native Clang required
pnpm run test:online    # against a running local Wrangler world; creates test edits
# Stop/restart Wrangler with its persisted .wrangler state, then:
node tests/online.js --resume  # verifies inventory/position/tile survive restart
pnpm run types
pnpm exec wrangler deploy --dry-run --outdir build/worker
pnpm run deploy         # publishes to your authenticated Cloudflare account
```

The online test uses two independent guest sessions to check shared state,
contested harvesting, broadcasts, reconnect persistence, and invalid command,
sequence, and origin rejection. The restart fixture stays under ignored `build/`
and contains only a local test guest cookie. `.wrangler/` is ignored too.

Cloudflare deployment configuration and assets are included; this change does not
itself publish a live world. Reference APIs:
[Workers WASM](https://developers.cloudflare.com/workers/runtime-apis/webassembly/javascript/),
[hibernating WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/),
[SQLite storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/).

# Marvel vs. Capcom 2 native port in progress

Route: `/marvel-vs-capcom-2` redirects to the static cabinet's `index.html`.
The home free-play card and footer link expose it outside daily scores/streaks.

This is the approved two-character first release: Ryu and Cyclops, CPU or local
versus, keyboard/touch/standard gamepads, first-to-two rounds, blocking, crouching,
jumping, four attack buttons, original normal chains, motion specials, aerial
actions, five hyper callbacks, linked projectiles/beams, pause, result and rematch.

Character sprite cells were decoded from the supplied US PS2 release's local
PL00/PL06 packages. Atlas metadata includes source hashes and cell origins.
The native reader follows original TBL action records, countdowns, jumps, frame
events and collision selectors. Original HIT/HIT_FM/HIT_DT rows, normal chain
tables, motion descriptors, walk/jump limits and damage tables feed translated
selected character callbacks. The supplied SLUS_204.86 SHA256 is
`48ebf907d8149122ca9bd622ed11c290d5f93173078ea5bd570e1ac5566f13d7`.
The matching [PS2 decompilation](https://github.com/g-guthrie/mvc2-ps2-decomp) was
used as a primary reference, with residual MIPS checked against that executable.

This is not verified1:1 parity. No original-runtime comparison oracle is
available. Remaining shared-engine gaps include global superflash scheduling,
camera projection/clipping, projectile clashes,
throw/OTG/invulnerability exceptions, ground-roll inputs and recovery cancels.
CPU, match format, initial one-bar allowance, arena and synthesized audio remain
cabinet scaffolding. The one-fighter host marks its two unavailable teammate
slots as eliminated; snapback type12 therefore uses the native last-fighter
type2 branch. Full teams, assists, tags, roster, original stage/audio are absent.

The buildless modules run under the existing same-origin CSP. No emulator,
retail executable, disc, BIOS, SDK, external asset host or runtime dependency is
needed. Only the two selected characters' decoded data/artwork are included.
The manifest covers36 files /approximately8.8MB (excluding the manifest).

Controls are shown below the cabinet. Losing focus or a controller pauses the
match and clears held controls; the player resumes explicitly. Audio starts only
after a user gesture. The page links back to Daily Arcade.

P1: arrows and Z=LP/X=HP/C=LK/V=HK. P2: WASD and F=LP/G=HP/H=LK/J=HK.
Standard pad: X/Y punches, A/B kicks, D-pad/stick up to jump, Start to pause.
The in-page guide lists directional motion commands and hyper costs.
Super-jump recognition follows00188330's down-edge/up-edge15-update countdown;
001884C0 also enables confirmed-launcher jumps. Native366 buffers fresh edges
only during hitstop and clears on normal entry; held HK alone cannot trigger
Cyclops's follow-up. Character motion recognition precedes hitstop and defers
the new action callback until unfrozen, as in00179590.

Public-UI browser E2E covers normal chains, motion/air specials, all five hypers
(including earned level3), chip guard, reversed facing, active Optic-to-hyper
cancel and linked-beam retirement, a natural result, rematch, CPU, pause,
simulated gamepad disconnect and fullscreen touch controls. CLI E2E verifies
482action variants/2,325records, source playback timelines and3,439palette cells;
the source project retains the real-archive extraction and asset-export CLI E2E.
`manifest.json` records every published cabinet file hash for served-file checks.
Typecheck, focused ESLint and production build pass. No unit/integration suites
were created or run. Browser success does not establish original-runtime parity.

# Marvel vs. Capcom 2 native preview

Route: `/marvel-vs-capcom-2` redirects to the static cabinet's `index.html`.
The home free-play card and footer link expose it outside daily scores/streaks.

This is the approved two-character first release: Ryu and Cyclops, CPU or local
versus, keyboard/touch/standard gamepads, first-to-two rounds, blocking, crouching,
jumping, normal/heavy attacks, projectile special, pause, result and rematch.

Character sprite cells were decoded from the supplied US PS2 release's local
PL00/PL06 packages. Atlas metadata includes source hashes and cell origins.
Combat rules, frame selections/timing, AI, arena and sound effects are authored
for this browser preview. They do not claim original-game timing or balance.
The full roster, three-character teams, assists and tags are not included.

The buildless modules run under the existing same-origin CSP. No emulator,
retail executable, disc, BIOS, SDK, external asset host or runtime dependency is
needed. Only the two selected character atlases are included.

Controls are shown below the cabinet. Losing focus or a controller pauses the
match and clears held controls; the player resumes explicitly. Audio starts only
after a user gesture. The page links back to Daily Arcade.

Public-UI browser E2E covers a natural match result, rematch, pause and mobile fit;
the source project retains the real-archive extraction and asset-export CLI E2E.
`manifest.json` records every published cabinet file hash for served-file checks.

# Native Punch-Out publication

Punch-Out is a standalone, same-origin free-play cabinet at `/punch-out/index.html`.
`/punch-out` redirects there; the home card and footer provide discovery. It does
not participate in `ALL_GAMES`, daily seeds, scores, or streak accounting.

Canonical source: `C:/Users/grifm/OneDrive/Documents/ChatGPT/ASCII Punch Out/projects/ascii-punch-out/native`.
The source repository owns gameplay and controller changes. Do not edit generated
`public/punch-out` files directly.

After the native source handoff and commit, run from this repository:

```powershell
npm run punchout:sync -- --source "C:/Users/grifm/OneDrive/Documents/ChatGPT/ASCII Punch Out/projects/ascii-punch-out/native"
npm run punchout:check
```

Append `--dry-run` to the sync command to validate the source closure, transform,
provenance and byte budget without writing publication files.

The dependency-free sync starts at `app.mjs`, follows literal local module imports
and re-exports, and publishes only the explicit approved module names plus
`index.html` and `app.css`. A new browser module requires a reviewed allowlist
change in `scripts/punch-out-assets.mjs`. Missing, external, computed, and
unapproved imports fail. CSS dependencies and unexpected HTML references fail.
The HTML transform adds a visible Daily Arcade home link and points the cabinet
wordmark at `/punch-out/index.html`; an appended CSS rule uses the native accent
color and keyboard focus ring for the return link. No emulator, CLI, ROM, JSON save states,
prototype, or vendor directory is copied.

`public/punch-out/manifest.json` records the canonical native Git commit, whether
the native working tree was modified, and the SHA-256 and byte length of every
published game file. The manifest does not hash itself. The check command verifies
the complete import closure, exact directory contents, navigation, all hashes,
and a 64 MiB total publication budget with a 25 MiB limit per file. The total
includes the recovered fight, corner, result, title and ending text artwork;
compressed transfer size is measured at the release gate. Unexpected old files are never silently
deleted. Commit canonical changes before the final sync so provenance identifies
the reviewed source. Re-sync and re-check whenever canonical files change.

The full delivery goal is the native ASCII Punch-Out game with complete circuit,
result, loss/rematch, game-over and ending flows, controller-only play and
remapping, independent keyboard/touch input, and safe focus/disconnect handling.
Static publication audit alone does not establish those gameplay requirements.
Before release, run the repository typecheck, configured webpack production build,
and the affected public browser E2E flow (home → cabinet → controls → return).
Inspect the actual preview and production asset hashes, JavaScript MIME types,
same-origin route behavior and existing CSP. No iframe or CSP relaxation is
required. Do not run `predeploy`, unit or integration suites for this change.

Verification gaps remain until these release checks run against the final synced
source and hosted output. Real controller hardware and browser audio unlocking
require explicit evidence; simulated browser gamepads cannot verify physical
device compatibility. Deployment, commits and publication are coordinated by the
parent task after the native controller and gameplay handoffs.

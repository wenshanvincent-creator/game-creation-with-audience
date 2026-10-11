# Game Creation with Audience

A playable blocky-island browser sandbox built together with a Douyin audience.

Audience ideas are shortlisted for owner approval. Development changes are proposed through pull requests for owner review before merging.

## Day 1

Create a flat 3D island with sky, sunlight, a movable blocky character, and a following camera. Support desktop Chrome and touch controls.

Day 1 is playable with WASD or arrow keys. On a touch device, hold the on-screen arrows; the **Touch controls** button also makes them available on desktop. The camera follows the explorer, and the shoreline keeps their feet on the island.

## Run and review

Serve this directory with any static HTTP server, then open it in desktop Chrome. For example, in the cloud workspace:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

The local server address is for execution-environment testing. It is not a public playable preview. A public preview requires an approved static-hosting destination; opening `index.html` as a `file:` URL does not support the JavaScript modules.

There is no application build step, bundler, npm dependency, backend, analytics, account system, or saved state. The only external resource is three.js **0.170.0**, pinned in the import map in `index.html`. All world geometry is generated in `src/`.

## Verification

Movement and shoreline checks use Node's built-in test runner:

```sh
node --test tests/movement.test.mjs
```

With the static server running and Python Playwright plus Chromium available, the browser regression check verifies rendering, WASD and arrow movement, camera tracking, input release, viewport resizing, emulated touch, network requests, and load-failure messaging:

```sh
python3 tests/browser_check.py
```

Screenshots and a JSON report are written to `/tmp/day1-evidence` by default. `ISLAND_URL` and `ISLAND_ARTIFACTS` can change the test server and evidence directory. This cloud executor intercepts HTTPS with a certificate that its Chromium does not trust; `ISLAND_TEST_PROXY_CA=1` relaxes certificate checking **in the isolated test browser only**. Normal gameplay retains the browser's usual HTTPS checks.

Development stops at this starting world. Audience proposals need owner approval before further features are added.

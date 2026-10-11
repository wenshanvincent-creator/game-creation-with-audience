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

Screenshots and a JSON report are written to `/tmp/day1-evidence` by default. `ISLAND_URL` and `ISLAND_ARTIFACTS` can change the test server and evidence directory. Browser TLS validation remains enabled.

In this cloud executor, a normal Chromium CDN load fails with `net::ERR_CERT_AUTHORITY_INVALID`. The environment supplies a proxy CA to the system trust bundle, but that CA is absent from the existing browser NSS trust store. Browser trust settings have not been changed. The following isolated check uses a local response fixture downloaded with normal system TLS validation:

```sh
curl --fail https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js -o /tmp/three-0.170.0.module.js
ISLAND_TEST_THREE_CACHE=/tmp/three-0.170.0.module.js python3 tests/browser_check.py
```

Fixture mode verifies rendering and interaction with the exact dependency, but does **not** verify real CDN loading in the browser. A complete browser pass with normal CDN TLS validation remains blocked on the cloud browser's certificate configuration. The production app still uses the pinned CDN URL.

Development stops at this starting world. Audience proposals need owner approval before further features are added.

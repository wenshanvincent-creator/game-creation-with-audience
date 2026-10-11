"""Cloud browser regression check. Uses environment-provided Python Playwright.

Run with a static server serving the repository on port 8000:
  python3 tests/browser_check.py
Use ISLAND_URL for another server. ISLAND_TEST_THREE_CACHE can point to a
local three.js fixture for isolated interaction checks when real CDN browser
loading is blocked. This fixture mode is not a real CDN browser pass.
"""
import json
import math
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get('ISLAND_URL', 'http://127.0.0.1:8000/')
URL = BASE.rstrip('/') + '/?debug'
ARTIFACTS = Path(os.environ.get('ISLAND_ARTIFACTS', '/tmp/day1-evidence'))
ARTIFACTS.mkdir(parents=True, exist_ok=True)
CDN = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js'
CACHE = os.environ.get('ISLAND_TEST_THREE_CACHE')
errors, requests, checks = [], [], []


def snapshot(page):
    return page.evaluate('window.__island.snapshot()')


def distance(a, b):
    return math.dist(a['player'], b['player'])


def wait_for_movement(page, before):
    # Software WebGL frame rate varies; wait for movement rather than wall time.
    page.wait_for_function('''start => {
        const current = window.__island.snapshot().player;
        return Math.hypot(current[0] - start[0], current[2] - start[2]) > 0.8;
    }''', arg=before['player'], timeout=15000)


def load(page):
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
    page.on('request', lambda request: requests.append(request.url))
    page.goto(URL, wait_until='networkidle')
    page.wait_for_function('window.__island !== undefined')
    assert not page.locator('#status').is_visible()


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=[
        '--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    ])
    desktop = browser.new_context(viewport={'width': 1440, 'height': 900})
    if CACHE:
        desktop.route(CDN, lambda route: route.fulfill(path=CACHE, content_type='application/javascript'))
    page = desktop.new_page()
    load(page)
    assert not page.locator('#touch-controls').is_visible()
    assert snapshot(page)['tiles'] == 197
    page.screenshot(path=str(ARTIFACTS / 'desktop.png'))
    checks.append('Desktop page loads and renders the 3D island')

    for key, direction in [('w', (-1, -1)), ('a', (-1, 1)), ('s', (1, 1)), ('d', (1, -1))]:
        before = snapshot(page)
        page.keyboard.down(key)
        wait_for_movement(page, before)
        page.keyboard.up(key)
        after = snapshot(page)
        assert distance(before, after) > 0.6, (key, before, after)
        for index, sign in [(0, direction[0]), (2, direction[1])]:
            assert (after['player'][index] - before['player'][index]) * sign > 0
    checks.append('All four WASD directions move relative to the camera')

    before = snapshot(page)
    page.keyboard.down('ArrowUp')
    wait_for_movement(page, before)
    page.keyboard.up('ArrowUp')
    after = snapshot(page)
    assert distance(before, after) > 0.6
    page.wait_for_function('''() => {
        const s = window.__island.snapshot();
        return [21, 14.9, 30].every((offset, axis) => Math.abs(s.camera[axis] - s.player[axis] - offset) < 0.18);
    }''', timeout=15000)
    still = snapshot(page)
    assert distance(after, still) < 0.001
    for axis, expected in enumerate([21, 14.9, 30]):
        assert abs(still['camera'][axis] - still['player'][axis] - expected) < 0.18
    vector = [still['target'][i] - still['camera'][i] for i in range(3)]
    length = math.sqrt(sum(v * v for v in vector))
    assert math.dist([v / length for v in vector], still['cameraDirection']) < 0.001
    checks.append('Arrow keys work; key release stops movement; camera follows and looks at player')

    page.keyboard.down('w')
    page.wait_for_timeout(300)
    page.evaluate("window.dispatchEvent(new Event('blur'))")
    released = snapshot(page)
    page.wait_for_timeout(400)
    assert distance(released, snapshot(page)) < 0.001
    page.keyboard.up('w')
    checks.append('Focus loss clears held movement')

    page.locator('#touch-toggle').click()
    button = page.locator('[data-direction="forward"]')
    bounds = button.bounding_box()
    before = snapshot(page)
    page.mouse.move(bounds['x'] + bounds['width'] / 2, bounds['y'] + bounds['height'] / 2)
    page.mouse.down()
    wait_for_movement(page, before)
    page.mouse.move(20, 400)
    page.mouse.up()
    after = snapshot(page)
    assert distance(before, after) > 0.5
    page.wait_for_timeout(400)
    assert distance(after, snapshot(page)) < 0.001
    checks.append('On-screen controls move and release outside the button without stuck input')

    page.set_viewport_size({'width': 1000, 'height': 600})
    page.wait_for_function("document.querySelector('canvas').width === 1000")
    assert page.locator('canvas').evaluate('(canvas) => canvas.width') == 1000
    checks.append('Canvas resizes with the browser')

    mobile = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True,
                                 is_mobile=True, device_scale_factor=1)
    if CACHE:
        mobile.route(CDN, lambda route: route.fulfill(path=CACHE, content_type='application/javascript'))
    phone = mobile.new_page()
    load(phone)
    assert phone.locator('#touch-controls').is_visible()
    assert phone.evaluate('document.documentElement.scrollWidth <= innerWidth')
    phone.screenshot(path=str(ARTIFACTS / 'touch-portrait.png'))
    cdp = mobile.new_cdp_session(phone)
    bounds = phone.locator('[data-direction="forward"]').bounding_box()
    point = {'x': bounds['x'] + bounds['width'] / 2, 'y': bounds['y'] + bounds['height'] / 2, 'id': 1}
    before = snapshot(phone)
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [point]})
    wait_for_movement(phone, before)
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
    after = snapshot(phone)
    assert distance(before, after) > 0.6
    phone.wait_for_timeout(350)
    assert distance(after, snapshot(phone)) < 0.001
    checks.append('Real emulated touch moves and releases on a portrait phone')
    phone.set_viewport_size({'width': 844, 'height': 390})
    phone.wait_for_function("document.querySelector('canvas').width === 844")
    assert phone.locator('[data-direction="forward"]').bounding_box()['y'] > 0
    phone.screenshot(path=str(ARTIFACTS / 'touch-landscape.png'))
    checks.append('Touch controls remain visible in landscape')

    external = sorted({url for url in requests if not url.startswith(BASE)})
    assert external == [CDN], external
    assert not errors, errors
    checks.append('No console/page errors; exact pinned three.js is the only external URL requested')

    failure = desktop.new_page()
    failure.route(CDN, lambda route: route.abort())
    failure.goto(BASE, wait_until='networkidle')
    failure.wait_for_function("document.querySelector('#status').textContent.includes('couldn’t load')")
    assert failure.locator('#status').is_visible()
    checks.append('A failed CDN load displays a useful recovery message')

    production = desktop.new_page()
    production.goto(BASE, wait_until='networkidle')
    production.wait_for_selector('canvas')
    assert production.evaluate('window.__island === undefined')
    checks.append('Debug diagnostics are absent during normal play')
    result = {'browser': browser.version, 'tls_validation': 'normal',
              'dependency_mode': 'local response fixture; not a real CDN browser pass' if CACHE else 'real CDN',
              'checks': checks,
              'errors': errors, 'external_requests': external, 'final_desktop_state': still}
    (ARTIFACTS / 'verification.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))
    browser.close()

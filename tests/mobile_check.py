"""Chromium mobile-emulation checks; not physical iOS/Android validation.

Run alongside the static server used by browser_check.py. The same ISLAND_URL,
ISLAND_TEST_THREE_CACHE and ISLAND_ARTIFACTS environment variables apply.
"""
import json
import math
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get('ISLAND_URL', 'http://127.0.0.1:8000/').rstrip('/') + '/?debug'
CACHE = os.environ.get('ISLAND_TEST_THREE_CACHE')
OUT = Path(os.environ.get('ISLAND_ARTIFACTS', '/tmp/mobile-evidence'))
OUT.mkdir(parents=True, exist_ok=True)
CDN = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js'
checks, layouts, contrasts, errors = [], [], [], []
STYLE = '''() => {
  const selectors = ['h1', '.subtitle', '#control-hint', '.instructions strong',
    '#time-label', '#time-clock', '[data-direction="jump"]', '[data-time="day"]', '#cycle-toggle'];
  return selectors.filter(s => document.querySelector(s).getClientRects().length).map(selector => {
    const e = document.querySelector(selector), s = getComputedStyle(e);
    let parent = e, bg;
    while (parent) {
      bg = getComputedStyle(parent).backgroundColor;
      if (bg.startsWith('rgb(')) break;
      parent = parent.parentElement;
    }
    return {selector, color: s.color, background: bg, opacity: s.opacity,
      appearance: s.appearance};
  });
}'''


def luminance(color):
    values = [float(x) / 255 for x in color.removeprefix('rgb(').removesuffix(')').split(',')]
    linear = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in values]
    return sum(v * weight for v, weight in zip(linear, [.2126, .7152, .0722]))


def contrast(page, label):
    values = page.evaluate(STYLE)
    for value in values:
        assert value['background'].startswith('rgb('), (label, value)
        a, b = sorted([luminance(value['color']), luminance(value['background'])])
        value['ratio'] = (b + .05) / (a + .05)
        assert value['ratio'] >= 4.5 and value['opacity'] == '1', (label, value)
    contrasts.append({'state': label, 'values': values})


def snap(page):
    return page.evaluate('window.__island.snapshot()')


def point(page, direction, ident):
    b = page.locator('[data-direction="' + direction + '"]').bounding_box()
    return {'x': b['x'] + b['width'] / 2, 'y': b['y'] + b['height'] / 2, 'id': ident}


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=[
        '--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    for scheme in ['light', 'dark']:
        context = browser.new_context(viewport={'width': 390, 'height': 844},
            is_mobile=True, has_touch=True, color_scheme=scheme, device_scale_factor=1)
        if CACHE:
            context.route(CDN, lambda route: route.fulfill(path=CACHE, content_type='application/javascript'))
        page = context.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.goto(URL, wait_until='networkidle')
        page.wait_for_function('window.__island !== undefined')
        for theme in ['day', 'sunset', 'night']:
            page.locator('[data-time="' + theme + '"]').tap()
            page.wait_for_function('(theme) => document.querySelector(`[data-time="${theme}"]`).getAttribute("aria-pressed") === "true"', arg=theme)
            page.wait_for_function('(theme) => theme !== "night" || window.__island.snapshot().lighting.starsOpacity === 1', arg=theme)
            contrast(page, scheme + '-' + theme)
            if scheme == 'light':
                page.screenshot(path=str(OUT / ('after-portrait-' + theme + '.png')))
        # Cross the real dusk threshold during automatic cycling.
        page.locator('[data-time="sunset"]').tap()
        page.locator('#cycle-toggle').tap()
        page.wait_for_function('document.body.dataset.night === "true"', timeout=15000)
        contrast(page, scheme + '-auto-dusk')
        page.locator('#cycle-toggle').tap()
        checks.append(scheme + ' preference: day/sunset/night and automatic dusk text contrast >= 4.5:1')
        if scheme == 'dark':
            context.close()
            continue
        for width, height in [(320, 480), (320, 568), (360, 640), (390, 844),
                              (568, 320), (640, 360), (667, 375), (844, 390)]:
            page.set_viewport_size({'width': width, 'height': height})
            page.wait_for_function('width => document.querySelector("canvas").width === width', arg=width)
            result = page.evaluate('''() => {
              const all = [...document.querySelectorAll('button')].filter(e => e.getClientRects().length);
              const rects = all.map(e => ({label:e.textContent, ...e.getBoundingClientRect().toJSON(),
                hit:e.contains(document.elementFromPoint(e.getBoundingClientRect().x + e.offsetWidth/2, e.getBoundingClientRect().y + e.offsetHeight/2))}));
              return {width:innerWidth,height:innerHeight,scale:visualViewport.scale,scroll:[scrollX,scrollY],
                scrollWidth:document.documentElement.scrollWidth,rects};
            }''')
            for r in result['rects']:
                assert r['width'] >= 44 and r['height'] >= 44, (width, height, r)
                assert r['x'] >= 0 and r['y'] >= 0 and r['right'] <= width and r['bottom'] <= height, r
                assert r['hit'], (width, height, r)
            for i, a in enumerate(result['rects']):
                for b in result['rects'][i+1:]:
                    assert not (a['x'] < b['right'] and a['right'] > b['x'] and a['y'] < b['bottom'] and a['bottom'] > b['y']), (width, height, a, b)
            assert result['scrollWidth'] <= width and result['scroll'] == [0, 0] and result['scale'] == 1
            layouts.append(result)
            if width in [320, 568, 640]:
                page.screenshot(path=str(OUT / f'after-{width}x{height}.png'))
        checks.append('Eight small portrait/landscape sizes: all targets >=44px, visible, hittable and non-overlapping; no scroll/zoom')
        # Simulated safe-area variables, not a physical notched-screen test.
        for width, height, insets in [(390,844,[47,0,34,0]),(568,320,[0,44,21,44])]:
            page.set_viewport_size({'width':width,'height':height})
            page.evaluate('''insets => ['top','right','bottom','left'].forEach((side,i) =>
              document.documentElement.style.setProperty('--safe-'+side, insets[i]+'px'))''', insets)
            bounds = page.locator('button:visible').evaluate_all('(buttons) => buttons.map(e => e.getBoundingClientRect().toJSON())')
            for b in bounds:
                assert b['x'] >= insets[3] and b['right'] <= width-insets[1] and b['y'] >= insets[0] and b['bottom'] <= height-insets[2], b
            page.screenshot(path=str(OUT / f'after-safe-{width}x{height}.png'))
        checks.append('Simulated portrait and landscape safe-area insets keep buttons inside usable bounds')
        page.evaluate("['top','right','bottom','left'].forEach(side => document.documentElement.style.removeProperty('--safe-'+side))")
        page.set_viewport_size({'width':390,'height':844})
        cdp = context.new_cdp_session(page)
        send = lambda kind, points: cdp.send('Input.dispatchTouchEvent', {'type':kind,'touchPoints':points})
        forward, jump = point(page,'forward',1), point(page,'jump',2)
        before = snap(page)
        send('touchStart',[forward,jump])
        page.wait_for_function('window.__island.snapshot().player[1] > .3')
        assert math.dist(before['player'],snap(page)['player']) > .3
        # CDP touchEnd lists the fingers being released, not those remaining.
        send('touchEnd',[jump])
        moving = snap(page)['player']
        page.wait_for_function('start => Math.hypot(...[0,2].map(i => window.__island.snapshot().player[i]-start[i])) > .3',arg=moving)
        send('touchEnd',[])
        page.wait_for_function('window.__island.snapshot().jump.grounded')
        checks.append('Simultaneous real emulated move+jump and partial finger release preserve movement')
        send('touchStart',[point(page,'jump',3)])
        page.wait_for_function('window.__island.snapshot().player[1] > .3')
        page.wait_for_function('window.__island.snapshot().jump.grounded')
        page.wait_for_timeout(500)
        assert snap(page)['player'][1] == 0
        contrast(page,'held-jump')
        send('touchEnd',[])
        for release in ['cancel','blur','pagehide','rotate']:
            send('touchStart',[point(page,'forward',4)])
            page.wait_for_timeout(300)
            assert page.locator('.held').count() == 1
            if release == 'cancel': send('touchCancel',[])
            elif release == 'rotate': page.set_viewport_size({'width':844,'height':390})
            else: page.evaluate('name => window.dispatchEvent(new Event(name))', release)
            page.wait_for_function('document.querySelectorAll(".held").length === 0', timeout=5000)
            stopped = snap(page)['player']
            page.wait_for_timeout(400)
            assert math.dist(stopped,snap(page)['player']) < .001
            if release != 'cancel': send('touchCancel',[])
        checks.append('Held Jump does not bounce; touch cancel, blur, pagehide and rotation stop movement and clear pressed states')
        page.keyboard.press('Tab')
        page.locator('[data-direction="jump"]').focus()
        focus = page.locator('[data-direction="jump"]').evaluate('(e) => ({style:getComputedStyle(e).outlineStyle,width:getComputedStyle(e).outlineWidth})')
        assert focus == {'style':'solid','width':'3px'}, focus
        checks.append('Keyboard focus has a visible 3px outline')
        assert page.locator('canvas').evaluate('(e) => getComputedStyle(e).touchAction') == 'none'
        # Two fingers on the world cannot turn movement into a page gesture.
        send('touchStart',[{'x':200,'y':180,'id':5},{'x':260,'y':180,'id':6}])
        send('touchMove',[{'x':160,'y':180,'id':5},{'x':300,'y':180,'id':6}])
        send('touchEnd',[])
        assert page.evaluate('visualViewport.scale === 1 && scrollX === 0 && scrollY === 0')
        checks.append('World canvas consumes touch gestures without page scroll/pinch zoom; browser zoom remains enabled')
        assert snap(page)['drawCalls'] < 60 and snap(page)['tiles'] == 197
        checks.append('Island still renders 197 tiles with fewer than 60 draw calls')
        context.close()
    assert not errors, errors
    result = {'browser':browser.version,'scope':'Chromium emulation; no physical iOS Safari/Android hardware test',
      'tls_validation':'normal','dependency_mode':'local three.js response fixture; not a real CDN browser pass' if CACHE else 'real CDN',
      'checks':checks,'errors':errors,'layouts':layouts,'contrast':contrasts}
    (OUT / 'mobile-verification.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'checks':checks,'errors':errors},indent=2))
    browser.close()

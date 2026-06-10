// TARGETED BUG-PROBE — 3 specific behaviors, proven at runtime.
import { chromium } from 'playwright'

const CTRL = 'http://localhost:9001'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } })

  // ---------- PROBE 3 instrumentation: wrap WebSocket BEFORE any app code ----------
  await ctx.addInitScript(() => {
    const RealWS = window.WebSocket
    window.__wsLog = []
    const t0 = performance.now()
    function WrappedWS(url, protocols) {
      const ws = protocols ? new RealWS(url, protocols) : new RealWS(url)
      const rec = { url, createdAt: performance.now() - t0, ref: ws }
      window.__wsLog.push(rec)
      return ws
    }
    WrappedWS.prototype = RealWS.prototype
    WrappedWS.CONNECTING = RealWS.CONNECTING
    WrappedWS.OPEN = RealWS.OPEN
    WrappedWS.CLOSING = RealWS.CLOSING
    WrappedWS.CLOSED = RealWS.CLOSED
    window.WebSocket = WrappedWS
  })

  const page = await ctx.newPage()
  const consoleErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message))

  await page.goto(CTRL)
  await page.waitForSelector('[data-testid="script-input"]')
  await sleep(700)

  // ========================================================================
  // PROBE 1 — parser: heading immediately followed by text, no blank line
  // ========================================================================
  await page.fill('[data-testid="script-input"]', '# Intro\nuno\n\n# Body\ndois')
  await sleep(300)
  const segTexts = await page.$$eval('[data-testid="segment"]', (els) =>
    els.map((e) => e.textContent.trim()),
  )
  const secLabels = await page.$$eval('[data-testid="segment-section"]', (els) =>
    els.map((e) => e.textContent.trim()),
  )
  const p1ok =
    segTexts.length === 2 &&
    secLabels.length === 2 &&
    segTexts[0] === 'uno' &&
    segTexts[1] === 'dois' &&
    secLabels[0] === 'Intro' &&
    secLabels[1] === 'Body'
  console.log(`PROBE 1 PARSER: ${p1ok ? 'PASS' : 'FAIL'}`)
  console.log(`   segments(${segTexts.length})=${JSON.stringify(segTexts)} sections(${secLabels.length})=${JSON.stringify(secLabels)}`)

  // ========================================================================
  // PROBE 2 — Space double-toggle after a mouse-click on Play
  // ========================================================================
  // restore a multi-word script so the index can advance
  await page.fill('[data-testid="script-input"]', '# Intro\numa duas tres quatro cinco seis sete oito nove dez once doze')
  await sleep(200)
  await page.locator('[data-testid="start-presenting"]').click()
  await page.waitForSelector('[data-testid="play-toggle"]')
  await page.locator('[data-testid="countdown-option"]', { hasText: '1s' }).first().click()
  await sleep(150)
  // MOUSE-click Play -> starts 1s countdown, then plays. Button is now focused.
  await page.locator('[data-testid="play-toggle"]').click()
  await sleep(1900) // countdown(1s) + a little playback
  const labelAfterPlay = (await page.textContent('[data-testid="play-toggle"]')).trim()
  const idxPlaying = await page.evaluate(() => {
    const el = document.querySelector('.word-active')
    return el ? Number(el.getAttribute('data-word-index')) : null
  })
  await sleep(500)
  const idxPlaying2 = await page.evaluate(() => {
    const el = document.querySelector('.word-active')
    return el ? Number(el.getAttribute('data-word-index')) : null
  })
  const wasPlaying = labelAfterPlay.includes('Pause') && idxPlaying2 !== null && idxPlaying2 >= idxPlaying

  // Now press Space EXACTLY ONCE. Button is focused from the mouse click.
  await page.keyboard.press('Space')
  await sleep(700)
  const labelAfterSpace = (await page.textContent('[data-testid="play-toggle"]')).trim()
  const idxAfterSpaceA = await page.evaluate(() => {
    const el = document.querySelector('.word-active')
    return el ? Number(el.getAttribute('data-word-index')) : null
  })
  await sleep(700)
  const idxAfterSpaceB = await page.evaluate(() => {
    const el = document.querySelector('.word-active')
    return el ? Number(el.getAttribute('data-word-index')) : null
  })
  // Exactly one toggle: Pause -> Play, and the index froze (no longer advancing).
  const toggledOnce = labelAfterSpace.includes('Play') && idxAfterSpaceA === idxAfterSpaceB
  const p2ok = wasPlaying && toggledOnce
  console.log(`PROBE 2 SPACE DOUBLE-TOGGLE: ${p2ok ? 'PASS' : 'FAIL'}`)
  console.log(`   afterPlay label=${JSON.stringify(labelAfterPlay)} idx ${idxPlaying}->${idxPlaying2} (playing=${wasPlaying})`)
  console.log(`   afterSpace label=${JSON.stringify(labelAfterSpace)} idx frozen ${idxAfterSpaceA}==${idxAfterSpaceB} (toggledOnce=${toggledOnce})`)

  // ========================================================================
  // PROBE 3 — exactly ONE live WebSocket, no stray reconnect (StrictMode)
  // ========================================================================
  // we've been on the page ~5s+ already; sample WS log over a quiet window
  // Count ONLY the app's backend socket (:9000/ws). The dev server's own Vite
  // HMR WebSocket (ws://...:9001/?token=...) is unrelated infrastructure and
  // must be excluded — counting it is a false positive.
  const sample = () =>
    page.evaluate(() =>
      (window.__wsLog || [])
        .filter((r) => /:9000\/ws/.test(r.url))
        .map((r) => ({ createdAt: Math.round(r.createdAt), readyState: r.ref.readyState })),
    )
  const wsReport = await sample()
  await sleep(2500)
  const wsReport2 = await sample()
  const totalCreated = wsReport2.length
  const openNow = wsReport2.filter((r) => r.readyState === 1).length
  const closedNow = wsReport2.filter((r) => r.readyState === 3).length
  // any app socket created AFTER the initial double-mount window (>2000ms) = spurious reconnect
  const lateCreations = wsReport2.filter((r) => r.createdAt > 2000).length
  // no growth between the two samples (stable, no reconnect churn)
  const grewBetweenSamples = wsReport2.length - wsReport.length
  const p3ok = openNow === 1 && lateCreations === 0 && grewBetweenSamples === 0
  console.log(`PROBE 3 WS RECONNECT: ${p3ok ? 'PASS' : 'FAIL'}`)
  console.log(`   app sockets(:9000/ws) created=${totalCreated} open=${openNow} closed=${closedNow} lateReconnects=${lateCreations} growthBetweenSamples=${grewBetweenSamples}`)
  console.log(`   timeline=${JSON.stringify(wsReport2)}`)

  console.log(`\n   (console errors during probe: ${consoleErrors.length})`)
  if (consoleErrors.length) console.log('   ' + consoleErrors.slice(0, 5).join('\n   '))

  await browser.close()
  const allPass = p1ok && p2ok && p3ok
  console.log(`\n${'='.repeat(50)}\nPROBE RESULT: ${allPass ? 'ALL PASS' : 'HAS FAILURES'}`)
  process.exit(allPass ? 0 : 1)
}

main().catch((e) => { console.error('probe crashed', e); process.exit(2) })

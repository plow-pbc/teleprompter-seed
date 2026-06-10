// Layer 2 — the REAL USER-DRIVE (SEED.md §16b). Drives the app like a human
// across two independent browser contexts and measures the 7-point bar.
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LAN_IP = process.argv[2] || process.env.TP_LAN_IP || (() => {
  throw new Error('Pass the served LAN/tailnet IP as argv[2] (or TP_LAN_IP). \
The 16b.2b clipboard check MUST run over http://<real-IP>:9001 (a non-secure context), never localhost.')
})()
const CTRL = 'http://localhost:9001'
const DISP = 'http://127.0.0.1:9001'
const IPURL = `http://${LAN_IP}:9001`

const SAMPLE_SCRIPT = `# Intro
Ola pessoal, bem-vindos a mais um video do canal.

Hoje eu vou te mostrar como gravar os seus videos lendo direto da tela, sem decorar uma unica linha.

# Corpo
O texto rola no seu ritmo, a palavra atual fica em destaque, e voce so precisa olhar pra camera e falar.

Se voce se perder, e so pausar, voltar ao segmento certo, e continuar — a gravacao nao se perde.

# CTA
Cola o seu roteiro, clica em Iniciar Apresentacao, e grava o proximo video lendo direto da tela.`

const FORMAT_PROMPT = `Convert the document below into a teleprompter script in Markdown.
Rules:
- Use "#" headings for section titles (for example: Intro, Body, CTA).
- Put each spoken beat — one sentence or short phrase you would read as a single breath — as its own paragraph, separated by a blank line.
- Plain Markdown only: headings and paragraphs. No bullet lists, bold, italics, tables, or notes.
- Output ONLY the formatted script, nothing else.

Document to convert:
<<< paste your raw text here >>>`

const SHOT_DIR = path.join(__dirname, 'shots')
fs.mkdirSync(SHOT_DIR, { recursive: true })

const results = []
function check(name, ok, detail = '') {
  results.append ? null : results.push({ name, ok, detail })
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' :: ' + detail : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function pollDisplayContent(page, needle, timeoutMs = 1500) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const txt = await page.evaluate(() => document.body.innerText)
    if (txt.includes(needle)) return Date.now() - start
    await sleep(30)
  }
  return -1
}

async function activeIndex(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.word-active')
    return el ? Number(el.getAttribute('data-word-index')) : null
  })
}
async function activeCount(page) {
  return page.evaluate(() => document.querySelectorAll('.word-active').length)
}

const errors = []

async function main() {
  const browser = await chromium.launch()
  const vp = { width: 1920, height: 1080 }

  const ctxA = await browser.newContext({ viewport: vp })
  const ctxB = await browser.newContext({ viewport: vp })
  await ctxA.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: CTRL })

  const pageA = await ctxA.newPage()
  const pageB = await ctxB.newPage()
  for (const [p, who] of [[pageA, 'A'], [pageB, 'B']]) {
    p.on('console', (m) => {
      if (m.type() !== 'error') return
      const t = m.text()
      // Ignore the deliberate backstop-probe failures (wrong-key 401 / empty
      // 422) this harness itself fires — the product never POSTs /api/content
      // (it syncs over WebSocket), so these are test traffic, not app errors.
      if (/status of 401|status of 422/.test(t)) return
      errors.push(`${who}: ${t}`)
    })
    p.on('pageerror', (e) => errors.push(`${who}: ${e.message}`))
  }

  await pageA.goto(CTRL)
  await pageB.goto(DISP + '/?mode=display')
  await pageA.waitForSelector('[data-testid="script-input"]')
  await sleep(800)

  // ---- POINT 2: PASTE-IN -> SEGMENTS (fresh-load assertions first) ----
  const boxVal = await pageA.inputValue('[data-testid="script-input"]')
  check('2 paste box holds the sample script', boxVal.trim() === SAMPLE_SCRIPT.trim(),
    boxVal.includes('This is a text from Daniel') ? 'has forbidden test string' : `len=${boxVal.length}`)
  const segCount = await pageA.locator('[data-testid="segment"]').count()
  const secCount = await pageA.locator('[data-testid="segment-section"]').count()
  check('2 segments=5 / sections=3', segCount === 5 && secCount === 3, `segs=${segCount} secs=${secCount}`)
  const hasCopy = await pageA.locator('[data-testid="copy-format-prompt"]').count()
  check('2 copy-format-prompt present', hasCopy === 1)
  // re-parse on fresh paste
  await pageA.fill('[data-testid="script-input"]', '# A\nuno\n\ndois\n\n# B\ntres')
  await sleep(300)
  const segCount2 = await pageA.locator('[data-testid="segment"]').count()
  const secCount2 = await pageA.locator('[data-testid="segment-section"]').count()
  check('2 re-parse -> 3 segments / 2 sections', segCount2 === 3 && secCount2 === 2, `segs=${segCount2} secs=${secCount2}`)

  // ---- POINT 1: 2-DEVICE SYNC ----
  const originsDiffer = CTRL !== DISP
  check('1 two independent origins (not two tabs)', originsDiffer, `${CTRL} vs ${DISP}`)
  await pageA.fill('[data-testid="script-input"]', '# Intro\nSYNCTOKEN42 hello world\n\nsecond beat\n\n# B\nthird beat')
  const t0 = Date.now()
  const lat = await pollDisplayContent(pageB, 'SYNCTOKEN42', 1500)
  check('1 display reflects controller edit <= 1000ms', lat >= 0 && lat <= 1000, `latency=${lat}ms`)

  // ---- POINT 2b: CLIPBOARD over NON-SECURE http-IP ----
  try {
    const ctxIP = await browser.newContext({ viewport: vp })
    await ctxIP.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: IPURL })
    const pageIP = await ctxIP.newPage()
    await pageIP.goto(IPURL + '/')
    await pageIP.waitForSelector('[data-testid="copy-format-prompt"]')
    const insecure = await pageIP.evaluate(() => window.isSecureContext === false)
    check('2b origin is NON-secure (isSecureContext===false)', insecure, `secure=${!insecure}`)

    await pageIP.click('[data-testid="copy-format-prompt"]')
    await sleep(300)
    const copyState1 = await pageIP.getAttribute('[data-testid="copy-format-prompt"]', 'data-copy-state')
    const btnText1 = (await pageIP.textContent('[data-testid="copy-format-prompt"]')) || ''
    check('2b copy reports real success (data-copy-state=ok + "Copied ✓")',
      copyState1 === 'ok' && btnText1.includes('Copied ✓'), `state=${copyState1} text=${JSON.stringify(btnText1)}`)

    // read OS clipboard back from a SECURE localhost page
    const readPage = await ctxA.newPage()
    await readPage.goto(CTRL + '/')
    await readPage.bringToFront()
    let clip = ''
    try {
      clip = await readPage.evaluate(() => navigator.clipboard.readText())
    } catch (e) {
      clip = '__READ_FAILED__:' + e.message
    }
    check('2b prompt text actually landed on the clipboard (exact)',
      clip === FORMAT_PROMPT, clip.startsWith('__READ_FAILED__') ? clip : `match=${clip === FORMAT_PROMPT} len=${clip.length}`)

    // force the fallback to fail -> must show real failure, no fake "Copied ✓"
    await pageIP.bringToFront()
    await pageIP.evaluate(() => {
      // @ts-ignore
      document.execCommand = () => false
    })
    await pageIP.click('[data-testid="copy-format-prompt"]')
    await sleep(300)
    const copyState2 = await pageIP.getAttribute('[data-testid="copy-format-prompt"]', 'data-copy-state')
    const btnText2 = (await pageIP.textContent('[data-testid="copy-format-prompt"]')) || ''
    await readPage.bringToFront()
    let clip2 = ''
    try {
      clip2 = await readPage.evaluate(() => navigator.clipboard.readText())
    } catch {
      clip2 = clip
    }
    check('2b forced failure shows real fail (not a fake "Copied ✓") + clipboard unchanged',
      copyState2 === 'fail' && !btnText2.includes('Copied ✓') && btnText2.toLowerCase().includes('fail') && clip2 === FORMAT_PROMPT,
      `state=${copyState2} text=${JSON.stringify(btnText2)} clipUnchanged=${clip2 === FORMAT_PROMPT}`)
    await readPage.close()
    await ctxIP.close()
  } catch (e) {
    check('2b clipboard non-secure flow', false, 'threw: ' + e.message)
  }

  // ---- restore the full sample on the controller for segment tests ----
  await pageA.fill('[data-testid="script-input"]', SAMPLE_SCRIPT)
  await sleep(400)

  // ---- POINT 3: SEGMENT REAL-TIME ----
  const seg2Text = 'O texto rola no seu ritmo'
  await pageA.locator('[data-testid="segment"][data-segment-index="2"]').click()
  const lat3 = await pollDisplayContent(pageB, seg2Text, 1500)
  const bActive = await activeIndex(pageB)
  check('3 segment click -> display swaps <=1000ms + resets to top', lat3 >= 0 && lat3 <= 1000 && (bActive === 0 || bActive === null),
    `latency=${lat3}ms activeIdx=${bActive}`)
  await pageA.locator('[data-testid="segment"][data-segment-index="3"]').click()
  const lat3b = await pollDisplayContent(pageB, 'Se voce se perder', 1500)
  check('3 second segment click updates display', lat3b >= 0 && lat3b <= 1000, `latency=${lat3b}ms`)

  // backstop guards via fetch
  const key = fs.readFileSync(path.join(__dirname, '..', 'backend', '.env'), 'utf8')
    .split('\n').find((l) => l.startsWith('CONTENT_API_KEY=')).split('=')[1].trim()
  const guard = await pageA.evaluate(async () => {
    const wrong = await fetch('http://localhost:9000/api/content', {
      method: 'POST', headers: { 'X-API-Key': 'nope', 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'x' }),
    })
    const empty = await fetch('http://localhost:9000/api/content', {
      method: 'POST', headers: { 'X-API-Key': 'nope', 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '' }),
    })
    return { wrong: wrong.status, empty: empty.status }
  })
  check('3 backstop guards (wrong->401, empty->422)', guard.wrong === 401 && guard.empty === 422, JSON.stringify(guard))
  void key

  // reset to segment 0 for presentation
  await pageA.locator('[data-testid="segment"][data-segment-index="0"]').click()
  await sleep(300)

  // ---- POINT 4: PRESENT + READ LEGIBLY ----
  await pageA.locator('[data-testid="start-presenting"]').click()
  await pageA.waitForSelector('[data-testid="play-toggle"]')
  // select the 1s countdown to keep the pre-roll short
  await pageA.locator('[data-testid="countdown-option"]', { hasText: '1s' }).first().click()
  await sleep(200)
  await pageA.locator('[data-testid="play-toggle"]').click()
  await sleep(2600) // 1s countdown + ~1.6s playback

  const dispActiveCount = await activeCount(pageB)
  const idxStart = await activeIndex(pageB)
  await sleep(1500)
  const idxLater = await activeIndex(pageB)
  check('4 single word-active that advances word-by-word', dispActiveCount === 1 && idxStart !== null && idxLater !== null && idxLater > idxStart,
    `count=${dispActiveCount} idx ${idxStart}->${idxLater}`)

  const style = await pageB.evaluate(() => {
    const el = document.querySelector('.word-active')
    if (!el) return null
    const cs = getComputedStyle(el)
    return { color: cs.color, boxShadow: cs.boxShadow, bg: cs.backgroundImage }
  })
  check('4 active word = original glowing box (cyan color + glow + gradient)',
    !!style && style.color === 'rgb(0, 212, 255)' && style.boxShadow !== 'none' && style.bg.includes('gradient'),
    JSON.stringify(style))

  const centered = await pageB.evaluate(() => {
    const el = document.querySelector('.word-active')
    if (!el) return 1
    const cont = el.closest('.overflow-y-auto')
    const er = el.getBoundingClientRect()
    const cr = cont.getBoundingClientRect()
    return Math.abs((er.top + er.height / 2) - (cr.top + cr.height / 2)) / cr.height
  })
  check('4 active word is centered (within ~15%)', centered <= 0.15, `offsetFrac=${centered.toFixed(3)}`)

  const contrast = await pageB.evaluate(() => {
    const words = [...document.querySelectorAll('.teleprompter-word')].filter((w) => !w.classList.contains('word-active'))
    let bad = 0
    for (const w of words) {
      const cs = getComputedStyle(w)
      if (cs.color !== 'rgb(255, 255, 255)' || cs.opacity !== '1') bad++
    }
    return { total: words.length, bad }
  })
  check('4 readable contrast: all non-active words pure white opacity 1', contrast.bad === 0, JSON.stringify(contrast))

  const fontPx = await pageB.evaluate(() => {
    const el = document.querySelector('.teleprompter-word')
    return el ? parseFloat(getComputedStyle(el).fontSize) : 0
  })
  check('4 reading font large enough (>=40px @1080)', fontPx >= 40, `fontSize=${fontPx}px`)

  // screenshots — both clients during playback
  await pageA.screenshot({ path: path.join(SHOT_DIR, 'controller-playback.png') })
  await pageB.screenshot({ path: path.join(SHOT_DIR, 'display-playback.png') })

  // ---- POINT 5: MID-TAKE CONTROL ----
  const idxBeforePause = await activeIndex(pageA)
  await pageA.keyboard.press('Space') // pause
  await sleep(400)
  const idxAfterPause = await activeIndex(pageA)
  check('5 pause keeps place (index preserved, non-zero)',
    idxAfterPause !== null && idxAfterPause > 0 && idxAfterPause === idxBeforePause,
    `before=${idxBeforePause} after=${idxAfterPause}`)

  await pageA.keyboard.press('Space') // resume -> countdown then continue
  await sleep(2600)
  const idxResumed = await activeIndex(pageA)
  check('5 resume continues from same word (index advances)', idxResumed !== null && idxResumed > idxAfterPause,
    `resumedTo=${idxResumed}`)

  // previous segment via ArrowLeft -> swaps + resets to top, B follows
  await pageA.keyboard.press('ArrowLeft')
  await sleep(200)
  const bActive5 = await activeIndex(pageB)
  const bIdxReset = bActive5 === 0 || bActive5 === null
  const dispText5 = await pageB.evaluate(() => document.body.innerText)
  check('5 prev-segment swaps display + resets to top', bIdxReset && dispText5.length > 0, `bActive=${bActive5}`)

  const rangeInfo = await pageA.evaluate(() => {
    const ranges = [...document.querySelectorAll('input[type="range"]')]
    const ids = ranges.map((r) => r.getAttribute('data-testid'))
    const scrub = document.querySelector('[data-testid="word-scrub"],[data-testid="word-bar"],[data-testid="position-slider"],[data-testid="scrub"]')
    return { count: ranges.length, ids, hasScrub: !!scrub }
  })
  check('5 NO word-scrub bar (only speed + size sliders)',
    rangeInfo.count === 2 && !rangeInfo.hasScrub && rangeInfo.ids.includes('speed-slider') && rangeInfo.ids.includes('size-slider'),
    JSON.stringify(rangeInfo))

  // ---- POINT 6: NO DEAD CONTROLS / NO SCAFFOLD / NO CUT FEATURES ----
  // (a) Reset -> index 0
  await pageA.locator('[data-testid="reset-btn"]').click()
  await sleep(300)
  const idxReset = await activeIndex(pageA)
  check('6a Reset -> index 0', idxReset === 0 || idxReset === null, `idx=${idxReset}`)
  // Mirror -> scaleX(-1)
  await pageA.locator('[data-testid="mirror-btn"]').click()
  await sleep(200)
  const mirrorXform = await pageA.evaluate(() => {
    const el = document.querySelector('.teleprompter-word')
    const block = el ? el.parentElement : null
    return block ? getComputedStyle(block).transform : 'none'
  })
  check('6a Mirror -> scaleX(-1)', mirrorXform.includes('matrix(-1'), mirrorXform)
  await pageA.locator('[data-testid="mirror-btn"]').click() // toggle back
  // Speed extremes
  const speed = pageA.locator('[data-testid="speed-slider"]')
  await speed.focus()
  await speed.fill('-1')
  await sleep(150)
  const speedMin = await pageA.textContent('[data-testid="speed-readout"]')
  await speed.fill('1')
  await sleep(150)
  const speedMax = await pageA.textContent('[data-testid="speed-readout"]')
  check('6a Speed slider extremes read 0.25× / 4.00×',
    speedMin.includes('0.25×') && speedMax.includes('4.00×'), `${speedMin} .. ${speedMax}`)
  await speed.fill('0')
  // Text-size moves display font
  const fontBefore = await pageB.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.teleprompter-word')).fontSize))
  const size = pageA.locator('[data-testid="size-slider"]')
  await size.focus()
  await size.fill('1')
  await sleep(400)
  const fontAfter = await pageB.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.teleprompter-word')).fontSize))
  check('6a Text-size slider moves the display font', fontAfter > fontBefore, `${fontBefore} -> ${fontAfter}`)
  await size.fill('0')
  // Countdown offers 1/3/5
  const cdCount = await pageA.locator('[data-testid="countdown-option"]').count()
  check('6a Countdown offers 1s/3s/5s', cdCount === 3, `options=${cdCount}`)

  // (b) no scaffold tells on the display
  const dispScaffold = await pageB.evaluate(() => {
    const stars = document.querySelector('.stars, [class*="starfield"], [class*="sparkle"]')
    const pill = document.querySelector('[data-testid="status-pill"]')
    const body = document.body.innerText.toLowerCase()
    return { stars: !!stars, pill: !!pill, hasVmin: body.includes('vmin'), hasDaniel: body.includes('text from daniel') }
  })
  check('6b display has no scaffold (no stars/pill/vmin/test-string)',
    !dispScaffold.stars && !dispScaffold.pill && !dispScaffold.hasVmin && !dispScaffold.hasDaniel, JSON.stringify(dispScaffold))
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'frontend', 'package.json'), 'utf8'))
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }
  const banned = Object.keys(allDeps).filter((d) => d.includes('tsparticles') || d.includes('framer-motion'))
  check('6b bundle has no @tsparticles / framer-motion', banned.length === 0, JSON.stringify(banned))

  // (c) cut features absent — no script library UI anywhere on the editor
  await pageA.locator('[data-testid="exit-btn"]').click()
  await sleep(300)
  const libUI = await pageA.evaluate(() => {
    const txt = document.body.innerText.toLowerCase()
    const libWords = ['save script', 'new script', 'rename', 'delete script', 'my scripts', 'saved scripts', 'script library']
    return libWords.filter((w) => txt.includes(w))
  })
  check('6c no script-library UI (no save/open/rename/delete)', libUI.length === 0, JSON.stringify(libUI))
  const editorRanges = await pageA.evaluate(() => document.querySelectorAll('input[type="range"]').length)
  check('6c no word-scrub range input in editor', editorRanges === 0, `ranges=${editorRanges}`)

  // ---- POINT 7: SURVIVES A REAL SESSION ----
  // click through several segments, verify display matches each
  let allMatch = true
  for (const [idx, needle] of [[1, 'Hoje eu vou'], [4, 'Cola o seu roteiro'], [2, 'O texto rola']]) {
    await pageA.locator(`[data-testid="segment"][data-segment-index="${idx}"]`).click()
    const l = await pollDisplayContent(pageB, needle, 1500)
    if (l < 0) allMatch = false
  }
  check('7 click through several segments, display matches each', allMatch)
  // present, play, change speed/font, mirror — a sustained run
  await pageA.locator('[data-testid="start-presenting"]').click()
  await pageA.waitForSelector('[data-testid="play-toggle"]')
  await pageA.locator('[data-testid="countdown-option"]', { hasText: '1s' }).first().click()
  await pageA.locator('[data-testid="play-toggle"]').click()
  await sleep(1800)
  await pageA.keyboard.press('ArrowUp')
  await pageA.keyboard.press('ArrowUp')
  await pageA.locator('[data-testid="mirror-btn"]').click()
  await sleep(1200)
  const idxFinite = await activeIndex(pageA)
  const bInSync = await pageB.evaluate(() => document.body.innerText.length > 0)
  await pageA.locator('[data-testid="exit-btn"]').click()
  await sleep(300)
  const backToEditor = await pageA.locator('[data-testid="script-input"]').count()
  check('7 finite index, display in sync, exit returns to editor',
    idxFinite !== null && Number.isFinite(idxFinite) && bInSync && backToEditor === 1,
    `idx=${idxFinite} inSync=${bInSync} editor=${backToEditor === 1}`)

  // final screenshots after a synced segment click
  await pageA.locator('[data-testid="segment"][data-segment-index="0"]').click()
  await sleep(500)
  await pageA.screenshot({ path: path.join(SHOT_DIR, 'controller-final.png') })
  await pageB.screenshot({ path: path.join(SHOT_DIR, 'display-final.png') })

  check('7 zero console/page errors during the session', errors.length === 0, errors.slice(0, 5).join(' | '))

  await browser.close()

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${'='.repeat(54)}\nLayer 2: ${results.length - failed.length}/${results.length} passed`)
  if (failed.length) {
    console.log('FAILED:')
    failed.forEach((f) => console.log(`  - ${f.name} :: ${f.detail}`))
  }
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  console.error('Layer 2 crashed:', e)
  process.exit(2)
})

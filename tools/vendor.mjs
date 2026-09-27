/**
 * vendor — copies the publish gate in from the CMS.
 *
 * `lib/platformSpec.ts` in everfluorescent-cms is the only place a platform limit
 * is written down. The Studio's preview pane reads it, the Studio's publish
 * button reads it through `lib/preflight.ts`, and this app computes the same
 * verdict from the same code — so a caption the preview said would fit cannot be
 * refused here, and a post the Studio would block cannot be approved here.
 *
 * It is copied rather than imported because the CMS is a separate working copy
 * and is not under version control, so nothing here can reach it at run time.
 * What lands in src/vendor is the SOURCE, verbatim — no rewrite, no second
 * implementation of the rules. Both files are pure TypeScript with no Sanity
 * imports, which is what makes a straight copy possible.
 *
 *   npm run vendor          refresh from the CMS checkout
 *   npm run vendor:check    exit 1 if what is committed is stale
 *
 * Point it elsewhere with CMS_PATH=/path/to/everfluorescent-cms.
 * The check only works where the CMS is present, so it guards this machine, not
 * a deploy.
 */
import {createHash} from 'node:crypto'
import {existsSync, readFileSync, writeFileSync} from 'node:fs'
import {dirname, join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const vendorDir = resolve(here, '../src/vendor')

const SOURCES = ['lib/platformSpec.ts', 'lib/preflight.ts']

const check = process.argv.includes('--check')

const cmsPath = resolve(
  process.env.CMS_PATH ||
    // The layout on this machine: both checkouts under one Codestuff folder.
    resolve(here, '../../everfluorescent-cms/everfluorescent-cms'),
)

function fail(message) {
  console.error(message)
  process.exit(1)
}

if (!existsSync(cmsPath)) {
  fail(`No CMS checkout at ${cmsPath}. Set CMS_PATH and try again.`)
}

const hash = createHash('sha256')
const files = {}

for (const rel of SOURCES) {
  const from = join(cmsPath, rel)
  if (!existsSync(from)) fail(`${cmsPath} has no ${rel}.`)

  const source = readFileSync(from, 'utf8')
  hash.update(rel)
  hash.update(source)

  // The CMS imports with an explicit `.ts` extension because it runs under
  // `node --experimental-strip-types`. This app's tsconfig does not allow that,
  // so the specifier loses its extension. The only edit made to either file.
  const body = source.replace(/from '\.\/platformSpec\.ts'/g, "from './platformSpec'")

  files[rel.replace(/^lib\//, '')] = body
}

const digest = hash.digest('hex').slice(0, 16)

const header = (rel) =>
  `// GENERATED — do not edit.\n` +
  `//\n` +
  `// Copied verbatim from ${rel} in the everfluorescent-cms repository,\n` +
  `// the single source of truth for every platform limit. The Studio preview reads\n` +
  `// it, the Studio publish button reads it, and this app computes the same verdict\n` +
  `// from the same code so the three can never disagree.\n` +
  `//\n` +
  `// Change it THERE, then run: npm run vendor\n` +
  `//\n` +
  `// Source set hash: ${digest}\n\n`

const written = Object.fromEntries(
  Object.entries(files).map(([name, body]) => [name, header(`lib/${name}`) + body]),
)

if (check) {
  const stale = Object.entries(written).filter(([name, body]) => {
    const path = join(vendorDir, name)
    return !existsSync(path) || readFileSync(path, 'utf8') !== body
  })

  if (stale.length) {
    fail(
      `The vendored gate no longer matches the CMS:\n` +
        stale.map(([name]) => `  · src/vendor/${name}`).join('\n') +
        `\n\nRun: npm run vendor`,
    )
  }
  console.log(`src/vendor is current with the CMS (source set ${digest}).`)
  process.exit(0)
}

for (const [name, body] of Object.entries(written)) {
  writeFileSync(join(vendorDir, name), body)
  console.log(`  src/vendor/${name}`)
}
console.log(`Vendored from ${cmsPath} (source set ${digest})`)

// This app blocks approval on these numbers, so it is worth naming the ones that
// are still guesses. They were advisory when only a preview read them.
const spec = await import(
  'file:///' + join(vendorDir, 'platformSpec.ts').replace(/\\/g, '/')
).catch(() => null)

if (spec?.PLATFORMS) {
  const unverified = []
  for (const p of Object.values(spec.PLATFORMS)) {
    if (!p.caption.verified) unverified.push(`${p.label} caption limit`)
    if (!p.hashtags.verified) unverified.push(`${p.label} hashtag limit`)
    for (const f of p.formats) {
      if (f.duration && !f.duration.verified) unverified.push(`${p.label} ${f.label} duration`)
    }
  }
  if (unverified.length) {
    console.log(`\n  ${unverified.length} of these limits are still marked verified: false —`)
    for (const u of unverified) console.log(`    · ${u}`)
  }
}

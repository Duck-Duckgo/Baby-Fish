import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const dist = 'dist'
const builtHtml = join(dist, 'index.vite.html')
if (!existsSync(builtHtml)) {
  throw new Error(`missing ${builtHtml}; vite build may have failed`)
}

const html = readFileSync(builtHtml)

// Publish static site at repo root for GitHub Pages (branch main, path /).
writeFileSync('index.html', html)
// Also normalize dist/ so the Actions artifact has index.html.
writeFileSync(join(dist, 'index.html'), html)
rmSync('assets', { recursive: true, force: true })
cpSync(join(dist, 'assets'), 'assets', { recursive: true })
cpSync(join(dist, 'favicon.svg'), 'favicon.svg')
cpSync(join(dist, 'CNAME'), 'CNAME')
writeFileSync('.nojekyll', '')
writeFileSync(join(dist, '.nojekyll'), '')
console.log('Published dist/ to repository root for GitHub Pages')

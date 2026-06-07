// TCI protocol probe — connects to a TCI server, prints every frame it sends,
// then issues a few read-only queries. Read-only: it never keys the radio.
//
//   node scripts/tci-probe.mjs [host] [port] [trx] [seconds]
//
// Defaults: 127.0.0.1 40001 0 8

import WebSocket from 'ws'

const host = process.argv[2] ?? '127.0.0.1'
const port = Number(process.argv[3] ?? 40001)
const trx = Number(process.argv[4] ?? 0)
const seconds = Number(process.argv[5] ?? 8)
const url = `ws://${host}:${port}`

const t0 = Date.now()
const stamp = () => `+${String(Date.now() - t0).padStart(5, ' ')}ms`
const seen = new Set()

console.log(`[probe] connecting to ${url} (trx ${trx}), listening ${seconds}s`)

const ws = new WebSocket(url)

ws.on('open', () => console.log(`${stamp()} OPEN`))

ws.on('message', (data) => {
  const text = data.toString()
  // Each text frame may carry several ';'-terminated commands.
  for (const frame of text.split(';').map((s) => s.trim()).filter(Boolean)) {
    const cmd = frame.split(':')[0].toLowerCase()
    seen.add(cmd)
    console.log(`${stamp()} <= ${frame}`)
    if (cmd === 'ready') {
      // Fire read-only queries once the server says it's ready.
      const queries = [
        `vfo:${trx},0`,
        `modulation:${trx}`,
        `cw_macros_speed`,
        `trx:${trx}`,
        `dds:${trx}`
      ]
      for (const q of queries) {
        console.log(`${stamp()} => ${q};`)
        ws.send(`${q};`)
      }
    }
  }
})

ws.on('error', (err) => console.log(`${stamp()} ERROR ${err.message}`))
ws.on('close', (code) => console.log(`${stamp()} CLOSE code=${code}`))

setTimeout(() => {
  console.log(`\n[probe] commands seen: ${[...seen].sort().join(', ')}`)
  // Did we learn the CW mode spelling?
  ws.close()
  setTimeout(() => process.exit(0), 200)
}, seconds * 1000)

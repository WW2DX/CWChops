import { afterEach, describe, expect, it } from 'vitest'
import { AddressInfo } from 'node:net'
import { WebSocket, WebSocketServer } from 'ws'
import { TciClient } from './client'
import type { RadioState } from '@shared/types'

/**
 * A minimal mock TCI server: completes the handshake (start;ready;) on connect,
 * records every command it receives, and lets the test push events to the client.
 */
class MockTciServer {
  readonly received: string[] = []
  private wss: WebSocketServer
  private socket: WebSocket | null = null

  private constructor(wss: WebSocketServer) {
    this.wss = wss
    wss.on('connection', (ws) => {
      this.socket = ws
      ws.on('message', (d) => this.received.push(d.toString()))
      // Initialization burst + ready.
      ws.send('modulations_list:am,sam,lsb,usb,cw,nfm,digl,digu;')
      ws.send('start;')
      ws.send('ready;')
    })
  }

  static async start(): Promise<MockTciServer> {
    const wss = new WebSocketServer({ port: 0 })
    await new Promise<void>((resolve) => wss.once('listening', () => resolve()))
    return new MockTciServer(wss)
  }

  get port(): number {
    return (this.wss.address() as AddressInfo).port
  }

  push(frame: string): void {
    this.socket?.send(frame)
  }

  close(): Promise<void> {
    return new Promise((resolve) => this.wss.close(() => resolve()))
  }
}

function waitForState(
  client: TciClient,
  predicate: (s: RadioState) => boolean,
  timeoutMs = 2000
): Promise<RadioState> {
  return new Promise((resolve, reject) => {
    const current = client.getState()
    if (predicate(current)) return resolve(current)
    const timer = setTimeout(() => {
      client.off('state', onState)
      reject(new Error('timeout waiting for state'))
    }, timeoutMs)
    const onState = (s: RadioState): void => {
      if (predicate(s)) {
        clearTimeout(timer)
        client.off('state', onState)
        resolve(s)
      }
    }
    client.on('state', onState)
  })
}

function waitForReceived(
  server: MockTciServer,
  match: (cmd: string) => boolean,
  timeoutMs = 2000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const tick = (): void => {
      const hit = server.received.find(match)
      if (hit) return resolve(hit)
      if (Date.now() - start > timeoutMs) return reject(new Error('timeout waiting for command'))
      setTimeout(tick, 10)
    }
    tick()
  })
}

describe('TciClient (against a mock TCI server)', () => {
  let server: MockTciServer
  let client: TciClient

  afterEach(async () => {
    client?.disconnect()
    await server?.close()
  })

  it('connects, reaches ready, and queries radio state', async () => {
    server = await MockTciServer.start()
    client = new TciClient({ host: '127.0.0.1', port: server.port, trx: 0 })
    client.connect()

    const ready = await waitForState(client, (s) => s.connection === 'ready')
    expect(ready.connection).toBe('ready')

    // On ready it queries vfo and modulation (CW speed is app-owned, not queried).
    await waitForReceived(server, (c) => c.startsWith('vfo:0,0'))
    expect(server.received).toContain('modulation:0;')
  })

  it('sets both macros and keyer CW speed', async () => {
    server = await MockTciServer.start()
    client = new TciClient({ host: '127.0.0.1', port: server.port, trx: 0 })
    client.connect()
    await waitForState(client, (s) => s.connection === 'ready')

    client.setWpm(32)
    await waitForReceived(server, (c) => c === 'cw_keyer_speed:32;')
    expect(server.received).toContain('cw_macros_speed:32;')
    expect(client.getState().wpm).toBe(32)
  })

  it('mirrors a pushed VFO event into freq + band', async () => {
    server = await MockTciServer.start()
    client = new TciClient({ host: '127.0.0.1', port: server.port, trx: 0 })
    client.connect()
    await waitForState(client, (s) => s.connection === 'ready')

    server.push('vfo:0,0,14025000;')
    const s = await waitForState(client, (st) => st.freqHz === 14_025_000)
    expect(s.band).toBe('20m')
  })

  it('sends a correctly formatted set-frequency command', async () => {
    server = await MockTciServer.start()
    client = new TciClient({ host: '127.0.0.1', port: server.port, trx: 0 })
    client.connect()
    await waitForState(client, (s) => s.connection === 'ready')

    client.setFrequency(7_030_000)
    const cmd = await waitForReceived(server, (c) => c === 'vfo:0,0,7030000;')
    expect(cmd).toBe('vfo:0,0,7030000;')
  })

  it('escapes reserved characters when sending CW', async () => {
    server = await MockTciServer.start()
    client = new TciClient({ host: '127.0.0.1', port: server.port, trx: 0 })
    client.connect()
    await waitForState(client, (s) => s.connection === 'ready')

    client.sendCw('TU; NR,5')
    const cmd = await waitForReceived(server, (c) => c.startsWith('cw_macros:'))
    expect(cmd).toBe('cw_macros:0,TU* NR~5;')
  })

  it('emits callsign on callsign_send', async () => {
    server = await MockTciServer.start()
    client = new TciClient({ host: '127.0.0.1', port: server.port, trx: 0 })
    client.connect()
    await waitForState(client, (s) => s.connection === 'ready')

    const got = new Promise<string>((resolve) => client.once('callsign', resolve))
    server.push('callsign_send:W1ABC;')
    expect(await got).toBe('W1ABC')
  })
})

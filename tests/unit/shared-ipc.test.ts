import { describe, expect, it } from 'vitest'
import { IPC_CHANNELS } from '../../src/shared/ipc'

describe('IPC_CHANNELS', () => {
  it('为每个方法提供唯一且带命名空间的频道名', () => {
    const channels = Object.values(IPC_CHANNELS)

    expect(new Set(channels).size).toBe(channels.length)
    for (const channel of channels) {
      expect(channel).toMatch(/^[a-z]+:[a-z-]+$/)
    }
  })
})

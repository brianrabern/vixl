import { describe, expect, it } from 'vitest'
import bytesToDataUrl from '@/utils/bytes-to-data-url'
import dataUrlToBytes from '@/utils/data-url-to-bytes'

describe('data-url-to-bytes', () => {
  it('round-trips base64 payloads from bytesToDataUrl', () => {
    const bytes = new Uint8Array([0, 1, 2, 254, 255])
    const dataUrl = bytesToDataUrl(bytes, 'image/png')
    const decoded = dataUrlToBytes(dataUrl)

    expect(decoded.mediaType).toBe('image/png')
    expect(Array.from(decoded.bytes)).toEqual(Array.from(bytes))
  })

  it('decodes a percent-encoded non-base64 payload', () => {
    const decoded = dataUrlToBytes('data:text/plain,hello%20world')

    expect(decoded.mediaType).toBe('text/plain')
    expect(Array.from(decoded.bytes)).toEqual(
      Array.from(new TextEncoder().encode('hello world')),
    )
  })

  it('decodes non-ascii percent-encoded bytes without UTF-8', () => {
    const decoded = dataUrlToBytes(
      'data:application/octet-stream,%89%50%4E%47',
    )

    expect(decoded.mediaType).toBe('application/octet-stream')
    expect(Array.from(decoded.bytes)).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('extracts mediaType before parameters and ;base64', () => {
    const jpeg = dataUrlToBytes(bytesToDataUrl(new Uint8Array([9]), 'image/jpeg'))
    expect(jpeg.mediaType).toBe('image/jpeg')

    const withCharset = dataUrlToBytes(
      'data:text/plain;charset=UTF-8,hi',
    )
    expect(withCharset.mediaType).toBe('text/plain')
    expect(Array.from(withCharset.bytes)).toEqual(
      Array.from(new TextEncoder().encode('hi')),
    )
  })

  it('throws on malformed URLs and invalid base64', () => {
    expect(() => dataUrlToBytes('https://example.com/a.png')).toThrow(
      'Malformed data URL',
    )
    expect(() => dataUrlToBytes('data:image/png;base64')).toThrow(
      'Malformed data URL',
    )
    expect(() => dataUrlToBytes('data:image/png;base64,!!!')).toThrow(
      'Invalid base64',
    )
  })
})

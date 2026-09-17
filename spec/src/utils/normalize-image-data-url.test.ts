import { afterEach, describe, expect, it, vi } from 'vitest'
import imageCompression from 'browser-image-compression'
import bytesToDataUrl from '@/utils/bytes-to-data-url'
import normalizeImageDataUrl from '@/utils/normalize-image-data-url'

vi.mock('browser-image-compression', () => ({
  default: vi.fn<(file: File, options?: Record<string, unknown>) => Promise<File>>(),
}))

const MAX_RAW_BYTES = 3.75 * 1024 * 1024

const stubImageBitmap = (width: number, height: number): void => {
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({
      width,
      height,
      close: vi.fn<() => void>(),
    })),
  )
}

describe('normalize-image-data-url', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.mocked(imageCompression).mockReset()
  })

  it('returns input unchanged for non-image mediaType', async () => {
    const input = {
      dataUrl: 'data:text/plain;base64,QQ==',
      mediaType: 'text/plain',
    }
    await expect(normalizeImageDataUrl(input)).resolves.toEqual(input)
    expect(imageCompression).not.toHaveBeenCalled()
  })

  it('returns input unchanged for a non-data URL', async () => {
    const input = {
      dataUrl: 'https://example.com/shot.png',
      mediaType: 'image/png',
    }
    await expect(normalizeImageDataUrl(input)).resolves.toEqual(input)
    expect(imageCompression).not.toHaveBeenCalled()
  })

  it('returns png/jpeg input unchanged when size and dimensions are within limits', async () => {
    stubImageBitmap(800, 600)

    const png = {
      dataUrl: bytesToDataUrl(new Uint8Array(1024), 'image/png'),
      mediaType: 'image/png',
    }
    await expect(normalizeImageDataUrl(png)).resolves.toEqual(png)
    expect(imageCompression).not.toHaveBeenCalled()

    stubImageBitmap(2000, 2000)
    const jpeg = {
      dataUrl: bytesToDataUrl(new Uint8Array(2048), 'image/jpeg'),
      mediaType: 'image/jpeg',
    }
    await expect(normalizeImageDataUrl(jpeg)).resolves.toEqual(jpeg)
    expect(imageCompression).not.toHaveBeenCalled()
  })

  it('converts an oversize png to image/jpeg', async () => {
    stubImageBitmap(800, 600)

    const compressedBytes = new Uint8Array([1, 2, 3, 4])
    const compressed = new File([compressedBytes], 'out.jpg', {
      type: 'image/jpeg',
    })
    vi.mocked(imageCompression).mockResolvedValue(compressed)

    const result = await normalizeImageDataUrl({
      dataUrl: bytesToDataUrl(new Uint8Array(4 * 1024 * 1024), 'image/png'),
      mediaType: 'image/png',
    })

    expect(imageCompression).toHaveBeenCalledTimes(1)
    expect(vi.mocked(imageCompression).mock.calls[0]?.[1]).toMatchObject({
      maxSizeMB: 3.75,
      maxWidthOrHeight: 2000,
      initialQuality: 0.8,
      useWebWorker: true,
      fileType: 'image/jpeg',
    })
    expect(result).toEqual({
      dataUrl: bytesToDataUrl(compressedBytes, 'image/jpeg'),
      mediaType: 'image/jpeg',
    })
  })

  it('forces fileType image/jpeg for webp input', async () => {
    stubImageBitmap(100, 100)

    const compressedBytes = new Uint8Array([9, 8, 7])
    const compressed = new File([compressedBytes], 'out.jpg', {
      type: 'image/jpeg',
    })
    vi.mocked(imageCompression).mockResolvedValue(compressed)

    const result = await normalizeImageDataUrl({
      dataUrl: bytesToDataUrl(new Uint8Array(512), 'image/webp'),
      mediaType: 'image/webp',
    })

    expect(vi.mocked(imageCompression).mock.calls[0]?.[1]).toMatchObject({
      fileType: 'image/jpeg',
    })
    expect(result).toEqual({
      dataUrl: bytesToDataUrl(compressedBytes, 'image/jpeg'),
      mediaType: 'image/jpeg',
    })
  })

  it('falls through to jpeg compression when createImageBitmap throws for a small png', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new Error('decode failed')
      }),
    )

    const compressedBytes = new Uint8Array([5, 6])
    const compressed = new File([compressedBytes], 'out.jpg', {
      type: 'image/jpeg',
    })
    vi.mocked(imageCompression).mockResolvedValue(compressed)

    const result = await normalizeImageDataUrl({
      dataUrl: bytesToDataUrl(new Uint8Array(1024), 'image/png'),
      mediaType: 'image/png',
    })

    expect(imageCompression).toHaveBeenCalledTimes(1)
    expect(vi.mocked(imageCompression).mock.calls[0]?.[1]).toMatchObject({
      fileType: 'image/jpeg',
    })
    expect(result).toEqual({
      dataUrl: bytesToDataUrl(compressedBytes, 'image/jpeg'),
      mediaType: 'image/jpeg',
    })
  })

  it('throws when the compressed result is still over budget', async () => {
    stubImageBitmap(800, 600)

    const overBudget = new File(
      [new Uint8Array(Math.floor(MAX_RAW_BYTES) + 1)],
      'out.jpg',
      { type: 'image/jpeg' },
    )
    vi.mocked(imageCompression).mockResolvedValue(overBudget)

    await expect(
      normalizeImageDataUrl({
        dataUrl: bytesToDataUrl(new Uint8Array(4 * 1024 * 1024), 'image/png'),
        mediaType: 'image/png',
      }),
    ).rejects.toThrow('Image could not be compressed under the 3.75MB provider limit')
  })

  it('propagates a compressor throw', async () => {
    stubImageBitmap(800, 600)
    vi.mocked(imageCompression).mockRejectedValue(new Error('compress failed'))

    const input = {
      dataUrl: bytesToDataUrl(new Uint8Array(4 * 1024 * 1024), 'image/png'),
      mediaType: 'image/png',
    }
    await expect(normalizeImageDataUrl(input)).rejects.toThrow(
      'Failed to normalize image for provider: compress failed',
    )
  })
})

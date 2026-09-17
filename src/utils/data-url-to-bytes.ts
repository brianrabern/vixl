const HEX_DIGIT = /[0-9a-fA-F]/

const binaryStringToBytes = (binary: string): Uint8Array => {
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

const decodePercentEncodedBytes = (payload: string): Uint8Array => {
  const bytes: number[] = []
  for (let i = 0; i < payload.length; i += 1) {
    if (payload[i] !== '%') {
      bytes.push(payload.charCodeAt(i))
      continue
    }

    const high = payload[i + 1] ?? ''
    const low = payload[i + 2] ?? ''
    if (!HEX_DIGIT.test(high) || !HEX_DIGIT.test(low)) {
      throw new Error('Malformed data URL')
    }
    bytes.push(parseInt(`${high}${low}`, 16))
    i += 2
  }
  return new Uint8Array(bytes)
}

const mediaTypeFromMeta = (meta: string): string => {
  const withoutBase64 = meta.includes(';base64')
    ? meta.slice(0, meta.indexOf(';base64'))
    : meta
  const mediaType = withoutBase64.split(';')[0]
  return mediaType || 'text/plain'
}

export default (dataUrl: string): { bytes: Uint8Array; mediaType: string } => {
  if (!dataUrl.startsWith('data:')) {
    throw new Error('Malformed data URL')
  }

  const comma = dataUrl.indexOf(',')
  if (comma < 0) {
    throw new Error('Malformed data URL')
  }

  const meta = dataUrl.slice(5, comma)
  const payload = dataUrl.slice(comma + 1)
  const mediaType = mediaTypeFromMeta(meta)

  if (meta.includes(';base64')) {
    try {
      return { bytes: binaryStringToBytes(atob(payload)), mediaType }
    } catch {
      throw new Error('Invalid base64')
    }
  }

  try {
    return {
      bytes: decodePercentEncodedBytes(payload),
      mediaType,
    }
  } catch {
    throw new Error('Malformed data URL')
  }
}

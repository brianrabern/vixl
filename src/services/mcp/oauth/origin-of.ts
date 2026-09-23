const originOf = (value: string | URL): string => {
  if (value instanceof URL) {
    return value.origin
  }
  try {
    return new URL(value).origin
  } catch {
    return value
  }
}

export default originOf

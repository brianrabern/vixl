const attachSteerDeliveryStarted = (error: unknown): Error => {
  const err = error instanceof Error ? error : new Error('Unknown error')
  return Object.assign(err, { steerDeliveryStarted: true as const })
}

export default attachSteerDeliveryStarted

const isSteerDeliveryStarted = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'steerDeliveryStarted' in error &&
  (error as { steerDeliveryStarted: unknown }).steerDeliveryStarted === true

export default isSteerDeliveryStarted

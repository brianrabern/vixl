const IMAGE_CAPABILITY_REJECTION =
  /image was not allowed|does not support images|not support image/i
const MALFORMED_IMAGE_URL =
  /image_url/i
const MALFORMED_IMAGE_URL_DETAIL =
  /expected a valid url|invalid format/i
const INVALID_JSON_BODY = /invalid json response body/i

const CAPABILITY_HINT =
  'The selected model or provider rejected the image input. Switch to a vision-capable model or remove the image.'
const MALFORMED_IMAGE_URL_HINT =
  'An image in this conversation could not be read by the provider. Remove the image and attach it again.'

const describeAgentRunError = (message: string): string => {
  if (IMAGE_CAPABILITY_REJECTION.test(message)) {
    return CAPABILITY_HINT
  }
  if (MALFORMED_IMAGE_URL.test(message) && MALFORMED_IMAGE_URL_DETAIL.test(message)) {
    return MALFORMED_IMAGE_URL_HINT
  }
  if (INVALID_JSON_BODY.test(message)) {
    return `${message} The provider rejected the request payload.`
  }
  return message
}

export default describeAgentRunError

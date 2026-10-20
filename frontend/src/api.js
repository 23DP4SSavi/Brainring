export async function api(path, options = {}) {
  let response
  try {
    response = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
    })
  } catch {
    const error = new Error(
      'Cannot reach BrainRing server. Check that backend is running and try again.',
    )
    error.code = 'NETWORK'
    throw error
  }
  const data =
    response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(
      data?.error ||
        (response.status >= 500
          ? 'BrainRing server had an error. Please try again shortly.'
          : 'Something went wrong. Please try again.'),
    )
    error.status = response.status
    throw error
  }
  return data
}

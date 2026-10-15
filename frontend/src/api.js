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
    throw new Error(
      'Cannot reach BrainRing. Check your connection and try again.',
    )
  }
  const data =
    response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(
      data?.error || 'Something went wrong. Please try again.',
    )
    error.status = response.status
    throw error
  }
  return data
}

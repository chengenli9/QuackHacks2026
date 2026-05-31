self.onmessage = async (event) => {
  const { url, body, timeoutMs = 60000 } = event.data ?? {};
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      self.postMessage({ ok: false, error: `Object estimate failed with status ${response.status}` });
      return;
    }

    self.postMessage({ ok: true, profile: await response.json() });
  } catch (error) {
    const message = error?.name === 'AbortError'
      ? `Object estimate timed out after ${timeoutMs}ms`
      : error?.message || String(error);
    self.postMessage({ ok: false, error: message });
  } finally {
    clearTimeout(timeout);
  }
};

export async function generate(formData, options = {}) {
  const params = new URLSearchParams();
  if (options.outputFormat) params.set("outputFormat", options.outputFormat);
  const url = params.toString() ? `/api/generate?${params}` : "/api/generate";
  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || body.detail || `Request failed: ${res.status}`);
  }
  return res.blob();
}

export async function askQuestion({question, top_k=3, apiKey}){
  const r = await fetch('/ask', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey
    },
    body: JSON.stringify({ question, top_k })
  })
  if(!r.ok) throw new Error('Request failed')
  return r.json()
}

export async function uploadBatch(file, apiKey){
  const fd = new FormData();
  fd.append('file', file)
  const r = await fetch('/ask_batch', {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey },
    body: fd
  })
  if(!r.ok) {
    const j = await r.json().catch(()=>null)
    throw new Error(j?.error || 'Upload failed')
  }
  const blob = await r.blob()
  return blob
}

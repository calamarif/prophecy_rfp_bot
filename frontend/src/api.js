export async function askQuestion({question, top_k=3, apiKey}){
  const response = await fetch('/ask', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey
    },
    body: JSON.stringify({ question, top_k })
  });
  if(!response.ok){
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error || 'Request failed');
  }
  return response.json();
}

const handleAsk = async () => {
  try {
    const r = await askQuestion({ question, top_k: 3, apiKey });
    setAnswer(r.answer);
    setSources(r.sources || []);
  } catch (e) {
    alert("Failed to get answer: " + e.message);
  }
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

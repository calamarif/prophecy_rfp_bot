import React, {useState} from 'react'
import axios from 'axios'

export default function ChatPage(){
  const [apiKey, setApiKey] = useState(localStorage.getItem('API_KEY')||'')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [references, setReferences] = useState([])
  const [loading, setLoading] = useState(false)
  const saveKey = ()=>{ localStorage.setItem('API_KEY', apiKey); alert('Saved') }

  async function ask(){
    if(!question.trim()) return
    setLoading(true)
    try{
      const res = await axios.post('/ask', { question, top_k: 3 }, { headers: { 'X-API-KEY': apiKey } })
      setAnswer(res.data.answer)
      setReferences(res.data.references || [])
    }catch(e){
      alert(e.response?.data?.error || e.message)
    }finally{ setLoading(false) }
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="flex items-center gap-3 mb-4">
        <input value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="X-API-KEY" className="border p-2 rounded w-80"/>
        <button onClick={saveKey} className="bg-teal-500 text-white px-4 py-2 rounded">Save key</button>
      </div>

      <h2 className="text-xl font-semibold mb-2">Ask a question</h2>
      <textarea value={question} onChange={e=>setQuestion(e.target.value)} rows="4" className="w-full border rounded p-3 mb-3" />
      <button disabled={loading} onClick={ask} className="bg-[#00BFA5] text-white px-4 py-2 rounded">
        {loading ? 'Thinking…' : 'Ask'}
      </button>

      {answer && (
        <div className="mt-6 bg-gray-50 p-4 rounded">
          <h3 className="font-semibold mb-2">Answer</h3>
          <div className="whitespace-pre-wrap">{answer}</div>
          {references.length>0 && (
            <div className="mt-4 p-3 bg-white border rounded">
              <strong>References</strong>
              <ul className="list-disc ml-6">
                {references.map((r,i)=>(<li key={i}>{r}</li>))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

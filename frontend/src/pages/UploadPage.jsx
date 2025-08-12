import React, {useState} from 'react'
import axios from 'axios'

export default function UploadPage(){
  const [file, setFile] = useState(null)
  const [results, setResults] = useState([])
  const [apiKey, setApiKey] = useState(localStorage.getItem('API_KEY')||'')

  async function upload(){
    if(!file) return alert('Choose file')
    const fd = new FormData()
    fd.append('file', file)
    try{
      const res = await axios.post('/upload_excel', fd, { headers: { 'X-API-KEY': apiKey, 'Content-Type': 'multipart/form-data'} })
      setResults(res.data.results || [])
    }catch(e){
      alert(e.response?.data?.error || e.message)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Upload Excel of questions</h2>
      <input type="file" accept=".xlsx,.xls,.csv" onChange={e=>setFile(e.target.files[0])} />
      <div className="mt-3">
        <button onClick={upload} className="bg-[#00BFA5] text-white px-4 py-2 rounded">Upload & Process</button>
      </div>

      {results.length>0 && (
        <div className="mt-6">
          {results.map((r, i)=>(
            <div key={i} className="border-b py-3">
              <div className="font-medium">Q: {r.question}</div>
              <div className="text-gray-700">A: {r.answer}</div>
              {r.references && r.references.length>0 && (
                <div className="text-sm text-gray-600 mt-1">
                  Refs: {r.references.join('; ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

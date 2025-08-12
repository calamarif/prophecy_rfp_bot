import React, { useState } from 'react'
import { askQuestion, uploadBatch } from './api'

export default function App(){
  const [apiKey, setApiKey] = useState(localStorage.getItem('API_KEY')||'')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [sources, setSources] = useState([])

  const login = () => { localStorage.setItem('API_KEY', apiKey); alert('Saved API key') }

  const handleAsk = async () => {
    const r = await askQuestion({ question, top_k: 3, apiKey })
    setAnswer(r.answer)
    setSources(r.sources || [])
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#F5F4FA',
      fontFamily: '"Poppins", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
      padding: '2rem',
      color: '#222',
      maxWidth: 720,
      margin: 'auto'
    }}>
      <header style={{marginBottom: '2rem', textAlign: 'center'}}>
        {/* Replace this with logo img if you add one */}
        <h1 style={{color: '#433E8C', fontWeight: '700', fontSize: '2.5rem', margin: 0}}>Prophecy KB Q&A</h1>
      </header>

      <section style={{marginBottom: '1.5rem'}}>
        <label style={{display: 'block', marginBottom: '0.5rem', fontWeight: '600'}}>
          API Key:
          <input
            value={apiKey}
            onChange={e=>setApiKey(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '1rem',
              borderRadius: 6,
              border: '1px solid #ccc',
              marginTop: '0.25rem',
            }}
            type="password"
            placeholder="Enter your API key"
          />
        </label>
        <button
          onClick={login}
          style={{
            marginTop: '0.5rem',
            backgroundColor: '#E78A57',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            padding: '0.6rem 1.2rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background-color 0.3s ease'
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#d2764a'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#E78A57'}
        >
          Save
        </button>
      </section>

      <section style={{marginBottom: '2rem'}}>
        <h2 style={{color: '#433E8C', fontWeight: '700', marginBottom: '0.5rem'}}>Ask a question</h2>
        <textarea
          value={question}
          onChange={e=>setQuestion(e.target.value)}
          rows={5}
          style={{
            width: '100%',
            padding: '1rem',
            borderRadius: 8,
            border: '1px solid #ccc',
            fontSize: '1.1rem',
            resize: 'vertical',
            fontFamily: 'inherit',
          }}
          placeholder="Type your question here..."
        />
        <button
          onClick={handleAsk}
          disabled={!question.trim() || !apiKey.trim()}
          className="ask-btn"
          style={{
            marginTop: '1rem',
            backgroundColor: '#433E8C',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            padding: '0.8rem 1.8rem',
            fontWeight: '700',
            cursor: question.trim() && apiKey.trim() ? 'pointer' : 'not-allowed',
            opacity: question.trim() && apiKey.trim() ? 1 : 0.5,
            transition: 'background-color 0.3s ease'
          }}
          onMouseEnter={e => {
            if(question.trim() && apiKey.trim()) e.currentTarget.style.backgroundColor = '#372e6f'
          }}
          onMouseLeave={e => {
            if(question.trim() && apiKey.trim()) e.currentTarget.style.backgroundColor = '#433E8C'
          }}
        >
          Ask
        </button>

        <div style={{
          marginTop: '1.5rem',
          backgroundColor: 'white',
          padding: '1rem',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgb(0 0 0 / 0.1)',
          whiteSpace: 'pre-wrap',
          minHeight: '120px',
          color: '#333',
          fontSize: '1rem'
        }}>{answer || "Answer will appear here..."}</div>

        {sources.length > 0 && (
          <div style={{marginTop: '1rem', fontSize: '0.9rem', color: '#666'}}>
            <strong>References:</strong>
            <ul>
              {sources.map((s,i) => (
                <li key={i}>{s.source} (chunk {s.chunk_index})</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <h2 style={{color: '#433E8C', fontWeight: '700', marginBottom: '0.5rem'}}>Batch upload questions</h2>
        <input type='file' accept='.xlsx,.csv' onChange={async (ev) => {
          const f = ev.target.files[0]
          if(!f) return
          try {
            const res = await uploadBatch(f, apiKey)
            const url = URL.createObjectURL(res)
            const a = document.createElement('a')
            a.href = url
            a.download = 'answers.xlsx'
            a.click()
          } catch(e) {
            alert(e.message)
          }
        }} />
      </section>
    </div>
  )
}

import React, { useState } from 'react';

export default function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('API_KEY') || '');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const saveApiKey = () => {
    localStorage.setItem('API_KEY', apiKey);
    alert('API key saved!');
  };

  const askQuestion = async () => {
    setLoading(true);
    setError('');
    setAnswer('');
    setSources([]);
    try {
      const resp = await fetch('/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey,
        },
        body: JSON.stringify({ question }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Request failed');
      }
      const data = await resp.json();
      setAnswer(data.answer);
      setSources(data.sources || []);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 20, fontFamily: 'Arial, sans-serif', maxWidth: 700, margin: 'auto' }}>
      <h1>Knowledge Base Q&A</h1>
      <div style={{ marginBottom: 20 }}>
        <label>
          API Key:{' '}
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            style={{ width: 300 }}
          />
        </label>
        <button onClick={saveApiKey} style={{ marginLeft: 10 }}>
          Save API Key
        </button>
      </div>
      <textarea
        rows={4}
        style={{ width: '100%', fontSize: 16 }}
        placeholder="Enter your question here..."
        value={question}
        onChange={e => setQuestion(e.target.value)}
      />
      <div style={{ marginTop: 10 }}>
        <button onClick={askQuestion} disabled={loading || !question.trim()}>
          {loading ? 'Asking...' : 'Ask'}
        </button>
      </div>
      {error && <div style={{ marginTop: 10, color: 'red' }}>{error}</div>}
      {answer && (
        <div
          style={{
            marginTop: 20,
            whiteSpace: 'pre-wrap',
            backgroundColor: '#f7f7f7',
            padding: 15,
            borderRadius: 4,
          }}
        >
          <h3>Answer</h3>
          <p>{answer}</p>
          <h4>Sources</h4>
          <ul>
            {sources.map((s, i) => (
              <li key={i}>
                {s.source} (chunk {s.chunk_index})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

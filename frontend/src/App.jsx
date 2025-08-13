import React, { useState } from "react";
import "./App.css";

function App() {
  const [apiKey, setApiKey] = useState("");
  const [activeTab, setActiveTab] = useState("ask");

  // Ask tab states
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [references, setReferences] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Upload tab states
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");
  
function cleanAnswer(text) {
  if (!text) return "";
  // Remove inline citations like [1], [2]
  let cleaned = text.replace(/\[\d+\]/g, "");
  // Remove everything from "References:" (case-insensitive) till end
  cleaned = cleaned.replace(/References:.*$/is, "").trim();
  return cleaned;
}

  const handleAsk = async () => {
    if (!question.trim() || !apiKey.trim()) return;
    setLoading(true);
    setAnswer("");
    setReferences([]);

    try {
      const response = await fetch("/ask", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-API-KEY": apiKey  // <-- changed here
        },
        body: JSON.stringify({ question }),
      });

      if (!response.ok) {
        setAnswer(`Error: ${response.status} ${response.statusText}`);
        return;
      }

      const data = await response.json();
      setAnswer(data.answer || "No answer found.");
      setReferences(data.references || []);
    } catch (error) {
      console.error(error);
      setAnswer("Error retrieving answer.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async () => {
    if (!file || !apiKey.trim()) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/upload_excel", {
        method: "POST",
        headers: { "X-API-KEY": apiKey },  // <-- changed here
        body: formData
      });

      if (!res.ok) {
        setUploadStatus(`Error: ${res.status} ${res.statusText}`);
        return;
      }

      const result = await res.json();
      setUploadStatus(result.message || "File uploaded successfully!");
    } catch (err) {
      console.error(err);
      setUploadStatus("Upload failed.");
    }
  };
 

  return (
    <div className="app-container">
      <header className="app-header">Knowledge Base Assistant</header>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={activeTab === "ask" ? "tab active" : "tab"}
          onClick={() => setActiveTab("ask")}
        >
          Ask
        </button>
        <button
          className={activeTab === "upload" ? "tab active" : "tab"}
          onClick={() => setActiveTab("upload")}
        >
          Upload Excel
        </button>
      </div>

      <div className="app-content">
        {/* API key input */}
        <input
          type="password"
          className="api-key-input"
          placeholder="Enter API key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />

        {/* ASK TAB */}
        {activeTab === "ask" && (
          <>
            <textarea
              className="question-input"
              placeholder="Type your question..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <button
              className="ask-button"
              onClick={handleAsk}
              disabled={loading || !apiKey.trim()}
            >
              {loading ? "Asking…" : "Ask"}
            </button>
            <div className="answer-box">
              <h2>Answer</h2>
              <div style={{ whiteSpace: "pre-wrap", lineHeight: "1.5" }}>
                {cleanAnswer(answer)}
              </div>
            </div>

            {references.length > 0 && (
              <div className="references-box">
                <h3>References</h3>
                <ul>
                  {references.map((ref, idx) => (
                    <li key={idx}>{ref}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {/* UPLOAD TAB */}
        {activeTab === "upload" && (
          <>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files[0])}
              className="file-input"
            />
            <button
              className="upload-button"
              onClick={handleFileUpload}
              disabled={!file || !apiKey.trim()}
            >
              Upload
            </button>
            {uploadStatus && (
              <div className="upload-status">{uploadStatus}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;

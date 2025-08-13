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

  // Upload tab states
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);
  
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
          "X-API-KEY": apiKey
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

  const downloadResults = () => {
    if (!uploadResults || !uploadResults.results) return;
    
    // Create CSV content
    const csvRows = [];
    csvRows.push(['Question', 'Answer', 'References']); // Header
    
    uploadResults.results.forEach(result => {
      const question = result.question || '';
      const answer = cleanAnswer(result.answer) || '';
      const references = Array.isArray(result.references) ? result.references.join('; ') : '';
      
      // Escape quotes and wrap fields with commas/quotes in quotes
      const escapeCsvField = (field) => {
        if (field.includes(',') || field.includes('"') || field.includes('\n')) {
          return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
      };
      
      csvRows.push([
        escapeCsvField(question),
        escapeCsvField(answer),
        escapeCsvField(references)
      ]);
    });
    
    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'answered_questions.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = async () => {
    if (!file || !apiKey.trim()) return;

    setUploading(true);
    setUploadStatus("");
    setUploadResults(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/upload_excel", {
        method: "POST",
        headers: { "X-API-KEY": apiKey },
        body: formData
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        setUploadStatus(`Error: ${errorData.error || `${res.status} ${res.statusText}`}`);
        return;
      }

      const result = await res.json();
      
      if (result.results && Array.isArray(result.results)) {
        setUploadResults(result);
        setUploadStatus(`Successfully processed ${result.results.length} questions!`);
      } else {
        setUploadStatus("File uploaded successfully, but no results returned.");
      }
    } catch (err) {
      console.error(err);
      setUploadStatus("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <div className="logo-container">
            <svg width="120" height="23" viewBox="0 0 686 133" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M338.71 46.0105C359.65 46.0105 368.94 57.5205 368.94 78.0105C368.94 98.0105 358.94 110.28 338.83 110.28C318.17 110.28 308.83 98.2805 308.83 78.0105C308.85 57.5805 317.45 46.0105 338.71 46.0105ZM308.37 48.5305V60.1105C300.698 59.0341 292.91 59.0779 285.25 60.2405V108.52H270V53.7105C273.31 51.3405 281 48.8305 285.89 47.6305C292.2 46.1105 302.87 45.1105 308.37 48.5305ZM213.72 80.9305V108.5H197.34V28.1805H231.34C248.88 28.1805 260.84 35.6805 260.84 53.9505C260.84 72.2205 249.13 80.9505 231.34 80.9505L213.72 80.9305ZM499.11 69.7305V108.5H483.82V72.3805C483.82 63.8005 479.77 59.1305 471.17 59.1305C466.891 59.1903 462.7 60.3509 459 62.5005L458.76 108.5H443.6V23.0005H459V51.0005C464.341 48.0105 470.34 46.3921 476.46 46.2905C491.64 46.2505 499.11 54.3105 499.11 69.7305ZM407.59 110.19C403.27 110.19 396.59 109.19 392.42 106.99V131.5H377.37V60.1105C377.302 57.7245 378.142 55.4016 379.72 53.6105C385.23 47.3905 396.93 46.0205 405.06 46.0205C416.01 46.0205 425.74 49.4605 431.13 59.3305C433.743 64.1105 435.05 70.6738 435.05 79.0205C435.05 96.5205 426.18 110.19 407.59 110.19V110.19ZM600.5 46.2505C607.018 46.2177 613.478 47.4857 619.5 49.9805V63.3405C614.04 61.0005 608.77 59.2505 602.88 59.2505C591.02 59.2505 584.94 64.9505 584.94 77.1905C584.94 90.3405 590.2 96.7005 603.48 96.7005C609.18 96.7005 614.75 94.8005 619.62 92.3705V105.61C613.708 108.495 607.197 109.941 600.62 109.83C588.46 109.83 577.32 104.83 572.33 93.0305C570.538 88.4917 569.677 83.6387 569.8 78.7605C569.8 68.9805 572.17 59.9505 578.8 53.7605C584.67 48.3505 592.53 46.2505 600.5 46.2505ZM540.9 97.3005C547.9 97.3005 553.48 95.3005 559.56 92.6105V106.21C552.651 109.044 545.237 110.439 537.77 110.31C518.77 110.31 507.66 97.8405 507.66 78.7605C507.66 58.9705 517.02 46.0105 536.92 46.0105C558.65 46.0105 564.71 62.4205 564.5 81.8905H523.16C524.31 92.1105 530.1 97.3005 540.9 97.3005ZM686 47.8105L661.56 110.81C657.56 121.22 650.8 132 639.4 132C636.186 131.98 633.004 131.37 630.01 130.2V117.41C636.83 119.85 642.71 119.41 646.14 111.93C646.707 110.671 647.178 109.371 647.55 108.04L623 47.8105H640.46L655.21 90.3405L669.72 47.8105H686ZM213.72 67.6805H229.25C238.31 67.6805 243.34 63.9105 243.34 54.8005C243.34 45.6905 238.6 41.3105 229.25 41.3105H213.72V67.6805ZM403.86 97.6805C415.86 97.6805 419.63 89.8405 419.63 78.5405C419.63 67.5905 416.95 59.0305 404.46 59.0305C400.31 59.0305 392.46 59.5505 392.46 63.6105V94.6705C395.948 96.61 399.869 97.6383 403.86 97.6605V97.6805ZM338.71 97.8105C350.42 97.8105 353.76 88.4805 353.76 78.0605C353.76 66.8705 350.76 58.4305 338.71 58.4305C326.66 58.4305 324 67.1105 324 78.0405C324 88.9705 327.15 97.7905 338.71 97.7905V97.8105ZM523.32 71.5505H549.16C548.21 63.2405 545.16 58.0705 536.32 58.0705C527.9 58.0505 524.35 63.5705 523.32 71.5305V71.5505Z" fill="#1E1E5A"/>
              <path fillRule="evenodd" clipRule="evenodd" d="M1.4 71.2105L33.7 127.211C34.4545 128.505 35.4774 129.624 36.7 130.491C36.8977 114.545 39.5972 98.729 44.7 83.6205C29.0221 80.4641 13.9379 74.8624 0 67.0205C0.159065 68.5018 0.636653 69.9311 1.4 71.2105Z" fill="#4E55BA"/>
              <path fillRule="evenodd" clipRule="evenodd" d="M44.61 83.5703C39.5071 98.6753 36.8076 114.488 36.61 130.43C38.3289 131.634 40.3814 132.271 42.48 132.25H107.08C109.177 132.269 111.228 131.637 112.95 130.44C112.753 114.495 110.054 98.6786 104.95 83.5703C85.0364 87.5795 64.5235 87.5795 44.61 83.5703Z" fill="#626AE9"/>
              <path fillRule="evenodd" clipRule="evenodd" d="M44.61 83.5702C64.5528 87.5902 85.0972 87.5902 105.04 83.5702C98.5492 64.2898 88.2752 46.4988 74.82 31.2402C61.3677 46.4992 51.097 64.2902 44.61 83.5702V83.5702Z" fill="#06B6D4"/>
              <path fillRule="evenodd" clipRule="evenodd" d="M74.8201 31.2404C88.2651 46.4995 98.526 64.291 105 83.5704C120.63 80.4167 135.67 74.8322 149.57 67.0204C149.759 64.9272 149.283 62.8278 148.21 61.0204L115.94 5.11042C114.913 3.27798 113.335 1.81548 111.43 0.93042C97.7191 9.06046 85.3661 19.2877 74.8201 31.2404V31.2404Z" fill="#FD9743"/>
              <path fillRule="evenodd" clipRule="evenodd" d="M149.6 67.0205C135.69 74.8352 120.641 80.4198 105 83.5705C110.103 98.679 112.802 114.495 113 130.441C114.205 129.568 115.21 128.45 115.95 127.161L148.25 71.1605C148.993 69.894 149.454 68.4817 149.6 67.0205V67.0205Z" fill="#D77131"/>
              <path fillRule="evenodd" clipRule="evenodd" d="M74.82 31.2404C85.3622 19.2809 97.7158 9.04983 111.43 0.920407C110.078 0.301155 108.607 -0.0129419 107.12 0.000408415H42.52C41.0344 -0.0112461 39.564 0.299218 38.21 0.910412C51.9223 9.04653 64.2754 19.2806 74.82 31.2404V31.2404Z" fill="#FD7934"/>
              <path fillRule="evenodd" clipRule="evenodd" d="M74.82 31.2404C64.2778 19.2809 51.9242 9.04984 38.21 0.92041C36.3058 1.8115 34.7286 3.27679 33.7 5.11041L1.40003 61.0304C0.332523 62.8398 -0.142964 64.9376 0.04003 67.0304C13.9386 74.8466 28.9785 80.4313 44.61 83.5804C51.0919 64.2951 61.3631 46.4998 74.82 31.2404V31.2404Z" fill="#059BB4"/>
            </svg>
          </div>
          <h1 className="app-title">RFP Bot</h1>
        </div>
      </header>

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
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFile(e.target.files[0])}
              className="file-input"
              disabled={uploading}
            />
            <button
              className="upload-button"
              onClick={handleFileUpload}
              disabled={!file || !apiKey.trim() || uploading}
            >
              {uploading ? "Uploading..." : "Upload & Process"}
            </button>
            
            {uploadStatus && (
              <div className="upload-status">{uploadStatus}</div>
            )}

            {uploadResults && uploadResults.results && (
              <div className="results-section">
                <div className="results-header">
                  <h3>Processing Complete!</h3>
                  <p>Processed {uploadResults.results.length} questions</p>
                  <button 
                    className="download-button"
                    onClick={downloadResults}
                  >
                    Download Results (CSV)
                  </button>
                </div>
                
                <div className="results-preview">
                  <h4>Preview (first 3 results):</h4>
                  {uploadResults.results.slice(0, 3).map((result, idx) => (
                    <div key={idx} className="result-item">
                      <div className="result-question">
                        <strong>Q{idx + 1}:</strong> {result.question}
                      </div>
                      <div className="result-answer">
                        <strong>Answer:</strong> {cleanAnswer(result.answer)}
                      </div>
                      {result.references && result.references.length > 0 && (
                        <div className="result-refs">
                          <strong>References:</strong> {result.references.join('; ')}
                        </div>
                      )}
                    </div>
                  ))}
                  {uploadResults.results.length > 3 && (
                    <p className="more-results">
                      ...and {uploadResults.results.length - 3} more results. 
                      Download the CSV to see all results.
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
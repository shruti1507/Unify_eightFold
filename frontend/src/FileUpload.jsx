import React, { useState } from 'react';

export default function FileUpload({ title, description, onDataChanged }) {
  const [active, setActive] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('upload'); // 'upload' or 'paste'
  const [pasteValue, setPasteValue] = useState('');

  const processFile = (file) => {
    if (!file) return;
    
    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      setError('Must be a JSON file');
      return;
    }
    
    setError(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      onDataChanged(e.target.result);
    };
    reader.readAsText(file);
  };

  const handlePasteChange = (e) => {
    const val = e.target.value;
    setPasteValue(val);
    setFileName(val.trim() ? 'Pasted Data' : null);
    onDataChanged(val);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (mode !== 'upload') return;
    setActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (mode === 'upload') setActive(true);
  };

  const handleDragLeave = () => {
    setActive(false);
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  let className = "upload-card";
  if (active) className += " active";
  else if (fileName && !error) className += " has-file";

  return (
    <div className="upload-container">
      <div className="mode-toggle">
        <button 
          className={`toggle-btn ${mode === 'upload' ? 'active' : ''}`}
          onClick={() => setMode('upload')}
        >Upload File</button>
        <button 
          className={`toggle-btn ${mode === 'paste' ? 'active' : ''}`}
          onClick={() => setMode('paste')}
        >Paste JSON</button>
      </div>

      <div 
        className={className}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {mode === 'upload' ? (
          <>
            <input type="file" accept=".json" onChange={handleChange} />
            <h3>{title}</h3>
            {error ? (
              <p className="error-text">{error}</p>
            ) : fileName ? (
              <p className="success-text">{fileName}</p>
            ) : (
              <p>{description}</p>
            )}
          </>
        ) : (
          <div className="paste-area">
            <h3>{title}</h3>
            <textarea 
              placeholder="Paste JSON here..."
              value={pasteValue}
              onChange={handlePasteChange}
            />
            {fileName === 'Pasted Data' && !error && <p className="success-text">Raw data captured.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

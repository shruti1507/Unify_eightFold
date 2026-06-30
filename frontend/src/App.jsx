import React, { useState } from 'react';
import FileUpload from './FileUpload';
import JsonViewer from './JsonViewer';

import { ATSAdapter } from './core/adapters/ats';
import { GitHubAdapter } from './core/adapters/github';
import { Merger } from './core/engine/merger';
import { Projector } from './core/engine/projector';

export default function App() {
  const [atsRaw, setAtsRaw] = useState('');
  const [githubRaw, setGithubRaw] = useState('');
  const [configRaw, setConfigRaw] = useState('');
  
  const [defaultOutput, setDefaultOutput] = useState(null);
  const [customOutput, setCustomOutput] = useState(null);
  const [error, setError] = useState(null);

  const handleTransform = () => {
    setError(null);
    setDefaultOutput(null);
    setCustomOutput(null);
    
    try {
      if (!atsRaw.trim() && !githubRaw.trim()) {
        throw new Error('Please provide ATS or GitHub data.');
      }
      if (!configRaw.trim()) {
        throw new Error('Please provide the Runtime Config.');
      }

      let atsData = null;
      let githubData = null;
      let configData = null;

      try {
        if (atsRaw.trim()) atsData = JSON.parse(atsRaw);
      } catch(e) { throw new Error('Invalid JSON in ATS input.'); }
      
      try {
        if (githubRaw.trim()) githubData = JSON.parse(githubRaw);
      } catch(e) { throw new Error('Invalid JSON in GitHub input.'); }
      
      try {
        configData = JSON.parse(configRaw);
      } catch(e) { throw new Error('Invalid JSON in Runtime Config input.'); }

      const extractedRecords = [];
      const atsAdapter = new ATSAdapter();
      const githubAdapter = new GitHubAdapter();

      const atsArr = Array.isArray(atsData) ? atsData : (atsData ? [atsData] : []);
      const githubArr = Array.isArray(githubData) ? githubData : (githubData ? [githubData] : []);

      for (const raw of atsArr) {
        const parsed = atsAdapter.parse(raw);
        if (parsed) {
          extractedRecords.push({ source: atsAdapter.sourceName, confidence: atsAdapter.baseConfidence, data: parsed });
        }
      }

      for (const raw of githubArr) {
        const parsed = githubAdapter.parse(raw);
        if (parsed) {
          extractedRecords.push({ source: githubAdapter.sourceName, confidence: githubAdapter.baseConfidence, data: parsed });
        }
      }

      if (extractedRecords.length === 0) {
        throw new Error('No valid records extracted from input files.');
      }

      const runtimeConfig = configData || {};
      const goldenRecords = Merger.merge(extractedRecords, runtimeConfig);
      
      const customRes = [];
      const defaultRes = [];


      for (const record of goldenRecords) {
        try {
          const res = Projector.project(record, runtimeConfig);
          if (res) customRes.push(res);
        } catch (e) {
          console.warn(`Failed custom projection for candidate: ${e.message}`);
        }
        
        try {
          const res = Projector.project(record, {});
          if (res) defaultRes.push(res);
        } catch (e) {
          console.warn(`Failed default projection for candidate: ${e.message}`);
        }
      }

      if (customRes.length === 1) {
        setCustomOutput(customRes[0]);
        setDefaultOutput(defaultRes[0]);
      } else {
        setCustomOutput(customRes);
        setDefaultOutput(defaultRes);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const isReady = (atsRaw.trim() || githubRaw.trim()) && configRaw.trim();

  return (
    <div className="app-container">
      <header className="header">
        <h1>Unify</h1>
        <p className="description" style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginTop: '0.5rem' }}>
          Merge your ATS and GitHub candidate profiles securely.
        </p>
      </header>

      {error && <div className="error-message">ERROR: {error}</div>}

      <div className="upload-grid">
        <FileUpload 
          title="ATS Input" 
          description="Drag ATS JSON here" 
          onDataChanged={setAtsRaw}
        />
        <FileUpload 
          title="GitHub Input" 
          description="Drag GitHub JSON here" 
          onDataChanged={setGithubRaw}
        />
        <FileUpload 
          title="Runtime Config" 
          description="Drag Config JSON here" 
          onDataChanged={setConfigRaw}
        />
      </div>

      <div className="action-bar">
        <button 
          className="btn" 
          onClick={handleTransform}
          disabled={!isReady}
        >
          {isReady ? 'Unify' : 'Awaiting Inputs'}
        </button>
      </div>

      {(defaultOutput || customOutput) && (
        <div className="results-section">
          <div className="results-grid">
            <JsonViewer 
              title="Raw Profile (Default)" 
              data={defaultOutput} 
              filename="default_output.json"
            />
            <JsonViewer 
              title="Synthesized Output" 
              data={customOutput} 
              filename="custom_output.json"
            />
          </div>
        </div>
      )}
    </div>
  );
}

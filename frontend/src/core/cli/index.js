import fs from 'fs';
import path from 'path';
import { Logger } from '../utils/logger.js';
import { ATSAdapter } from '../adapters/ats.js';
import { GitHubAdapter } from '../adapters/github.js';
import { Merger } from '../engine/merger.js';
import { Projector } from '../engine/projector.js';

async function main() {
  try {
    const args = process.argv.slice(2);
    
    // Default paths if not provided
    const atsPath = args[0] || path.resolve('mocks/ats_input.json');
    const githubPath = args[1] || path.resolve('mocks/github_input.json');
    const configPath = args[2] || path.resolve('mocks/runtime_config.json');
    const outputPath = args[3] || path.resolve('output.json');

    Logger.info(`Starting Candidate Data Transformer...`);
    Logger.info(`ATS input: ${atsPath}`);
    Logger.info(`GitHub input: ${githubPath}`);
    Logger.info(`Config: ${configPath}`);

    // Load files safely
    let atsData = [];
    let githubData = [];
    let config = {};

    try {
      if (fs.existsSync(atsPath)) {
        let parsed = JSON.parse(fs.readFileSync(atsPath, 'utf8'));
        atsData = Array.isArray(parsed) ? parsed : [parsed];
      } else {
        Logger.warn(`ATS input file not found: ${atsPath}`);
      }
    } catch (e) {
      Logger.warn(`Failed to parse ATS data: ${e.message}`);
    }

    try {
      if (fs.existsSync(githubPath)) {
        let parsed = JSON.parse(fs.readFileSync(githubPath, 'utf8'));
        githubData = Array.isArray(parsed) ? parsed : [parsed];
      } else {
        Logger.warn(`GitHub input file not found: ${githubPath}`);
      }
    } catch (e) {
      Logger.warn(`Failed to parse GitHub data: ${e.message}`);
    }

    try {
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } else {
        throw new Error(`Config file not found: ${configPath}`);
      }
    } catch (e) {
      Logger.error(`Failed to load config: ${e.message}`);
      process.exit(1);
    }

    // Process records
    const extractedRecords = [];
    const atsAdapter = new ATSAdapter();
    const githubAdapter = new GitHubAdapter();

    for (const raw of atsData) {
      const parsed = atsAdapter.parse(raw);
      if (parsed) {
        extractedRecords.push({ source: atsAdapter.sourceName, confidence: atsAdapter.baseConfidence, data: parsed });
      }
    }

    for (const raw of githubData) {
      const parsed = githubAdapter.parse(raw);
      if (parsed) {
        extractedRecords.push({ source: githubAdapter.sourceName, confidence: githubAdapter.baseConfidence, data: parsed });
      }
    }

    Logger.info(`Extracted ${extractedRecords.length} total source records.`);

    // Merge
    const goldenRecords = Merger.merge(extractedRecords);
    Logger.info(`Merged into ${goldenRecords.length} golden candidate records.`);

    // Project Custom Config
    const customOutput = [];
    for (const record of goldenRecords) {
      try {
        const projected = Projector.project(record, config);
        customOutput.push(projected);
      } catch (e) {
        Logger.error(`Candidate ${record.candidate_id} failed custom projection: ${e.message}. Skipping...`);
      }
    }

    // Project Default Schema
    const defaultOutput = [];
    for (const record of goldenRecords) {
      try {
        const projected = Projector.project(record, {}); // empty config uses default schema
        defaultOutput.push(projected);
      } catch (e) {
        Logger.error(`Candidate ${record.candidate_id} failed default projection: ${e.message}. Skipping...`);
      }
    }

    // Save outputs
    fs.writeFileSync('custom_output.json', JSON.stringify(customOutput, null, 2));
    Logger.info(`Successfully wrote ${customOutput.length} profiles to custom_output.json`);

    fs.writeFileSync('default_output.json', JSON.stringify(defaultOutput, null, 2));
    Logger.info(`Successfully wrote ${defaultOutput.length} profiles to default_output.json`);
    
  } catch (err) {
    Logger.error(`Pipeline failed: ${err.message}`);
    process.exit(1);
  }
}

main();

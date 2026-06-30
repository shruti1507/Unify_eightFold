import { Logger } from '../utils/logger.js';
import { get } from '../utils/get.js';

export class Merger {
  /**
   * Resolve identities and merge records
   * @param {Array<{source: string, confidence: number, data: Object}>} extractedRecords 
   */
  static merge(extractedRecords, config = {}) {
    const confidenceWeights = config.confidence_weights || {};

    if (!extractedRecords || extractedRecords.length === 0) return [];

    // Step 1: Entity Resolution (Cascading Grouping)
    const profiles = this.groupRecords(extractedRecords);

    // Step 2: Confidence-Weighted Merge
    const goldenRecords = profiles.map((profileRecords, idx) => {
      const candidate_id = `cand_${idx + 1}`;
      
      // Override confidence if specified in config
      for (const record of profileRecords) {
        if (confidenceWeights[record.source.toLowerCase()] !== undefined) {
          record.confidence = confidenceWeights[record.source.toLowerCase()];
        }
      }

      return this.mergeProfile(candidate_id, profileRecords, config);
    });

    return goldenRecords;
  }

  static groupRecords(records) {
    const normalizePhone = (p) => typeof p === 'string' ? p.replace(/\D/g, '') : '';
    const normalizeCompany = (c) => typeof c === 'string' ? c.replace(/[^a-z0-9]/gi, '').replace(/(inc|llc|ltd|corp)$/i, '').trim().toLowerCase() : '';
    const normalizeName = (n) => typeof n === 'string' ? n.toLowerCase().trim() : '';
  
    const getCompanies = (r) => {
      const comps = [];
      if (r.data.experience) {
         const exps = Array.isArray(r.data.experience) ? r.data.experience : [r.data.experience];
         exps.forEach(e => { if (e && e.company) comps.push(normalizeCompany(e.company)); });
      }
      return comps.filter(Boolean);
    };

    const isMatch = (r1, r2) => {
      // 1. Email Match
      const e1 = Array.isArray(r1.data.email) ? r1.data.email : [r1.data.email];
      const e2 = Array.isArray(r2.data.email) ? r2.data.email : [r2.data.email];
      const emails1 = e1.filter(Boolean).map(e => String(e).toLowerCase());
      const emails2 = e2.filter(Boolean).map(e => String(e).toLowerCase());
      if (emails1.length && emails2.length && emails1.some(e => emails2.includes(e))) return true;
  
      // 2. Phone Match
      const p1 = Array.isArray(r1.data.phone) ? r1.data.phone : [r1.data.phone];
      const p2 = Array.isArray(r2.data.phone) ? r2.data.phone : [r2.data.phone];
      const phones1 = p1.filter(Boolean).map(normalizePhone).filter(Boolean);
      const phones2 = p2.filter(Boolean).map(normalizePhone).filter(Boolean);
      if (phones1.length && phones2.length && phones1.some(p => phones2.includes(p))) return true;
  
      // 3. Name AND Company Match
      const n1 = normalizeName(r1.data.name);
      const n2 = normalizeName(r2.data.name);
      const c1 = getCompanies(r1);
      const c2 = getCompanies(r2);
  
      if (n1 && n2 && n1 === n2 && c1.length && c2.length && c1.some(c => c2.includes(c))) {
        return true;
      }
  
      return false;
    };

    const profiles = []; 

    for (const record of records) {
      if (!record.data) continue;

      const connectedIndices = [];
      for (let i = 0; i < profiles.length; i++) {
        const group = profiles[i];
        if (group.some(r => isMatch(record, r))) {
          connectedIndices.push(i);
        }
      }

      if (connectedIndices.length === 0) {
        profiles.push([record]);
      } else {
        const primaryIndex = connectedIndices[0];
        profiles[primaryIndex].push(record);

        // Merge any other connected components
        for (let i = connectedIndices.length - 1; i > 0; i--) {
          const idxToMerge = connectedIndices[i];
          profiles[primaryIndex].push(...profiles[idxToMerge]);
          profiles.splice(idxToMerge, 1);
        }
      }
    }
    
    return profiles;
  }

  static mergeProfile(candidate_id, profileRecords, config = {}) {
    const goldenRecord = {
      candidate_id,
      provenance: [],
      overall_confidence: 0
    };

    if (!profileRecords || profileRecords.length === 0) return goldenRecord;

    // Discover all unique keys across all records
    const allKeys = new Set();
    profileRecords.forEach(record => {
      if (record.data) {
        Object.keys(record.data).forEach(k => allKeys.add(k));
      }
    });

    let totalConfidence = 0;
    
    // Calculate overall confidence based on max confidence seen
    profileRecords.forEach(record => {
      if (record.confidence > totalConfidence) {
        totalConfidence = record.confidence;
      }
    });
    goldenRecord.overall_confidence = totalConfidence;

    // Array fields that must always be combined
    const FORCE_ARRAY_FIELDS = ['email', 'phone', 'skills'];

    // Dynamically merge every field
    for (const key of allKeys) {
      let isArray = FORCE_ARRAY_FIELDS.includes(key);
      let highestConf = -1;
      
      const isEmpty = (v) => {
        if (v === undefined || v === null) return true;
        if (typeof v === 'string' && v.trim() === '') return true;
        if (Array.isArray(v) && v.length === 0) return true;
        if (typeof v === 'object' && Object.keys(v).length === 0) return true;
        // Check for nested empty structures like [{}]
        if (Array.isArray(v) && v.length === 1 && typeof v[0] === 'object' && Object.keys(v[0]).length === 0) return true;
        return false;
      };

      for (const record of profileRecords) {
        const val = record.data[key];
        if (!isEmpty(val)) {
          if (record.confidence > highestConf) {
            highestConf = record.confidence;
            if (!FORCE_ARRAY_FIELDS.includes(key)) {
              isArray = Array.isArray(val);
            }
          }
        }
      }

      if (isArray) {
        let mergedArr = [];
        let sources = [];
        profileRecords.forEach(record => {
          const val = record.data[key];
          if (val !== undefined && val !== null && val !== '') {
            const arr = Array.isArray(val) ? val : [val];
            if (arr.length > 0) {
              mergedArr.push(...arr);
              if (!sources.includes(record.source)) sources.push(record.source);
            }
          }
        });
        
        const unique = [];
        const seen = new Set();
        for (const item of mergedArr) {
          const s = typeof item === 'object' ? JSON.stringify(item) : String(item).trim().toLowerCase();
          if (!seen.has(s)) {
            seen.add(s);
            unique.push(item);
          }
        }

        goldenRecord[key] = unique;
        
        if (unique.length > 0) {
          // Attribute provenance to all sources that contributed
          goldenRecord.provenance.push({
            field: `${key}[]`,
            source: sources.join(','),
            confidence: highestConf // Using max confidence seen across all elements for simplicity
          });
        }
      } else {
        // 1. Filter out any sources where the field's value is null, undefined, or an empty string ""
        const validRecords = profileRecords.filter(record => {
          const val = record.data[key];
          return val !== null && val !== undefined && val !== '';
        });

        let bestVal = null;
        let bestSource = null;
        let maxConf = -1;
        
        // 2. Compare confidence scores for the remaining valid records
        for (const record of validRecords) {
          if (record.confidence > maxConf) {
            maxConf = record.confidence;
            bestVal = record.data[key];
            bestSource = record.source;
          }
        }

        if (bestVal !== null) {
          goldenRecord[key] = bestVal;
          goldenRecord.provenance.push({
            field: key,
            source: bestSource,
            confidence: maxConf
          });
        }
      }
    }

    // Explicitly resolve deep paths from config to fix the null overwrite bug on nested arrays (like experience[0].company)
    const fieldsConfig = config?.output_schema?.fields || config?.fields || [];
    for (const fieldDef of fieldsConfig) {
      const internalPath = fieldDef.internal_path || fieldDef.from;
      if (!internalPath || FORCE_ARRAY_FIELDS.includes(internalPath)) continue;

      // 1. Map to extract the values and their source confidence using get()
      const extracted = profileRecords.map(record => ({
         value: get(record.data, internalPath),
         source: record.source,
         confidence: record.confidence
      }));

      // 2. CRITICAL FIX: Filter out null, undefined, or empty strings FIRST
      const validEntries = extracted.filter(entry => 
        entry.value !== null && 
        entry.value !== undefined && 
        entry.value !== "" &&
        !(typeof entry.value === 'object' && Object.keys(entry.value).length === 0)
      );

      // 3. If nothing is left, we skip overriding
      if (validEntries.length > 0) {
        // 4. Sort the REMAINING valid entries by confidence (highest first)
        validEntries.sort((a, b) => b.confidence - a.confidence);

        // 5. The winner is now guaranteed to be the highest confidence non-null value
        const winner = validEntries[0];
        
        goldenRecord[internalPath] = winner.value;
        
        // Update provenance for this specific deep path
        const existingProvIdx = goldenRecord.provenance.findIndex(p => p.field === internalPath);
        if (existingProvIdx >= 0) {
          goldenRecord.provenance[existingProvIdx] = { field: internalPath, source: winner.source, confidence: winner.confidence };
        } else {
          goldenRecord.provenance.push({ field: internalPath, source: winner.source, confidence: winner.confidence });
        }
      }
    }

    return goldenRecord;
  }
}

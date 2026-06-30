import { Logger } from '../utils/logger.js';
import { get } from '../utils/get.js';
import { Normalizer } from './normalizer.js';

export class Projector {
  /**
   * Universal dynamic projection.
   * Maps fields based purely on output_schema configuration.
   */
  static project(goldenRecord, config) {
    const outputSchema = config.output_schema || config || {};
    const fieldsConfig = outputSchema.fields || config.fields || [];
    const includeProvenance = outputSchema.include_provenance !== false;

    const output = {};

    if (fieldsConfig.length === 0) {
      // Remove internal tracking fields when returning raw record
      const { provenance, overall_confidence, candidate_id, ...raw } = goldenRecord;
      return raw;
    }

    const rootProvenance = [];

    for (const fieldDef of fieldsConfig) {
      const targetKey = fieldDef.target_key || fieldDef.path;
      const internalPath = fieldDef.internal_path || fieldDef.from;
      const onMissing = fieldDef.on_missing || 'return_null';
      const normalizerName = fieldDef.normalizer || fieldDef.normalize;

      if (!targetKey || !internalPath) continue;

      let rawValue = goldenRecord[internalPath];
      if (rawValue === undefined) {
        rawValue = get(goldenRecord, internalPath);
      }
      
      let value = Normalizer.apply(rawValue, normalizerName);

      const isMissing = value === null || value === undefined || (Array.isArray(value) && value.length === 0) || value === '';

      if (isMissing) {
        if (onMissing === 'error') {
          Logger.warn(`Missing required field: ${targetKey} (from ${internalPath}). Aborting candidate.`);
          return null;
        } else if (onMissing === 'omit') {
          continue;
        } else {
          value = null;
        }
      }

      output[targetKey] = value;

      // Construct provenance
      if (includeProvenance && value !== null && value !== undefined) {
        const baseField = internalPath.split('[')[0].split('.')[0];
        const provEntry = goldenRecord.provenance.find(p => p.field.replace('[]', '').split('.')[0] === baseField);
        
        if (provEntry) {
          rootProvenance.push({
            field: targetKey,
            source: provEntry.source,
            confidence: provEntry.confidence
          });
        } else {
          rootProvenance.push({
            field: targetKey,
            source: 'multiple',
            confidence: goldenRecord.overall_confidence
          });
        }
      }
    }

    if (includeProvenance && rootProvenance.length > 0) {
      output.provenance = rootProvenance;
    }

    return output;
  }
}

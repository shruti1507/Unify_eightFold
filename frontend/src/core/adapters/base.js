export class BaseAdapter {
  constructor(sourceName, baseConfidence) {
    this.sourceName = sourceName;
    this.baseConfidence = baseConfidence;
  }

  /**
   * Parse raw data into internal canonical structure
   * @param {Object} rawData 
   * @returns {Object} Canonical object
   */
  parse(rawData) {
    throw new Error('Not implemented');
  }

  /**
   * Create an empty canonical record template
   */
  createEmptyRecord() {
    return {
      full_name: null,
      emails: [],
      phones: [],
      location: null,
      links: {},
      headline: null,
      years_experience: null,
      skills: [],
      experience: [],
      education: []
    };
  }
}

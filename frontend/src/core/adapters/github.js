import { BaseAdapter } from './base.js';
import { Normalizer } from '../engine/normalizer.js';
import { Logger } from '../utils/logger.js';

export class GitHubAdapter extends BaseAdapter {
  constructor() {
    super('GitHub', 0.7);
  }

  parse(rawData) {
    try {
      const record = {
        name: null,
        email: null,
        phone: null,
        location: null,
        experience: [],
        education: [],
        skills: [],
        links: {
          github: null,
          portfolio: null,
          other: []
        }
      };
      
      if (rawData.name) record.name = rawData.name;
      
      if (rawData.email) {
        record.email = rawData.email;
      }
      
      record.headline = rawData.bio || null;
      
      if (rawData.location) {
        // Simple location split "SF, CA"
        const parts = rawData.location.split(',').map(s => s.trim());
        record.location = {
          city: parts[0] || null,
          region: parts.length > 1 ? parts[1] : null,
          country: null // Not provided reliably in github location
        };
      }

      if (rawData.login) {
        record.links.github = `https://github.com/${rawData.login}`;
      }
      if (rawData.blog) {
        record.links.portfolio = rawData.blog;
      }

      // We'll treat repos as experience or just skip for now as per schema it's hard to map exactly
      // but maybe we can map them to skills?
      // Wait, we have languages for skills.
      const langs = rawData.languages || rawData.languages_extracted;
      if (langs) {
        if (Array.isArray(langs)) {
          record.skills = langs.filter(Boolean);
        } else if (typeof langs === 'string') {
          record.skills = langs.split(',').map(s => s.trim()).filter(Boolean);
        }
      }

      if (rawData.company) {
        record.experience = [{ company: rawData.company.replace(/^@/, '') }];
      }

      // If we want to capture repos, maybe map to links.other
      if (Array.isArray(rawData.repos)) {
        const repoLinks = rawData.repos.map(r => `https://github.com/${rawData.login}/${r.name}`);
        record.links.other = repoLinks;
      }

      return record;
    } catch (e) {
      Logger.error(`Error parsing GitHub data: ${e.message}`);
      return null;
    }
  }
}

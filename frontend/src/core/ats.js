import { BaseAdapter } from './base.js';
import { Normalizer } from '../engine/normalizer.js';
import { Logger } from '../utils/logger.js';

export class ATSAdapter extends BaseAdapter {
  constructor() {
    super('ATS', 0.9);
  }

  parse(rawData) {
    try {
      const record = this.createEmptyRecord();
      
      if (rawData.contact_info) {
        record.full_name = rawData.contact_info.name || rawData.contact_info.first_and_last_name || null;
        if (rawData.contact_info.email_address || rawData.contact_info.primary_email) {
          record.emails.push(rawData.contact_info.email_address || rawData.contact_info.primary_email);
        }
        if (rawData.contact_info.phone_number || rawData.contact_info.mobile_phone) {
          const normPhone = Normalizer.phone(rawData.contact_info.phone_number || rawData.contact_info.mobile_phone);
          if (normPhone) record.phones.push(normPhone);
        }
        
        if (rawData.contact_info.address) {
          record.location = {
            city: rawData.contact_info.address.city,
            region: rawData.contact_info.address.state,
            country: rawData.contact_info.address.country
          };
        }
      } else {
        if (rawData.first_and_last_name) record.full_name = rawData.first_and_last_name;
      }

      if (!record.full_name && rawData.first_and_last_name) {
        record.full_name = rawData.first_and_last_name;
      }

      const work_history = rawData.work_history || rawData.employment_history;
      if (Array.isArray(work_history)) {
        record.experience = work_history.map(work => ({
          company: work.employer,
          title: work.job_title || work.role_title,
          start: Normalizer.date(work.start_date || work.tenure_start),
          end: Normalizer.date(work.end_date || work.tenure_end),
          summary: work.description || work.duties_summary
        }));
      }

      if (Array.isArray(rawData.education)) {
        record.education = rawData.education.map(edu => ({
          institution: edu.school,
          degree: edu.degree,
          field: edu.major,
          end_year: edu.graduation_year
        }));
      }

      const tags = rawData.tags || rawData.acquired_skills;
      if (Array.isArray(tags)) {
        record.skills = tags.map(tag => Normalizer.skill(tag)).filter(Boolean);
      }

      return record;
    } catch (e) {
      Logger.error(`Error parsing ATS data: ${e.message}`);
      return null;
    }
  }
}

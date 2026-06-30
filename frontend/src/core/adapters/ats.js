import { BaseAdapter } from './base.js';
import { Normalizer } from '../engine/normalizer.js';
import { Logger } from '../utils/logger.js';

export class ATSAdapter extends BaseAdapter {
  constructor() {
    super('ATS', 0.9);
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
        skills: []
      };
      
      if (rawData.contact_info) {
        let nameStr = rawData.contact_info.name || rawData.contact_info.first_and_last_name || null;
        if (!nameStr && (rawData.first_name || rawData.last_name)) {
          nameStr = `${rawData.first_name || ''} ${rawData.last_name || ''}`.trim();
        }
        record.name = nameStr;

        if (rawData.contact_info.email_address || rawData.contact_info.primary_email || rawData.contact_info.email) {
          record.email = rawData.contact_info.email_address || rawData.contact_info.primary_email || rawData.contact_info.email;
        }
        if (rawData.contact_info.phone_number || rawData.contact_info.mobile_phone || rawData.contact_info.mobile) {
          const normPhone = Normalizer.phone(rawData.contact_info.phone_number || rawData.contact_info.mobile_phone || rawData.contact_info.mobile);
          if (normPhone) record.phone = normPhone;
        }
        
        if (rawData.contact_info.address) {
          record.location = {
            city: rawData.contact_info.address.city,
            region: rawData.contact_info.address.state,
            country: rawData.contact_info.address.country
          };
        }
      } else {
        if (rawData.first_and_last_name) record.name = rawData.first_and_last_name;
        if (rawData.first_name || rawData.last_name) record.name = `${rawData.first_name || ''} ${rawData.last_name || ''}`.trim();
      }

      if (!record.name && rawData.first_and_last_name) {
        record.name = rawData.first_and_last_name;
      }
      if (!record.name && (rawData.first_name || rawData.last_name)) {
        record.name = `${rawData.first_name || ''} ${rawData.last_name || ''}`.trim();
      }

      const work_history = rawData.work_history || rawData.employment_history;
      if (Array.isArray(work_history)) {
        record.experience = work_history.map(work => ({
          company: work.employer || work.company_name,
          title: work.job_title || work.role_title || work.role,
          start: Normalizer.date(work.start_date || work.tenure_start || work.start),
          end: Normalizer.date(work.end_date || work.tenure_end || work.end),
          summary: work.description || work.duties_summary
        }));
      }

      if (rawData.technical_skills) {
        if (Array.isArray(rawData.technical_skills)) {
          record.skills = rawData.technical_skills;
        } else if (typeof rawData.technical_skills === 'string') {
          record.skills = rawData.technical_skills.split(',').map(s => s.trim()).filter(Boolean);
        }
      }

      if (Array.isArray(rawData.education)) {
        record.education = rawData.education.map(edu => ({
          institution: edu.school,
          degree: edu.degree,
          field: edu.major,
          end_year: edu.graduation_year
        }));
      }

      const tags = rawData.tags || rawData.acquired_skills || rawData.technical_skills;
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

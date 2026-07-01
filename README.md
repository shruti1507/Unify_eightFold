# Canonical Profile Merging Engine

This project is a React-based application that dynamically ingests candidate data from disparate sources (ATS, GitHub), executes a rigorous Entity Resolution algorithm to ensure the data belongs to the same candidate, and dynamically fuses them into a single "Canonical Profile" based on a provided configuration schema and confidence weights.

## How to Run It

1. Ensure you have Node.js installed on your machine.
2. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
3. Install the required dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open your browser and navigate to `http://localhost:5173` to use the interactive application. You can paste your ATS JSON, GitHub JSON, and Runtime Config JSON into the provided fields and click **Unify** to generate the Canonical Profile.

## Master Test Case: Batch Processing

Instead of processing single candidates, the engine performs batch reconciliation across multiple sources, handling complex identity resolution and conflict scenarios in a single pass.

## Sample Inputs (Batch Master Set)

**ATS Payload (Subset Example):**
```json
[
  {
    "candidate_id": "ats-01",
    "first_name": "Rahul",
    "last_name": "Sharma",
    "contact_info": { "email": "rahul.s@tech.in", "mobile": "+91 98765-43210" },
    "technical_skills": ["REACT", "node.js"]
  },
  {
    "candidate_id": "ats-02",
    "first_name": "Chaos",
    "last_name": "Monkey",
    "contact_info": { "email": "chaos@testing.com", "mobile": "+1 800 555 0199" },
    "technical_skills": "TypeScript, GraphQL"
  }
]
```

**GitHub Payload (Subset Example):**
```json
[
  {
    "login": "rahul-dev",
    "name": "Rahul Sharma",
    "email": "rahul.codes@github.com",
    "company": "@Flipkart"
  },
  {
    "login": "chaos-monkey",
    "name": "Chaos Monkey",
    "email": "chaos@testing.com",
    "company": "Netflix"
  }
]
```

**Runtime Configuration**
```json
{
  "include_provenance": true,
  "fields": [
    {
      "target_key": "full_name",
      "internal_path": "name",
      "on_missing": "error"
    },
    {
      "target_key": "primary_email",
      "internal_path": "email",
      "on_missing": "error"
    },
    {
      "target_key": "phone_number",
      "internal_path": "phone",
      "normalizer": "e164",
      "on_missing": "omit"
    },
    {
      "target_key": "skills",
      "internal_path": "skills",
      "normalizer": "lowercase_dedupe",
      "on_missing": "return_null"
    },
    {
      "target_key": "current_employer",
      "internal_path": "experience[0].company",
      "normalizer": "strip_special_chars",
      "on_missing": "return_null"
    }
  ]
}
```

## Sample Output Produced (Master Dataset)

The engine successfully connects the ATS and GitHub data using a Tier-3 compound match (Name + Normalized Company Name). It unions the email arrays, deduplicates the skills, normalizes the phone number (stripping symbols and spaces), extracts the deep path for `current_employer`, and outputs a flat, strict canonical profile:

```json
[
  {
    "full_name": "Rahul Sharma",
    "primary_email": ["rahul.s@tech.in", "rahul.codes@github.com"],
    "phone_number": "+919876543210",
    "skills": ["react", "node.js"],
    "current_employer": "Flipkart",
    "provenance": [
      { "field": "full_name", "source": "ATS", "confidence": 0.9 },
      { "field": "primary_email", "source": "ATS,GitHub", "confidence": 0.9 },
      { "field": "phone_number", "source": "ATS", "confidence": 0.9 },
      { "field": "skills", "source": "ATS", "confidence": 0.9 },
      { "field": "current_employer", "source": "ATS,GitHub", "confidence": 0.9 }
    ]
  },
  {
    "full_name": "Chaos Monkey",
    "primary_email": ["chaos@testing.com"],
    "phone_number": "+18005550199",
    "skills": ["typescript", "graphql"],
    "current_employer": "Netflix",
    "provenance": [
      { "field": "full_name", "source": "ATS", "confidence": 0.9 },
      { "field": "primary_email", "source": "ATS,GitHub", "confidence": 0.9 },
      { "field": "phone_number", "source": "ATS", "confidence": 0.9 },
      { "field": "skills", "source": "ATS", "confidence": 0.9 },
      { "field": "current_employer", "source": "ATS,GitHub", "confidence": 0.9 }
    ]
  }
]
```
## Engine Testing

The pipeline has been thoroughly tested against complex "Chaos Monkey" edge cases to ensure robust error handling and fault tolerance:

1. **Entity Resolution Engine (Cascading Matching Strategy)**:
   - We explicitly use a strict **Cascading Matching Strategy (Email -> Phone -> Name+Company)** as our primary method for identity resolution.
   - **Strategic Justification**: We explicitly chose *not* to use fuzzy matching for names. This ensures 100% deterministic results, preventing the system from "over-merging" different people who happen to share a company.
   - **Identity Test Success**: The engine successfully maintains the distinction between "William Smith" and "Bill Smith" as two separate entities, proving it avoids over-merging.

2. **Accurate Provenance Audit Trail**:
   - The provenance arrays act as a true "audit trail". For candidates like Rahul Sharma, the provenance correctly identifies that data was successfully merged from both ATS and GitHub sources. For distinct candidates like Bill Smith, it correctly identifies that data originated solely from the GitHub source.

3. **Strict Validation, Normalization, & Resilience**:
   - **Schema Validity**: Every profile strictly follows the canonical structure required by the assignment. Missing fields marked with `"on_missing": "error"` successfully abort processing for that specific candidate.
   - **Normalization**: Phone numbers are correctly sanitized (e.g., William Smith's), and skills are canonicalized to lowercase without duplicates. The pipeline intelligently splits comma-separated string inputs when it expects arrays.
   - **Resilience**: The pipeline does not crash or invent data when faced with missing fields (such as Bill Smith's missing skills), proving it is robust against malformed or incomplete inputs.
   - **Confidence Weighting**: Deep nested paths (e.g., `experience[0].company`) correctly evaluate high-confidence sources. If a high-confidence source returns `null` or `undefined`, the engine explicitly filters it out, seamlessly falling back to a lower-confidence valid value.

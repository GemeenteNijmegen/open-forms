// Increase Jest timeout to 30 seconds for this test file
jest.setTimeout(30000);

import * as fs from 'fs';
import * as path from 'path';

type AnyObj = Record<string, any>;

interface Component {
  key?: string;
  jz4all_key?: string;
  vip_key?: string;
  dms_key?: string;
  properties?: AnyObj;
  components?: Component[];
  type?: string;
  form?: string;
  calculateValue?: string;
  defaultValue?: any;
  [key: string]: any;
}

interface FormDefinition {
  components?: Component[];
  [key: string]: any;
}

interface ExtractedField {
  key?: string;
  vip_key?: string;
  jz4all_key?: string;
  dms_key?: string;
}

interface FormResult {
  formName: string;
  vipZaakType: string | null;
  subFormName: string | null;
  fields: ExtractedField[];
}

/**
 * Recursively flatten nested components
 */
function flattenComponents(components: Component[]): Component[] {
  const result: Component[] = [];
  for (const component of components) {
    if (component.components) {result.push(...flattenComponents(component.components));}
    result.push(component);
  }
  return result;
}

// Jest test wrapping the extraction logic
xtest('extract components with vipZaaktype or vip/jz4all/dms keys (and subform) from all forms', () => {
  const BESTANDSNAAM = '2025-06-16-ontwikkel';
  // Load the JSON file containing all form definitions
  const filePath = path.join(
    __dirname,
    `./excludedformdefinitions/${BESTANDSNAAM}.json`,
  );
  const raw = fs.readFileSync(filePath, 'utf-8');
  const json = JSON.parse(raw) as { forms: Record<string, FormDefinition> };

  const results: FormResult[] = [];

  for (const [formName, formDef] of Object.entries(json.forms)) {
    const flat = flattenComponents(formDef.components || []);

    // Determine vipZaakType
    let vipZaakType: string | null = null;
    const vipComp = flat.find((c) => c.key === 'vipZaaktype');
    if (vipComp) {
      if (typeof vipComp.defaultValue === 'string') {vipZaakType = vipComp.defaultValue;} else if (typeof vipComp.calculateValue === 'string') {
        const m = /value\s*=\s*['"]([^'"]+)['"]/i.exec(vipComp.calculateValue);
        vipZaakType = m ? m[1] : vipComp.calculateValue;
      }
    }

    // Find subform name starting with 'apvblok' (case-insensitive)
    let subFormName: string | null = null;
    const subFormComp = flat.find(
      (c) =>
        c.type === 'form' &&
        typeof c.form === 'string' &&
        /^apvblok/i.test(c.form),
    );
    if (subFormComp) subFormName = subFormComp.form || null;

    // Filter relevant components
    const filtered = flat.filter(
      (c) =>
        c.vip_key !== undefined ||
        c.jz4all_key !== undefined ||
        c.dms_key !== undefined ||
        c.properties?.vip_key !== undefined ||
        c.properties?.jz4all_key !== undefined ||
        c.properties?.dms_key !== undefined,
    );

    const fields: ExtractedField[] = filtered.map((c) => ({
      key: c.key,
      vip_key: c.vip_key ?? c.properties?.vip_key,
      jz4all_key: c.jz4all_key ?? c.properties?.jz4all_key,
      dms_key: c.dms_key ?? c.properties?.dms_key,
    }));

    // Only include forms that have a vipZaakType or at least one field
    if (vipZaakType || fields.length > 0) {
      results.push({ formName, vipZaakType, subFormName, fields });
    }
  }

  // Ensure output directory exists
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write results to a timestamped JSON file with description
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `vipkeys-${BESTANDSNAAM}-madeat${timestamp}.json`;
  const outPath = path.join(outputDir, filename);
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));

  // Output only non-empty results
  console.log(JSON.stringify(results, null, 2));
}, 30000);

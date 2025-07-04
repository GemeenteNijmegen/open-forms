// Increase Jest timeout to 30 seconds for this test file
jest.setTimeout(30000);

import * as fs from 'fs';
import * as path from 'path';
import { zaaktypeConfig } from '../VipZaakTypeConfig';

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
    if (component.components) {
      result.push(...flattenComponents(component.components));
    }
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
      if (typeof vipComp.defaultValue === 'string') {
        vipZaakType = vipComp.defaultValue;
      } else if (typeof vipComp.calculateValue === 'string') {
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

xtest('generate JSON schema for unique field keys (filtered)', () => {
  const BESTANDSNAAM = '2025-07-04-nijmegen';
  const filePath = path.join(
    __dirname,
    `./excludedformdefinitions/${BESTANDSNAAM}.json`,
  );
  const raw = fs.readFileSync(filePath, 'utf-8');
  const json = JSON.parse(raw) as { forms: Record<string, FormDefinition> };

  // Build field key -> forms and key-metadata map only from components with vip/jz4all/dms
  const fieldForms: Record<string, Set<string>> = {};
  const fieldMeta: Record<string, Set<string>> = {};
  for (const [formName, formDef] of Object.entries(json.forms)) {
    const flat = flattenComponents(formDef.components || []);
    const filtered = flat.filter(
      (c) =>
        c.vip_key !== undefined ||
        c.jz4all_key !== undefined ||
        c.dms_key !== undefined ||
        c.properties?.vip_key !== undefined ||
        c.properties?.jz4all_key !== undefined ||
        c.properties?.dms_key !== undefined,
    );
    for (const comp of filtered) {
      const key = comp.key!;
      if (!fieldForms[key]) fieldForms[key] = new Set();
      fieldForms[key].add(formName);
      if (!fieldMeta[key]) fieldMeta[key] = new Set();
      const directVip = comp.vip_key;
      const propVip = comp.properties?.vip_key as string | undefined;
      if (directVip) fieldMeta[key].add(`vip_key=${directVip}`);
      else if (propVip) fieldMeta[key].add(`vip_key=${propVip}`);
      const directJz = comp.jz4all_key;
      const propJz = comp.properties?.jz4all_key as string | undefined;
      if (directJz) fieldMeta[key].add(`jz4all_key=${directJz}`);
      else if (propJz) fieldMeta[key].add(`jz4all_key=${propJz}`);
      const directDms = comp.dms_key;
      const propDms = comp.properties?.dms_key as string | undefined;
      if (directDms) fieldMeta[key].add(`dms_key=${directDms}`);
      else if (propDms) fieldMeta[key].add(`dms_key=${propDms}`);
    }
  }

  // Generate JSON Schema
  const schema: any = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: {},
    additionalProperties: true,
  };

  // Add vipZaakTypeVariable property with enum of all zaaktypeVariable values
  const zaakVars = zaaktypeConfig.map(c => c.zaaktypeVariable);
  schema.properties.vipZaakTypeVariable = {
    type: 'string',
    enum: zaakVars,
    description: 'Must be one of the zaaktypeVariable values from configuration',
  };

  for (const key of Object.keys(fieldForms)) {
    const formsList = Array.from(fieldForms[key]).join(', ');
    const metasList = Array.from(fieldMeta[key] || []);
    let description = formsList;
    if (metasList.length > 0) {
      description += `; metadata: ${metasList.join(', ')}`;
    }
    schema.properties[key] = {
      type: 'string',
      description,
    };
  }

  // Write schema to file
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const timestamp2 = new Date().toISOString().replace(/[:.]/g, '-');
  const schemaFilename = `fields-schema-${BESTANDSNAAM}-madeat${timestamp2}.json`;
  fs.writeFileSync(path.join(outputDir, schemaFilename), JSON.stringify(schema, null, 2));
  console.log(`Schema written to ${schemaFilename}`);

  // Log the number of properties
  const propCount = Object.keys(schema.properties).length;
  console.log(`Total properties in schema: ${propCount}`);
}, 30000);

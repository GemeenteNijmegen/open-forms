// Increase Jest timeout to 30 seconds
jest.setTimeout(30000);

import * as fs from 'fs';
import * as path from 'path';

type AnyObj = Record<string, any>;

interface Component {
  key?: string;
  calculateValue?: string;
  defaultValue?: any;
  customDefaultValue?: string;
  components?: Component[];
  [key: string]: any;
}

interface FormDefinition {
  components?: Component[];
  [key: string]: any;
}

interface FormVipTypes {
  formName: string;
  vipZaakTypes: string[];
  calculatedValue: string | null;
  defaultValue: string | null;
}

/**
 * Recursively flatten nested components
 */
function flattenComponents(components: Component[]): Component[] {
  return components.reduce<Component[]>((acc, comp) => {
    if (comp.components) {
      acc.push(...flattenComponents(comp.components));
    }
    acc.push(comp);
    return acc;
  }, []);
}

/**
 * Extract quoted literals from a script string
 */
function extractLiterals(script: string): string[] {
  return Array.from(script.matchAll(/['"]([^'"]+)['"]/g)).map((m) => m[1]);
}

// Jest test to collect all vipZaakTypes (including scripts and defaults) from every form
xtest('extract all vipZaakTypes (including scripts and defaults) from all forms', () => {
  const BESTANDSNAAM = '2025-06-16-nijmegen';
  const filePath = path.join(
    __dirname,
    `./excludedformdefinitions/${BESTANDSNAAM}.json`,
  );
  const raw = fs.readFileSync(filePath, 'utf-8');
  const json = JSON.parse(raw) as { forms: Record<string, FormDefinition> };

  const results: FormVipTypes[] = [];

  for (const [formName, formDef] of Object.entries(json.forms)) {
    const flat = flattenComponents(formDef.components || []);
    const vipComps = flat.filter((c) => c.key === 'vipZaaktype');

    vipComps.forEach((c) => {
      // Determine defaultValue or customDefaultValue (ignore empty strings)
      let defaultVal: string | null = null;
      if (typeof c.defaultValue === 'string' && c.defaultValue.trim() !== '') {
        defaultVal = c.defaultValue;
      } else if (
        typeof c.customDefaultValue === 'string' &&
        c.customDefaultValue.trim() !== ''
      ) {
        defaultVal = c.customDefaultValue;
      }
      // Determine calculateValue script (ignore empty strings)
      const calcVal =
        typeof c.calculateValue === 'string' && c.calculateValue.trim() !== ''
          ? c.calculateValue
          : null;

      // Collect unique VIP types
      const literals = new Set<string>();
      if (defaultVal) {
        // If defaultVal is a script, extract literals; else treat as literal
        if (/value\s*=/.test(defaultVal)) {
          extractLiterals(defaultVal).forEach((v) => literals.add(v));
        } else {
          literals.add(defaultVal);
        }
      }
      if (calcVal) {
        extractLiterals(calcVal).forEach((v) => literals.add(v));
      }

      const vipZaakTypes = Array.from(literals);

      if (vipZaakTypes.length > 0 || calcVal) {
        results.push({
          formName,
          vipZaakTypes,
          calculatedValue: calcVal,
          defaultValue: defaultVal,
        });
      }
    });
  }
  // Ensure output directory exists
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write results to a timestamped JSON file with description
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `zaaktypes-${BESTANDSNAAM}-madeat${timestamp}.json`;
  const outPath = path.join(outputDir, filename);
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));

  // Output the collected VIP zaak types per form
  console.log(JSON.stringify(results, null, 2));
  console.log('Result counter: ', results.length);
}, 30000);

import * as fs from 'fs';
import * as path from 'path';
import { Construct } from 'constructs';
import { PrefillEndpointBase, PrefillEndpointProps } from './PrefillEndpointBase';

interface DiscoveredEndpoint {
  formName: string;
  EndpointClass: new (scope: Construct, id: string, props: PrefillEndpointProps) => PrefillEndpointBase;
}

/**
 * Scans the src/api/form-prefill directory for subfolders containing an index.ts,
 * and imports the PrefillEndpoint class from each.
 */
export function discoverEndpoints(): DiscoveredEndpoint[] {
  const baseDir = __dirname;
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });

  const discovered: DiscoveredEndpoint[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const indexPath = path.join(baseDir, entry.name, 'index.ts');
    // At synth time via ts-node / projen, .ts files are resolvable.
    // The compiled output will have .js, so we check both.
    const indexPathJs = path.join(baseDir, entry.name, 'index.js');

    if (!fs.existsSync(indexPath) && !fs.existsSync(indexPathJs)) continue;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require(path.join(baseDir, entry.name, 'index'));

    if (!module.PrefillEndpoint) {
      console.warn(`[discovery] Skipping '${entry.name}': no PrefillEndpoint export found.`);
      continue;
    }

    discovered.push({
      formName: entry.name,
      EndpointClass: module.PrefillEndpoint,
    });
    console.warn(`[discovery] Added '${entry.name}' endpoint.`);
  }

  return discovered;
}

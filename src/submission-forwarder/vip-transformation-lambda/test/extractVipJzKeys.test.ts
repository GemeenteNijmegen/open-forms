import * as fs from 'fs';
import * as path from 'path';

interface Component {
  key?: string;
  jz4all_key?: string;
  vip_key?: string;
  properties?: Record<string, unknown>;
  components?: Component[];
  [key: string]: any;
}
/**
 * Fast test to extract all keys from a formdefinition
 * @param components
 * @returns
 */
function flattenComponents(components: Component[]): Component[] {
  const result: Component[] = [];

  for (const component of components) {
    if (component.components) {
      result.push(...flattenComponents(component.components));
    }

    const hasJzOrVipKey =
      component.jz4all_key ||
      component.vip_key ||
      component.properties?.jz4all_key ||
      component.properties?.vip_key;
    if (hasJzOrVipKey) {
      result.push(component);
    }
  }

  return result;
}

test('extract components with jz4all_key or vip_key', () => {
  const filePath = path.join(
    __dirname,
    '../examples/bezwaar-maken-01-formdefinition.json',
  );
  const rawData = fs.readFileSync(filePath, 'utf-8');
  const json = JSON.parse(rawData);

  const components = json.components || [];
  const flattened = flattenComponents(components);

  const result = flattened.map((comp) => ({
    key: comp.key,
    properties: comp.properties || {},
  }));

  console.log(result);
});

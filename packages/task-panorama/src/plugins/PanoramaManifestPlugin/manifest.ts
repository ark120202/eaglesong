import Ajv from 'ajv';
import manifestSchema from './manifest.schema.json';

export { manifestSchema };

const ajv = new Ajv({ allErrors: true, useDefaults: true });
export const validateManifest = ajv.compile(manifestSchema);

export interface Entry {
  name: string;
  source: string;
  type: string | null;
}

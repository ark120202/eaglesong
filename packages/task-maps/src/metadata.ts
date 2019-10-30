import Ajv from 'ajv';
import metadataSchema from './metadata.schema.json';

export { metadataSchema };

const ajv = new Ajv({ allErrors: true, useDefaults: true });
export const validateMetadata = ajv.compile(metadataSchema);

/**
 * A list of playable maps and their extra data.
 */
export type MapsMetadata = Record<string, MapData>;
export interface MapData {
  MaxPlayers: number;
  [key: string]: any;
}

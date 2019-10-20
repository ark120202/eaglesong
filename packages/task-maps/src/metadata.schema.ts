import schema from './metadata.schema.json';

export { schema };

/**
 * A list of playable maps and their extra data.
 */
export type MapsMetadata = Record<string, MapData>;
export interface MapData {
  MaxPlayers: number;
  [key: string]: any;
}

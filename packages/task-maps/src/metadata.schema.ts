import schema from './metadata.schema.json';

export { schema };

export interface MapData {
  /**
   * @TJS-type integer
   * @minimum 0
   */
  teams: number;

  /**
   * @TJS-type integer
   * @minimum 0
   */
  players: number;

  /**
   * A list of map modifications, used to construct combinations.
   * `_` will evaluate to name without any modifier.
   *
   * @minItems 1
   * @uniqueItems true
   * @default ["_"]
   */
  // modifications?: (string | { name: string; env: Record<string, any> })[];
  modifications?: string[];

  /**
   * See @dotastd/env.
   */
  // env?: Record<string, any>;
}

/**
 * The information about maps which appears in addoninfo file.
 */
export interface MapsMetadata {
  /**
   * Order of maps as they appear in map list.
   * Use `...` for all not specified maps.
   *
   * @example ["level_1", "...", "level_10"]
   * @minItems 1
   * @uniqueItems true
   * @default ["..."]
   */
  order?: string[];

  /**
   * @validationKeywords ^\w+$
   * @default _
   */
  separator?: string;
  maps: Record<string, MapData>;
}

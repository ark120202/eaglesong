import Ajv from 'ajv';
import soundEventsSchema from './soundevents.schema.json';

export { soundEventsSchema };

const ajv = new Ajv({ allErrors: true, useDefaults: true });
export const validateSoundEvents = ajv.compile(soundEventsSchema);

export type SoundEvents = Record<string, SoundEvent>;
export interface SoundEvent extends OperatorVariables {
  /**
   * @default dota_update_default
   */
  type?: string;
  files: string | string[];
}

// https://raw.githubusercontent.com/SteamDatabase/GameTracking-Dota2/master/game/dota/pak01_dir/scripts/sound_operator_stacks.txt
export interface OperatorVariables {
  mixgroup?: string;
  start?: number;

  volume?: number;
  volume_min?: number;
  volume_max?: number;
  volume_fade_in?: number;
  volume_fade_out?: number;
  volume_move_vel?: number;
  volume_move_vol?: number;
  volume_move_filter_vel?: number;
  volume_falloff_min?: number;
  volume_falloff_max?: number;

  level_min?: number;
  level_max?: number;

  delay?: number;

  pitch?: number;
  pitch_min?: number;
  pitch_max?: number;

  soundlevel?: number;
  soundlevel_min?: number;
  soundlevel_max?: number;

  spread_radius?: number;
}

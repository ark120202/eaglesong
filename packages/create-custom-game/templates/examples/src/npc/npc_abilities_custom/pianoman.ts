import _ from 'lodash';

const ability = (note: string): NpcAbilitiesCustom.Root[string] => ({
  AbilityBehavior: [AbilityBehavior.NO_TARGET, AbilityBehavior.AOE],
  AbilityTextureName: `custom/pianoman_${note}`,
  AbilityCastAnimation: Activity.IDLE,
  BaseClass: 'ability_lua',
  MaxLevel: 7,
  ScriptFile: 'abilities/hero/pianoman/note',
});

export default _.fromPairs(
  'abcdefg'
    .split('')
    .map((n): [string, NpcAbilitiesCustom.Root[string]] => [`pianoman_note_${n}`, ability(n)]),
);

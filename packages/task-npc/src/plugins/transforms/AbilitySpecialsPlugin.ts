import * as s from '@dota-data/scripts/lib/schema';
import _ from 'lodash';
import { Plugin } from '../../service';

const reservedFields = {
  var_type: "it's inferred from value",
  levelkey: "it's usage is not known",
  CalculateSpellDamageTooltip: '', // TODO: 'see https://eaglesong.ark120202.moe/docs/modding/abilities/damage#Spell_Amplification'
  LinkedSpecialBonus: 'use $talent.name instead',
  LinkedSpecialBonusField: 'use $talent.field instead',
  LinkedSpecialBonusOperation: 'use $talent.operation instead',
};

const inferVarType = (value: unknown) => {
  const isFloat =
    typeof value === 'number'
      ? value % 1 !== 0
      : typeof value === 'string'
      ? value.split(' ').some(x => Number(x) % 1 !== 0)
      : false;
  return isFloat ? 'FIELD_FLOAT' : 'FIELD_INTEGER';
};

const fileFilter = new Set(['npc_items_custom', 'npc_abilities_custom']);
export const AbilitySpecialsPlugin: Plugin = (hooks, { error }) => {
  hooks.schemas.tap('AbilitySpecialsPlugin', schemas =>
    [schemas.npc_items_custom, schemas.npc_abilities_custom].forEach(schema =>
      schema.getRestRootsLike(s.ObjectSchema).forEach(element =>
        element.delete('AbilitySpecials').field(
          'Specials',
          s.array(
            s
              .obj('Special')
              .rest(s.oneOf([s.num(), s.arrayLike()]), /^[^$]/)
              .field('$damage', s.bool())
              .field(
                '$talent',
                s
                  .obj('SpecialTalent')
                  .field('name', s.str(), { require: true })
                  .field('field', s.str())
                  // TODO: consider adding SPECIAL_BONUS_ADD
                  .field('operation', s.oneOfLiterals(['-', '*'])),
              ),
          ),
        ),
      ),
    ),
  );

  hooks.transform.tap('AbilitySpecialsPlugin', (files, group) => {
    if (!fileFilter.has(group)) return;

    _.each(files, (file, fileName) =>
      _.each(file, (ability, abilityName) => {
        if (ability.Specials == null) return;

        ability.AbilitySpecial = Object.fromEntries(
          (ability.Specials as Record<string, any>[]).map((special, index) => {
            const fullIndex = String(index + 1).padStart(2, '0');
            for (const [name, recommendation] of Object.entries(reservedFields)) {
              if (name in special) {
                error(
                  fileName,
                  `${abilityName}.Specials(${name}) may not be specified, ${recommendation}.`,
                );
              }
            }

            const fields = Object.keys(special);
            const mainCandidates = fields.filter(x => !(x in reservedFields) && !x.startsWith('$'));

            if (mainCandidates.length === 0) {
              error(fileName, `${abilityName}.Specials[${index}] not contains special name`);
              return [fullIndex, special];
            }

            if (mainCandidates.length > 1) {
              error(
                fileName,
                `${abilityName}.Specials[${index}] has conflicting specials: ${mainCandidates.join(
                  ', ',
                )}. If you meant to add metadata prepend it with $.`,
              );
              return [fullIndex, special];
            }

            const mainName = mainCandidates[0];
            const mainValue = special[mainName];
            const mainIndex = fields.findIndex(x => x === mainName);
            if (mainIndex !== 0) {
              error(
                fileName,
                `${abilityName}.Specials(${mainName}) has main field at ${mainIndex} index. Main field should come first.`,
                'warning',
              );
            }

            const newSpecial: Record<string, any> = {
              var_type: inferVarType(mainValue),
              // Main field should be after `var_type`
              [mainName]: mainValue,
            };

            if (special.$talent != null && _.isPlainObject(special.$talent)) {
              newSpecial.LinkedSpecialBonus = String(special.$talent.name);
              newSpecial.LinkedSpecialBonusField = String(special.$talent.field);
              newSpecial.LinkedSpecialBonusOperation =
                special.$talent.operation === '*'
                  ? 'SPECIAL_BONUS_MULTIPLY'
                  : special.$talent.operation === '-'
                  ? 'SPECIAL_BONUS_SUBTRACT'
                  : undefined;
            }

            // TODO: Check how dota does it
            const isDotaInferredDamage = mainName.includes('damage');
            const isActuallyDamage = special.$damage === true;
            if (isDotaInferredDamage !== isActuallyDamage) {
              newSpecial.CalculateSpellDamageTooltip = isActuallyDamage ? 1 : 0;
            }

            return [fullIndex, newSpecial];
          }),
        );

        delete ability.Specials;
      }),
    );
  });

  hooks.migrate.tap('AbilitySpecialsPlugin', (files, group) => {
    if (!fileFilter.has(group)) return;

    _.each(files, file => {
      _.each(file, ability => {
        if (ability.AbilitySpecial == null) return;
        ability.Specials = Object.entries<any>(ability.AbilitySpecial)
          .sort(([a], [b]) => Number(a) - Number(b))
          // TODO:
          .map(([, special]) => _.omit(special, 'var_type'));
      });
    });
  });
};

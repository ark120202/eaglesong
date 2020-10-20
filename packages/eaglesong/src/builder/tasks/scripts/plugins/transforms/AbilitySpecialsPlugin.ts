import * as s from 'dota-data/lib/schema';
import _ from 'lodash';
import { Plugin } from '../../plugin';

const reservedFields = {
  var_type: "it's inferred from value",
  levelkey: "it's usage is not known",
  CalculateSpellDamageTooltip: 'use $amplifiable instead',
  LinkedSpecialBonus: 'use $talent.name instead',
  LinkedSpecialBonusField: 'use $talent.field instead',
  LinkedSpecialBonusOperation: 'use $talent.operation instead',
};

const inferVarType = (value: unknown) => {
  const isFloat =
    typeof value === 'number'
      ? value % 1 !== 0
      : typeof value === 'string'
      ? value.split(' ').some((x) => Number(x) % 1 !== 0)
      : false;
  return isFloat ? 'FIELD_FLOAT' : 'FIELD_INTEGER';
};

const fileFilter = new Set(['npc/npc_items_custom', 'npc/npc_abilities_custom']);
export const AbilitySpecialsPlugin: Plugin = ({ hooks, error }) => {
  hooks.schemas.tap('AbilitySpecialsPlugin', (schemas) => {
    for (const schemaName of fileFilter) {
      for (const element of schemas[schemaName].getRestRootsLike(s.ObjectSchema)) {
        element.delete('AbilitySpecials').field(
          'Specials',
          s.array(
            s
              .obj('Special')
              .rest(s.oneOf([s.num(), s.arrayLike()]), /^[^$]/)
              .field('$amplifiable', s.bool())
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
        );
      }
    }
  });

  function parseSpecialMetaInfo(
    special: any,
  ): { error: string } | { mainName: string; mainValue: any; mainIndex: number } {
    const fields = Object.keys(special);
    const mainCandidates = fields.filter((x) => !(x in reservedFields) && !x.startsWith('$'));

    if (mainCandidates.length === 0) {
      return { error: 'not contains special name' };
    }

    if (mainCandidates.length > 1) {
      const conflictingSpecials = mainCandidates.join(', ');
      return {
        error: `has conflicting specials: ${conflictingSpecials}. If you meant to add own metadata start it with $.`,
      };
    }

    const mainName = mainCandidates[0];
    const mainValue = special[mainName];
    const mainIndex = fields.findIndex((x) => x === mainName);
    return { mainName, mainValue, mainIndex };
  }

  function applySpecialTalent(special: any) {
    const specialTalent = special.$talent;
    special.$talent = undefined;

    if (specialTalent == null || !_.isPlainObject(specialTalent)) {
      return {};
    }

    return {
      LinkedSpecialBonus: String(specialTalent.name),
      LinkedSpecialBonusField: String(specialTalent.field),
      LinkedSpecialBonusOperation:
        specialTalent.operation === '*'
          ? 'SPECIAL_BONUS_MULTIPLY'
          : specialTalent.operation === '-'
          ? 'SPECIAL_BONUS_SUBTRACT'
          : undefined,
    };
  }

  function applySpecialAmplifiable(
    special: any,
    specialPath: string,
    mainName: string,
    fileName: string,
    damageType: any,
  ) {
    const isAmplifiable: boolean | undefined = special.$amplifiable;
    special.$amplifiable = undefined;

    if (!damageType) {
      if (isAmplifiable !== undefined) {
        error({
          fileName,
          message: `${specialPath}.$amplifiable cannot be specified without 'AbilityUnitDamageType'.`,
        });
      }

      return {};
    }

    const isDotaInferredDamage = mainName.toLowerCase().includes('damage');

    if (isAmplifiable === undefined) {
      if (isDotaInferredDamage) {
        error({
          fileName,
          message: `${specialPath}.$amplifiable is required for specials with 'damage' in the name.`,
        });
      }

      return {};
    }

    if (isAmplifiable === false && !isDotaInferredDamage) {
      error({
        fileName,
        level: 'warning',
        message: `${specialPath}.$amplifiable: false is unnecessary.`,
      });
    }

    return isDotaInferredDamage !== isAmplifiable
      ? { CalculateSpellDamageTooltip: isAmplifiable ? 1 : 0 }
      : {};
  }

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
                error({
                  fileName,
                  message: `${abilityName}.Specials(${name}) cannot be specified, ${recommendation}.`,
                });
              }
            }

            const specialInfo = parseSpecialMetaInfo(special);
            if ('error' in specialInfo) {
              error({
                fileName,
                message: `${abilityName}.Specials[${index}] ${specialInfo.error}`,
              });
              return [fullIndex, special];
            }

            const { mainName, mainValue, mainIndex } = specialInfo;
            if (mainIndex !== 0) {
              error({
                fileName,
                level: 'warning',
                message: `${abilityName}.Specials(${mainName}) has main field at ${mainIndex} index. Main field should come first.`,
              });
            }

            const newSpecial: Record<string, any> = {
              var_type: inferVarType(mainValue),

              // Main field should be after `var_type`
              [mainName]: mainValue,

              ...applySpecialTalent(special),
              ...applySpecialAmplifiable(
                special,
                `${abilityName}.Specials(${mainName})`,
                mainName,
                fileName,
                ability.AbilityUnitDamageType,
              ),
            };

            return [fullIndex, newSpecial];
          }),
        );

        delete ability.Specials;
      }),
    );
  });

  hooks.migrate.tap('AbilitySpecialsPlugin', (files, group) => {
    if (!fileFilter.has(group)) return;

    _.each(files, (file) => {
      _.each(file, (ability) => {
        if (ability.AbilitySpecial == null) return;
        ability.Specials = Object.entries<any>(ability.AbilitySpecial)
          .sort(([a], [b]) => Number(a) - Number(b))
          // TODO:
          .map(([, special]) => _.omit(special, 'var_type'));
      });
    });
  });
};

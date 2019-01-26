import * as invoker from '@dotastd/invoker';

const MyModifier = invoker.modifier('custom_hero_ability_1_effect', {
  specials: { crit_damage: true },
  options: { crit_chance: invoker.type.int },
  properties: {
    [ModifierProperties.BONUS_DAMAGE]: '%damage',
    [ModifierProperties.BONUS_CRIT_DAMAGE]({ specials: { crit_damage }, options }) {
      crit_damage;
    },
  },
});

const MyAbility = invoker.ability('custom_hero_ability_1', {
  passive: {
    properties: {
      [ModifierProperties.BONUS_DAMAGE]: '%damage',
    },
  },
  onSpellStart({ caster, specials: { strength } }) {
    MyModifier.create();
    if (caster.IsHero()) caster.AddStrength(strength);
  },
});

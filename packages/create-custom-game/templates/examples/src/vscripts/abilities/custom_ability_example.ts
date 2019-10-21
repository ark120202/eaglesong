import { BaseAbility, BaseModifier, registerAbility, registerModifier } from './utils';

@registerAbility('custom_ability_example')
export class CustomAbilityExample extends BaseAbility {
  public OnSpellCast() {
    const caster = this.GetCaster();
    const target = this.GetCursorTarget()!;

    target.AddNewModifier(caster, this, CustomAbilityExampleModifier.name, { duration: 10 });
  }
}

@registerModifier('custom_ability_example_modifier')
export class CustomAbilityExampleModifier extends BaseModifier {
  public DeclareFunctions = () => [
    ModifierProperty.PREATTACK_BONUS_DAMAGE,
    ModifierEvent.ON_ATTACK,
  ];

  public GetModifierPreAttack_BonusDamage = () =>
    this.GetAbility()!.GetSpecialValueFor('damage_reduction');

  public OnAttack({ attacker, damage }: ModifierAttackEvent) {
    if (!IsServer()) return;

    if (attacker !== this.GetParent()) return;

    ApplyDamage({
      victim: attacker,
      attacker: this.GetCaster()!,
      ability: this.GetAbility(),
      damage: damage * 0.15,
      damage_type: DamageTypes.MAGICAL,
      damage_flags: DamageFlag.NO_SPELL_LIFESTEAL | DamageFlag.NO_SPELL_AMPLIFICATION,
    });
  }
}

# Creating ability

1. Declaration
2. Code
3. Localization

## Declaration

Every new ability starts with describing it's metadata. Custom abilities are located in a
`src/npc/npc_abilities_custom` directory. All files in this directory will be scanned and imported
to your custom game, so you can use your own directory layout there. In this guide we'll create a
`heroes` directory with a `custom_hero.yml` file in it.

> Npc files can be written in many file formats, for more information check out
> [npc plugin documentation](/plugins/npc)

All ability files should have a root object where keys are unique ability identifier and values are
objects, that describe that ability.

```yaml
custom_hero_ability_1:
  # BaseClass is a field that defines a way of developing your ability. For abilities there are
  # only 2 valid values: ability_lua and ability_datadriven, where latter is considered deprecated
  # and won't be considered onwards.
  BaseClass: ability_lua
  # Path to the file containing implementation of the ability, more info in the Code section.
  ScriptFile: abilities/heroes/custom_hero/ability_1
  # Ability behavior is a set of properties that defines it's cast behavior.
  # For example for passive ability there's PASSIVE, for a point target ability - POINT.
  # Behaviors may be combined, for example [UNIT_TARGET, AUTOCAST, ATTACK]
  AbilityBehavior: NO_TARGET

  # Most of the keys are self-descriptive, but if have troubles with some properties you can use
  # [online documentation](https://dotapi.dotastd.ark120202.moe/npc_abilities_custom) or just hover
  # at the key if your editor supports it.
  AbilityCooldown: 25
  # When the value is the same on all levels you can just use a single value, but when you need
  # it to change with ability's level define it in array format:
  AbilityDamage: [1, 2, 3]

  # Specials block defines variables that may depend on the level of your ability and you can get
  # them your code and ability's localization
  Specials:
    # The common practice is to prefix passive effects given by the ability with `bonus_`
    - bonus_damage: 120
    - bonus_movespeed_pct: [120, 150, 180, 210]
    #                ^^^^ - Another common practice is to append percentage values with `_pct`

    - strength: 5
    # One of Dota's mechanics, spell damage amplification, requires you to explicitly specify
    # specials that should be affected by it. Note that it only affects it in the ability's
    # description, actual damage is handled in the code.
    - self_damage_pct: 10
      CalculateSpellDamagePercentage: true

  # In `Precache` block you have to define resources used by your ability.
  # See [Precaching](/precaching.md) for more info.
  precache:
    # See [Particles](/particles.md)
    particles:
      - custom/heroes/custom_hero/ability_1
```

If you're using [an editor that supports YAML Schema](/editor-support) you'll get autocompletion,
documentation and immediate schema checking.

FIXME: creating-ability-yaml-schema.webm

For a documented list of standard fields in ability definitions check out
[this page](https://dota-data.netlify.com/schema/npc_abilities_custom).

This list only includes standard fields that you can find in your KV files. In Eaglesong, custom
fields may be introduced with plugins for [npc plugin](/plugins/npc).

## Code

The common way of creating abilities in pre-eaglesong custom games translated to TypeScript syntax
would be similar to this:

```ts
FIXME:
```

However, it's not really good as it forced you to write a lot of code even for a simple ability.

The better way is to generate ability classes with utility functions. One of libraries that provides
an easy way to manage your abilities is `@dotastd/invoker`:

```ts
// Import
```

For more information about creating abilities with `@dotastd/invoker` check out it's documentation:
https://invoker.dotastd.ark120202.moe.

## Localization

```ts
/**
 * Ability #1
 *
 * This is an ability #1's description.
 * You can use some of the **bold** and _italic_ text there.
 * Font may be colored with a {f:red:custom syntax}.
 *
 * > That's a text for a note, that are visible while ALT key is pressed.
 *
 * > The second note should be written after an empty line
 * > otherwise it would count as a continuation of a previous one.
 */
@Ability('custom_hero_ability_1')
class MyAbility extends AbilityBaseClass
```

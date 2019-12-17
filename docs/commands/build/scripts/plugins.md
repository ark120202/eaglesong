# Plugins

By default Eaglesong ships few standard plugins that change the way you can write script files. You
can disable them with a `defaultPlugins` option.

```ts
getTasks({
  scripts: {
    defaultPlugins: {
      EnsureSchemaExistsPlugin: false,
    },
  },
});
```

Custom plugins can be added with a `customPlugins` option.

## AbilitySpecialsPlugin

```yaml
ability:
  Specials:
    - name: 100
      $color: red # Unchecked extra keys can be prefixed with `$`.
```

Specials with multiple levels can be specified either as a space-separated string or as an array:

```yaml
Specials:
  - string: 1 2 3
  - array1: [1, 2, 3]
  - array2:
      - 1
      - 2
      - 3
```

Instead of `LinkedSpecialBonus` keys a `$talent` property should be used:

```yaml
Specials:
  - name: 1 2 3
    $talent:
      name: custom_talent
      operation: '*'
```

### Spell damage amplification

To advocate for spell damage amplification logic, UI has a heuristic that is based on special's
name. It's very easy to get false-positives with it, so `AbilitySpecialsPlugin` requires you to
explicitly specify what properties should be considered amplifiable:

```yaml
# Note that you can't make any specials amplifiable without specifying damage type
AbilityUnitDamageType: DAMAGE_TYPE_MAGICAL

Specials:
  # Adds `"CalculateSpellDamageTooltip" "0"`
  - damage_1: 100
    $amplifiable: false

  # Doesn't add `"CalculateSpellDamageTooltip"`, because dota infers it correctly
  - damage_2: 100
    $amplifiable: true

  # Adds `"CalculateSpellDamageTooltip" "1"`.
  - foo: 100
    $amplifiable: true

  # An error, you should specify if it's amplifiable explicitly
  - bonus_damage: 100
```

### Extra validation

`AbilitySpecialsPlugin` performs additional validation that can't be expressed in schema:

```yaml
Specials:
  - error: 1 2 3
  - error: 1 2 3 # duplicate names are not allowed

  - error2: 1 2 3
    var_type: FIELD_INTEGER # explicitly declared var_type's are not allowed

  - error3: 1, 2, 3 # invalid syntax

  - error4: 1 | 2 | 3 # invalid syntax
```

## ItemRecipePlugin

`ItemRecipePlugin` provides a simple and concise way to add recipes for custom items.

```yaml
my_item:
  Recipe:
    # The price of recipe for an item. If not specified, recipe item wouldn't be visible.
    cost: 100

    # A list of items required to build an item,
    # an `ItemRequirements` property of generated item.
    requirements:
      - base_item_1
      - base_item_2

    # Can be an array of arrays to specify multiple valid recipes.
    requirements:
      - - base_item_1
        - base_item_2

      - - base_item_3
        - base_item_4
```

## ExtendPortraitsPlugin

Unlike other `npc` scripts, `portraits.txt` doesn't have a `custom` version that can be used to
extend original declarations. This plugin merges in standard `portraits.txt` file, allowing you to
safely add portraits for custom models without breaking standard ones.

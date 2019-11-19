# Plugins

By default Eaglesong ships few standard plugins that change the way you can write script files. You
can disable them with a `defaultPlugins` option.

```ts
buildTasks({
  npc: {
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

To advocate for , Dota has a heuristic that based on special's name. It caused many false-positives,
so with `AbilitySpecialsPlugin` if you're storing damage-related variables in specials you have to
add a `$damage: true` property.

```yaml
Specials:
  # Gets `"CalculateSpellDamageTooltip" "1"`.
  - foo: 100
    $damage: true

  # Gets `"CalculateSpellDamageTooltip" "0"`, since dota infers it as amplifiable,
  # but it's not specified explicitly.
  - my_damage: 100
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

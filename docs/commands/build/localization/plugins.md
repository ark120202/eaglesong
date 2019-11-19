# Plugins

## NestingPlugin

This plugin allows you to nest localization strings:

```yaml
foo:
  bar: test # same as `foo_bar: test`
```

## VariablePlugin

This plugin allows localization strings to include dynamic expressions in `${}`.

Expressions can reference other localization keys:

```yaml
ability_description: Deals 100 damage.
upgraded_ability_description: ${ability_description} Stuns for 5 seconds.
# Deals 100 damage. Stuns for 3 seconds.
```

### Filters

To reduce duplication, expressions can do simple text transformations using filters. Filters should
be added after a variable reference, denoted by pipe symbol:

```yaml
ability_description: Deals 100 damage.
upgraded_ability_description:
  ${ability_description | upper | replace "100", "200" | slice 0, -1} and stuns for 3 seconds.
# DEALS 200 DAMAGE and stuns for 3 seconds.
```

Available filters:

- `upper`
- `lower`
- `reverse`
- `slice(start: number, end: number)`
- `replace(searchValue: string, replaceValue: string)`

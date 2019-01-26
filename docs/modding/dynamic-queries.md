# Dynamic Queries

When NPC file is written in a script format (for example .ts) it's easy to define a variable and
make other values depend on it, but it's impossible to do something similar in a static data
formats. That's where Dynamic Queries may help you.

Dynamic Queries work in all files built with NPC plugin and work with all file formats (including
scriptable).

<!-- ```yaml
ability_name:
  Specials:
    # Sometimes you may want to use range, cooldown, AoE radius or something else in the description
    # of your ability. In this case you'll have to declare it as a special.
    - tooltip_doubled_range: 600
  AbilityCastRange: =$tooltip_doubled_range / 2
``` -->

## Syntax

To start a Dynamic Query begin a value with `=`.

- Strings without any prefix would be searched in the first-level context
- Strings prefixed with `$` would be searched in the first-level context's AbilitySpecial block.
  Specific to abilities and items.
- Strings prefixed with `~` would be searched in the current context
- Strings prefixed with `.` would be searched in a merged file context
- Properties are separated with `.`
- Supported arithmetical operations: `+`, `-`, `*`, `/`, `**`, `%`
- All arithmetical operations work on values with multiple levels

Example

```yaml
ability_test:
  test_value: [1, 2, 3, 4, 5]

ability_1:
  test_value: 10
  property:
    access:
      test: 2

  value1: =.ability_test.test_value # => [1, 2, 3, 4, 5]
  value2: =.ability_test.test_value * test_value # => [10, 20, 30, 40, 50]
  value3: =value1 # => [10, 20, 30, 40, 50] - queries are evaluated in declaration order.

  value_: =invalid_property # attempt to use a null value
  value__: =invalid syntax # invalid query

  error4: =error4 # self references are not allowed
  # cyclic references are not allowed
  error5a: =error5b
  error5b: =error5a
```

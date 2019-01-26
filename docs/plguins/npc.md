# NPC Plugin

NPC plugin

## Ability Specials

```yaml
ability:
  Specials:
    - name: 1 2 3
    - name2:
        - 1
        - 2
        - 3
    - name3: [1, 2, 3]
    - name4: 1 2 3
      $damage: true # you have to explicitly declare damage fields to mark them amplifiable
    - name5: 1 2 3
      $talent:
        name: my_custom_talent
        operation: +
    - name6: 1 2 3
      $color: red # additional keys with metadata may be added to be used from scripts

    - error: 1 2 3
    - error: 1 2 3 # duplicate names are not allowed
    - error2: 1 2 3
      var_type: FIELD_INTEGER # explicitly declared var_type's are not allowed

    - error3: 1, 2, 3 # invalid syntax
    - error4: 1 | 2 | 3 # invalid syntax
```

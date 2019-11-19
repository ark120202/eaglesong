# Maps

This task manages playable maps, validating them and checking that all required files do exist.

To make a `.vmap` file a playable map you have to reference it in `src/maps/metadata.yml` file:

```yaml
main:
  MaxPlayers: 8
```

A key in this file is a name of the map and value is an object with one required property - a
`MaxPlayers` integer, although you're allowed to add any other properties for your scripts. All data
from this file is contributed to [addoninfo.txt](/commands/build/addoninfo/) file.

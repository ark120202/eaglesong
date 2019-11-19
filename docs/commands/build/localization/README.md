# Localization

This task manages custom game's localization. It takes `.yml`, `.json`, or `.ts` source files from
`src/localization`, validates and processes them, and generates files in a format that can be used
by Dota 2.

Files -> languages relationships and integrations are managed by
[providers](/commands/build/localization/provider).

All transformations are done by [plugins](/commands/build/localization/plugins).

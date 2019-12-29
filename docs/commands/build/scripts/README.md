# Scripts

This task manages KeyValues script files. It takes `.yml`, `.json` and `.ts` source files from
`src/scripts`, validates and processes them, and generates files in a format that can be used by
Dota 2.

All script transformations are done by [plugins](/commands/build/scripts/plugins).

## Schema

This task includes schema definitions for all common scripts, that is continuously validated against
standard game files. Schema is used to generate TypeScript type declarations and JSON/Yaml Schemas,
improving development experience (in [supported editors](/environment#editor-support)).

[](yaml-schema.webm ':include :type=video width=100% autoplay muted loop')

[Plugins](/commands/build/scripts/plugins) can use hooks to read and modify schema.

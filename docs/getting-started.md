# Getting started

Eaglesong comes with a command line tool that creates a custom game with recommended configuration:

```shell
yarn create @eaglesong/custom-game
# or
npm init @eaglesong/custom-game
```

After asking few questions about what it should include, a new directory with all of your new custom
game's files would be created. It includes a `package.json` file with Eaglesong and few other tools,
a [eaglesong.config.ts](/configuration) file, configuration for external tools and, optionally, few
examples.

Then you can open terminal in that directory (or open it in
[your editor](/environment#editor-support)), and run `yarn dev` to start building tasks and
`yarn launch` to open Dota 2 Workshop Tools with your custom game.

If you're familiar with Dota 2 modding, you can check out [task descriptions](/commands/build/) that
lists features comparing them with standard functionality. If you're a beginner, currently there are
no Eaglesong-based tutorials. You can read regular tutorials on https://moddota.com/ to get some
basic concepts, or ask for help in [ModDota Discord](https://discord.gg/gRmZgvz).

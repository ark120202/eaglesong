# Introduction

Eaglesong is a build tool for Dota 2 Custom games. It abstracts common addon operations and provides
plugin-based transformations to simplify addon creation.

## Project Structure

All project code is centered in a single directory. That's the standard layout of a project created
with a @eaglesong/create-app

- @dotastd/data
- @dotastd/panorama-polyfill
- @dotastd/timers
- @dotastd/declare-in-scope
- @dotastd/timers

- @babel-panorama/transform-enums
- @babel-lua-vscripts/preset
- @babel-lua-vscripts/transform-prototypes
- @babel-lua-vscripts/transform-enums
- @babel-lua-vscripts/helper-service
- @babel-lua-vscripts/helper-localization
- @babel-lua-vscripts/helper-npc
- @babel-lua-vscripts/transform-localization

injectLocalizationLine('key', 'value')

# Other Tasks

## Images

This tasks creates symbolic link from `src/images` to `game/resource/flash3/images` and validates
sizes of images.

By default it checks that images in `items` directory are `88x64` and images in `spellicons`
directory are `128x128`.

## Resources

This task creates symbolic links for resource directories, that don't have any special handling or
validation. By default it creates links for `itembuilds`, `materials`, `models` and `particles`
directories.

## Root Scripts

This task runs type-check for the root `tsconfig.json` file in the project, that usually includes
configuration file and scripts.

## Prettier

This task runs [Prettier](https://prettier.io/), an opinionated code formatter that helps to
maintain a consistent code style across your code base.

## ESLint

This task runs [ESLint](https://eslint.org/), a JavaScript/TypeScript static code analyzer.

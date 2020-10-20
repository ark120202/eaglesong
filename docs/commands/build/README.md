# Build

In Eaglesong, linking and transformation of custom game files are handled by an internal task
runner. There are few commands that can run these tasks:

```shell
eaglesong dev [--no-dota]
```

Runs tasks in development mode, watching for resources and building them as-needed.

```shell
eaglesong build [--no-dota] [--skip-compilation]
```

Runs tasks in production mode, optimizing resources and compiling them with resourcecompiler.

```shell
eaglesong generate-static
```

Generates support information, such as TypeScript declarations.

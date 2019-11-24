# Configuration

Eaglesong requires a `eaglesong.config.ts` configuration file to exist in the root of your project.
It should be a TypeScript file, with a default export:

```ts
import { buildTasks } from '@eaglesong/tasks';
import { Options } from 'eaglesong';

const config: Options = {
  tasks: buildTasks(/* Task options */),
};

export default config;
```

All available options can be found by inspecting type annotation or in individual command
documentation.

## Local configuration

It's possible that someone would like to change some options without changing them for everyone else
working on the project. To support that, Eaglesong would load `eaglesong.config.local.ts`,
preferring it over standard configuration file. Note that Eaglesong wouldn't merge files, so local
configuration file likely would want to extend standard one:

```ts
import config from './eaglesong.config';

config.launch!.map = 'test_basic';

export default config;
```

#!/usr/bin/env node
import execa from 'execa';
import fs from 'fs-extra';
import globby from 'globby';
import path from 'path';
import sortPackageJson from 'sort-package-json';
import yargs from 'yargs';
import { ask } from './input';

const isYarnAvailable = (() => {
  try {
    execa.sync('yarn --version');
    return true;
  } catch {
    return false;
  }
})();

const isGitAvailable = (() => {
  try {
    execa.sync('git --version');
    return true;
  } catch {
    return false;
  }
})();

async function main() {
  const argv = yargs
    .alias('h', 'help')
    .alias('v', 'version')
    .locale('en')
    .usage('Usage: $0')
    .boolean('use-npm')
    .default('use-npm', false)
    .describe('use-npm', 'Use `npm` to install dependencies even if `yarn` is found')
    .boolean('no-git')
    .default('no-git', false)
    .describe('no-git', 'Do not initialize git repository even if `git` is found')
    .strict()
    .parserConfiguration({ 'boolean-negation': false })
    .parse();

  const useGit = isGitAvailable && !argv['no-git'];
  const packageManager = isYarnAvailable && !argv['use-npm'] ? 'yarn' : 'npm';
  const {
    displayName,
    internalName,
    includeExamples,
    useESLint,
    usePrettier,
    conventionalCommits,
  } = await ask();

  const runPackageManager = (args: string[]) =>
    execa(packageManager, args, { stdio: 'inherit', cwd: internalName });
  const outputFile = (filePath: string, content: string) =>
    fs.outputFile(path.join(internalName, filePath), content);
  const outputJson = (filePath: string, data: any) =>
    fs.outputJson(path.join(internalName, filePath), data, { spaces: 2 });

  const templates = new Set(['base']);
  const variables = new Map([['displayName', displayName], ['getTasks', '']]);

  const packageJson: Record<string, any> = {
    name: internalName,
    version: '0.0.0',
    private: true,
    scripts: {
      dev: 'eaglesong dev',
      launch: 'eaglesong launch',
      release: 'eaglesong publish release',
    },
    dependencies: {},
    devDependencies: {},
  };

  const dependencies = [
    '@types/node',
    '@types/webpack-env',
    'dota-lua-types',
    'panorama-types',
    'tslib',
  ];

  const devDependencies = [
    '@ark120202/typescript-config',
    'typescript',
    '@eaglesong/tasks',
    'eaglesong',
  ];

  if (useGit) {
    templates.add('git');
  }

  if (includeExamples) {
    templates.add('examples');
  }

  if (conventionalCommits) {
    templates.add('conventional-commits');
    devDependencies.push('husky', '@commitlint/cli', '@commitlint/config-conventional');
    packageJson.husky = { hooks: { 'commit-msg': 'commitlint -E HUSKY_GIT_PARAMS' } };
    packageJson.commitlint = { extends: '@commitlint/config-conventional' };
  }

  if (useESLint) {
    packageJson.eslintConfig = {
      extends: '@ark120202/eslint-config/node',
      parserOptions: {
        project: ['tsconfig.json', 'src/panorama/tsconfig.json', 'src/vscripts/tsconfig.json'],
      },
    };

    devDependencies.push('eslint', '@ark120202/eslint-config');
  }

  if (usePrettier) {
    packageJson.prettier = {
      printWidth: 100,
      proseWrap: 'always',
      singleQuote: true,
      trailingComma: 'all',
    };

    devDependencies.push('prettier');
  }

  const disabledTasks: string[] = [];
  if (!useESLint) disabledTasks.push('eslint');
  if (!usePrettier) disabledTasks.push('prettier');
  if (disabledTasks.length > 0) {
    variables.set(
      'getTasks',
      ['{', ...disabledTasks.map(task => `    ${task}: false,`), '  }'].join('\n'),
    );
  }

  dependencies.sort((a, b) => a.localeCompare(b));
  devDependencies.sort((a, b) => a.localeCompare(b));

  await fs.mkdir(internalName);
  if (useGit) {
    await execa('git', ['init'], { cwd: internalName });
  }

  for (const template of templates) {
    const rootPath = path.join(__dirname, '..', 'templates', template);
    const files = await globby('**/*', { cwd: rootPath, dot: true });
    await Promise.all(
      files.map(async fileName => {
        let fileContent = await fs.readFile(path.join(rootPath, fileName), 'utf8');
        fileContent = fileContent
          .replace(/(\s*)\/\/ if (.+?): (.+)/g, (_, spaces, condition, expression) =>
            templates.has(condition) ? `${spaces}${expression}` : '',
          )
          .replace(/\$\$(.+?)\$\$/g, (match, expression) => {
            if (!variables.has(expression)) {
              throw new Error(`Unknown variable '${match}' in ${fileName}`);
            }

            return variables.get(expression)!;
          });

        // See https://github.com/npm/npm/issues/1862
        if (fileName === '_gitignore') {
          // https://github.com/eslint/eslint/issues/11954
          // eslint-disable-next-line require-atomic-updates
          fileName = '.gitignore';
        }

        await outputFile(fileName, fileContent);
      }),
    );
  }

  await outputJson('package.json', sortPackageJson(packageJson));

  let installedDevDependencies = false;
  try {
    await runPackageManager(['add', '-D', ...devDependencies]);
    installedDevDependencies = true;
    await runPackageManager(['add', ...dependencies]);
  } catch {
    console.log('');
    console.log('Failed to install dependencies.');
    console.log('To complete project initialization run:');
    console.log(`$ ${packageManager} add ${dependencies.join(' ')}`);
    if (!installedDevDependencies) {
      console.log(`$ ${packageManager} add -D ${devDependencies.join(' ')}`);
    }

    return 1;
  }
}

(async () => {
  process.exitCode = (await main()) || 0;
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

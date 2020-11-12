#!/usr/bin/env node
/* eslint-disable @typescript-eslint/require-array-sort-compare */
import execa from 'execa';
import fs from 'fs-extra';
import globby from 'globby';
import isBinaryPath from 'is-binary-path';
import latestVersion from 'latest-version';
import path from 'path';
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

async function main(): Promise<number> {
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

  const rootPath = path.resolve(internalName);

  const outputFile = (filePath: string, content: string) =>
    fs.outputFile(path.join(rootPath, filePath), content);
  const outputJson = (filePath: string, data: any) =>
    fs.outputJson(path.join(rootPath, filePath), data, { spaces: 2 });

  const templates = new Set(['base']);
  const variables = new Map([
    ['displayName', displayName],
    ['tasks', '{}'],
  ]);

  const lateDefinedField = undefined as any;
  const packageJson = {
    name: internalName,
    version: '0.0.0',
    private: true,
    scripts: {
      dev: 'eaglesong dev',
      launch: 'eaglesong launch',
      release: 'eaglesong publish release',
    },
    husky: lateDefinedField,
    commitlint: lateDefinedField,
    prettier: lateDefinedField,
    eslintConfig: lateDefinedField,
    dependencies: lateDefinedField,
    devDependencies: lateDefinedField,
  };

  const dependencies = new Set([
    '@types/node',
    '@types/webpack-env',
    'dota-lua-types',
    'panorama-types',
    'tslib',
  ]);

  const devDependencies = new Set([
    '@ark120202/typescript-config',
    'dota-data',
    'eaglesong',
    'typescript',
  ]);

  if (useGit) {
    templates.add('git');
  }

  if (includeExamples) {
    templates.add('examples');
  }

  if (conventionalCommits) {
    templates.add('conventional-commits');
    devDependencies.add('husky');
    devDependencies.add('@commitlint/cli');
    devDependencies.add('@commitlint/config-conventional');
    packageJson.husky = { hooks: { 'commit-msg': 'commitlint -E HUSKY_GIT_PARAMS' } };
    packageJson.commitlint = { extends: '@commitlint/config-conventional' };
  }

  if (useESLint) {
    templates.add('eslint');

    packageJson.eslintConfig = {
      extends: '@ark120202/eslint-config/node',
      parserOptions: {
        project: ['tsconfig.json', 'src/panorama/tsconfig.json', 'src/vscripts/tsconfig.json'],
      },
    };

    devDependencies.add('eslint');
    devDependencies.add('@ark120202/eslint-config');
  }

  if (usePrettier) {
    templates.add('prettier');

    packageJson.prettier = {
      printWidth: 100,
      proseWrap: 'always',
      singleQuote: true,
      trailingComma: 'all',
    };

    devDependencies.add('prettier');
  }

  const disabledTasks: string[] = [];
  if (!useESLint) disabledTasks.push('eslint');
  if (!usePrettier) disabledTasks.push('prettier');
  if (disabledTasks.length > 0) {
    variables.set(
      'tasks',
      ['{', ...disabledTasks.map((task) => `    ${task}: false,`), '  }'].join('\n'),
    );
  }

  await fs.mkdir(rootPath);
  if (useGit) {
    await execa('git', ['init'], { cwd: rootPath });
  }

  for (const template of templates) {
    const templateRootPath = path.join(__dirname, '..', 'templates', template);
    const files = await globby('**/*', { cwd: templateRootPath, dot: true });
    await Promise.all(
      files.map(async (fileName) => {
        if (isBinaryPath(fileName)) {
          await fs.copy(path.join(templateRootPath, fileName), path.join(rootPath, fileName));
          return;
        }

        let fileContent = await fs.readFile(path.join(templateRootPath, fileName), 'utf8');
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

  const dependencyVersions = new Map(
    await Promise.all(
      [...dependencies, ...devDependencies].map(
        async (packageName) => [packageName, `^${await latestVersion(packageName)}`] as const,
      ),
    ),
  );

  packageJson.dependencies = Object.fromEntries(
    [...dependencies].sort().map((name) => [name, dependencyVersions.get(name)!]),
  );

  packageJson.devDependencies = Object.fromEntries(
    [...devDependencies].sort().map((name) => [name, dependencyVersions.get(name)!]),
  );

  await outputJson('package.json', packageJson);

  try {
    await execa(packageManager, ['install'], { cwd: rootPath, stdio: 'inherit' });
  } catch {
    console.log('');
    console.log('Failed to install dependencies.');
    console.log('To complete project initialization run:');
    console.log(`$ ${packageManager} install`);

    return 1;
  }

  return 0;
}

(async () => {
  process.exitCode = await main();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

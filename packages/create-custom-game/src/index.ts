#!/usr/bin/env node

import execa from 'execa';
import fs from 'fs-extra';
import globby from 'globby';
import inquirer from 'inquirer';
import path from 'path';
import yargs from 'yargs';

async function prompt<T = string>(question: inquirer.Question) {
  const { value } = await inquirer.prompt<{ value: T }>([{ ...question, name: 'value' }]);
  await new Promise<void>(resolve => setImmediate(resolve));
  return value;
}

async function promptConfirmation(message: string, defaultValue?: boolean) {
  return prompt<boolean>({ type: 'confirm', message, default: defaultValue });
}

const isYarnAvailable = (() => {
  try {
    execa.sync('yarnpkg --version');
    return true;
  } catch (e) {
    return false;
  }
})();

const isGitAvailable = (() => {
  try {
    execa.sync('git --version');
    return true;
  } catch (e) {
    return false;
  }
})();

(async () => {
  const argv = yargs
    .alias('h', 'help')
    .alias('v', 'version')
    .locale('en')
    .usage('Usage: $0 <project-name> [options]')
    .string('internal-name')
    .describe('internal-name', 'Package and directory name')
    .boolean('use-npm')
    .default('use-npm', false)
    .describe('use-npm', 'Use npm to install dependencies even if `yarn` is found')
    .boolean('no-git')
    .default('no-git', false)
    .describe('no-git', "Don't initialize git repository even if `git` is found")

    .boolean('conventional-commits')
    .describe('conventional-commits', 'Use conventional commits')
    .boolean('eul')
    .describe('eul', 'Add Eul framework')
    .boolean('examples')
    .describe('examples', 'Include examples')
    .strict()
    .parse();

  let displayName = argv._[0];
  if (!displayName) {
    displayName = await prompt({ message: 'Display Name:' });
  }

  const transformInternalName = (input: string) =>
    input
      .toLowerCase()
      .replace(/ /g, '-')
      .replace(/_/g, '-')
      .replace(/ ?& ?/g, ' and ')
      .replace(/[^a-z\d-]/g, '');

  const validateInternalName = async (name: string) => {
    if (name === '') return "Name shouldn't be empty";
    if (await fs.pathExists(name)) {
      if (!(await fs.stat(name)).isDirectory) {
        return 'A file with that name already exists';
      }

      if ((await fs.readdir(name)).length !== 0) {
        return "A directory with that name already exists and it's not empty";
      }
    }

    return true;
  };

  let internalName = argv['internal-name'] || '';
  if (!internalName) {
    internalName = await prompt({
      message: 'Internal Name:',
      validate: validateInternalName,
      transformer: transformInternalName,
      default: transformInternalName(displayName),
    });
  } else {
    const validName = transformInternalName(internalName);
    if (internalName !== validName) {
      const canContinue = await promptConfirmation(
        `Provided name "${internalName}" is invalid, use "${validName}" instead?`,
        true,
      );
      if (!canContinue) return;
    }

    internalName = validName;
    const validationResult = await validateInternalName(internalName);
    if (validationResult !== true) throw new Error(validationResult);
  }

  let conventionalCommits = argv['conventional-commits'];
  if (conventionalCommits == null) {
    conventionalCommits = await promptConfirmation('Use conventional commits?', true);
  }

  let useEul = argv.eul;
  if (useEul == null) {
    useEul = await promptConfirmation('Use Eul framework?', true);
  }

  let includeExamples = argv.examples;
  if (includeExamples == null) {
    includeExamples = await promptConfirmation('Include examples?', true);
  }

  const useGit = isGitAvailable && !argv['no-git'];

  const packageManager = isYarnAvailable && !argv['use-npm'] ? 'yarnpkg' : 'npm';
  const runPackageManager = (args: string[]) =>
    execa(packageManager, args, { stdio: 'inherit', cwd: internalName });
  const outputFile = (filePath: string, content: string) =>
    fs.outputFile(path.join(internalName, filePath), content);
  const outputJson = (filePath: string, data: any) =>
    fs.outputJson(path.join(internalName, filePath), data, { spaces: 2 });

  const packageJson: Record<string, any> = {
    name: internalName,
    version: '1.0.0',
    private: true,
    scripts: {
      build: 'node ../packages/cli/bin/eaglesong.js build',
      ci: 'node ../packages/cli/bin/eaglesong.js ci --push-localization',
      clean: 'node ../packages/cli/bin/eaglesong.js clean',
      dev: 'node ../packages/cli/bin/eaglesong.js dev',
      eaglesong: 'node ../packages/cli/bin/eaglesong.js',
      launch: 'node ../packages/cli/bin/eaglesong.js launch',
      release: 'node ../packages/cli/bin/eaglesong.js publish --preset release',
    },
  };

  const dependencies = [
    '@types/node',
    'types-dota-panorama',
    'types-dota-vscripts',
    'link:D:/dev/dota/_modules/panorama-polyfill',
  ];

  const devDependencies = [
    'typescript',
    'tslint',
    'tslint-config-prettier',
    'tslint-plugin-prettier',
  ];

  const templates = new Set(['base']);

  if (useGit) {
    templates.add('git');
    execa.sync('git', ['init'], { cwd: internalName });
  }

  if (!true) {
    templates.add('test');
    devDependencies.push('jest', 'ts-jest');
    packageJson.scripts.test = 'jest';
    packageJson.jest = {
      projects: ['<rootDir>/src/vscripts.test', '<rootDir>/src/panorama.test'],
    };
  }

  if (conventionalCommits) {
    templates.add('conventional-commits');
    devDependencies.push('husky', '@commitlint/cli', '@commitlint/config-conventional');
    packageJson.husky = { hooks: { 'commit-msg': 'commitlint -E HUSKY_GIT_PARAMS' } };
    packageJson.commitlint = { extends: '@commitlint/config-conventional' };
  }

  if (includeExamples) {
    templates.add('examples');
    dependencies.push('lodash', '@types/lodash', 'date-fns@next');
  }

  await Promise.all(
    [...templates].map(async template => {
      const rootPath = path.join(__dirname, '..', 'templates', template);
      const files = await globby('**/*', { cwd: rootPath, dot: true });
      await Promise.all(
        files.map(async fileName => {
          let fileContent = await fs.readFile(path.join(rootPath, fileName), 'utf8');
          if (path.extname(fileName) === '.ts') {
            fileContent = fileContent.replace(/\/\/ if (.+?): (.+)/g, (_, condition, expression) =>
              templates.has(condition) ? expression : '',
            );
          }

          // See: https://github.com/npm/npm/issues/1862
          if (fileName === '_gitignore') fileName = '.gitignore';
          await outputFile(fileName, fileContent);
        }),
      );
    }),
  );

  await outputJson('package.json', packageJson);
  try {
    await runPackageManager(['add', ...dependencies]);
    await runPackageManager(['add', '-D', ...devDependencies]);
  } catch {
    throw { message: 'Failed to install dependencies' };
  }
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});

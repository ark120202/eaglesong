import fs from 'fs-extra';
import inquirer from 'inquirer';

async function prompt(question: inquirer.DistinctQuestion) {
  const { value } = await inquirer.prompt<{ value: any }>([{ ...question, name: 'value' }]);
  await new Promise<void>((resolve) => setTimeout(resolve, 10));
  return value;
}

const promptString = (question: inquirer.InputQuestion): Promise<string> => prompt(question);

export async function ask() {
  const transformInternalName = (input: string) =>
    input
      .toLowerCase()
      .replace(/ ?& ?/g, '-and-')
      .replace(/[ _]/g, '-')
      // eslint-disable-next-line unicorn/regex-shorthand
      .replace(/[^a-z\d-]/g, '');

  // https://github.com/SBoudrias/Inquirer.js/issues/538
  const validateInternalName = (name: string) => {
    if (name === '') return 'Name should not be empty';
    if (fs.pathExistsSync(name)) {
      if (!fs.statSync(name).isDirectory()) {
        return 'A file with that name already exists';
      }

      if (fs.readdirSync(name).length > 0) {
        return "A directory with that name already exists and it's not empty";
      }
    }

    return true;
  };

  const displayName = await promptString({
    message: 'Display Name:',
    validate: (name) => (name === '' ? 'Name should not be empty' : true),
  });

  const internalName = await promptString({
    message: 'Internal Name:',
    validate: validateInternalName,
    transformer: transformInternalName,
    default: transformInternalName(displayName),
  });

  const extraFeatures = await prompt({
    message: 'Extra features',
    type: 'checkbox',
    choices: [
      {
        value: 'includeExamples',
        name: 'Include examples',
        checked: true,
      },
      {
        value: 'useESLint',
        name: 'Validate code with ESLint',
        checked: true,
      },
      {
        value: 'usePrettier',
        name: 'Enforce code style consistency with Prettier',
        checked: true,
      },
      {
        value: 'conventionalCommits',
        name: 'Enforce conventional commits (https://www.conventionalcommits.org/)',
      },
    ],
  });

  console.log('');

  return {
    displayName,
    internalName,
    includeExamples: extraFeatures.includes('includeExamples'),
    useESLint: extraFeatures.includes('useESLint'),
    usePrettier: extraFeatures.includes('usePrettier'),
    conventionalCommits: extraFeatures.includes('conventionalCommits'),
  };
}

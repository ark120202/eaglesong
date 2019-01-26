const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig.json');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/**/*.ts?(x)'],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths),
};

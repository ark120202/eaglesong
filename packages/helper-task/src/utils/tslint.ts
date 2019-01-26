import { ServiceErrorReporter } from '@eaglesong/helper-service';
import * as tslint from 'tslint';
import * as ts from 'typescript';

export function runTsLint(error: ServiceErrorReporter, configPath: string, program: ts.Program) {
  const linter = new tslint.Linter({ fix: false }, program);
  const tslintConfig = tslint.Configuration.loadConfigurationFromPath(configPath);
  program
    .getRootFileNames()
    .map(n => program.getSourceFile(n))
    .filter(<T>(x: T | undefined): x is T => x != null)
    .forEach(f => linter.lint(f.fileName, f.getText(), tslintConfig));

  linter.getResult().failures.forEach(err => {
    const severity = err.getRuleSeverity();
    if (severity === 'off') return;

    const { line, character } = err.getStartPosition().getLineAndCharacter();
    const pos = `(${line},${character})`;
    error(err.getFileName(), `${pos} ${err.getRuleName()}: ${err.getFailure()}`, severity);
  });
}

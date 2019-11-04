import * as ts from 'typescript';
import * as tstl from 'typescript-to-lua';

export class LuaTransformer extends tstl.LuaTransformer {
  protected createModuleRequire(moduleSpecifier: ts.StringLiteral, resolveModule = true) {
    const modulePath = tstl.createStringLiteral(moduleSpecifier.text);
    const requireSpecifier = resolveModule
      ? tstl.createCallExpression(tstl.createIdentifier('__TS__Resolve'), [modulePath])
      : modulePath;

    return tstl.createCallExpression(
      tstl.createIdentifier('require'),
      [requireSpecifier],
      moduleSpecifier,
    );
  }
}

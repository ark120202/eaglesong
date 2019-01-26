import { LuaTransformer } from 'typescript-to-lua/dist/LuaTransformer';

// @ts-ignore
class UntypedCustomLuaTransformer extends LuaTransformer {
  public getAbsoluteImportPath(relativePath: string): string {
    // tslint:disable-next-line: no-string-literal
    // const currentSourceFile: ts.SourceFile = this['currentSourceFile'];
    // return this._useDependency(currentSourceFile.fileName, relativePath);
    return relativePath;
  }

  public getImportPath(relativePath: string): string {
    // tslint:disable-next-line: no-string-literal
    // return this['formatPathToLuaPath'](this.getAbsoluteImportPath(relativePath));
    // return this.getAbsoluteImportPath(relativePath);
    return relativePath;
  }
}

// tslint:disable-next-line: variable-name
export const CustomLuaTransformer = (UntypedCustomLuaTransformer as unknown) as typeof LuaTransformer;

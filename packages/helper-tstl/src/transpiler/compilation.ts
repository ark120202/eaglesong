import resolve from 'resolve';
import ts from 'typescript';
import tstl from 'typescript-to-lua';
import path from 'upath';

const REQUIRE_REGEXP = /require *(?:\( *'(.*?)' *\)|\( *"(.*?)" *\)| *'(.*?)'| *"(.*?)")/g;
export const replaceImports = (code: string, replacer: (module: string) => string | Error) =>
  code.replace(REQUIRE_REGEXP, (source, m1, m2, m3, m4) => {
    const replacement = replacer(m4 || m3 || m2 || m1);
    return replacement instanceof Error
      ? `--[[ ${source} ]] error(${JSON.stringify(replacement.message)})`
      : `require(${JSON.stringify(replacement)})`;
  });

export interface ModuleLoadingError {
  fileName: string;
  message: string;
}

export interface CompilationHost {
  writeFile: ts.WriteFileCallback;
  readFile(fileName: string, encoding?: string): string | undefined;
}

// TODO: JIT -> jit?
type PackageLuaField = string | Record<tstl.LuaTarget, string>;

export class Compilation {
  protected errors: ModuleLoadingError[] = [];
  protected files = new Set<string>();
  protected options: tstl.CompilerOptions;
  constructor(program: ts.Program, protected host: CompilationHost = ts.sys) {
    this.options = program.getCompilerOptions();
  }

  protected used = false;
  public emit(files: tstl.TranspiledFile[]) {
    if (this.used) throw new Error('Compilation can be used only once');
    this.used = true;

    files
      .filter(({ lua }) => lua !== undefined)
      .forEach(({ fileName }) => this.files.add(fileName));

    const emitBOM = this.options.emitBOM || false;
    for (const { fileName, lua, sourceMap, declaration, declarationMap } of files) {
      const pathWithoutExtension = this.toAbsolutePath(
        this.toOutputStructure(this.getRelativeToRootPath(path.trimExt(fileName))),
      );

      if (lua !== undefined) {
        const transformedLua = this.transformLuaFile(fileName, lua);
        this.host.writeFile(`${pathWithoutExtension}.lua`, transformedLua, emitBOM);
      }

      if (sourceMap !== undefined && this.options.sourceMap) {
        this.host.writeFile(`${pathWithoutExtension}.lua.map`, sourceMap, emitBOM);
      }

      if (declaration !== undefined) {
        this.host.writeFile(`${pathWithoutExtension}.d.ts`, declaration, emitBOM);
      }

      if (declarationMap !== undefined) {
        this.host.writeFile(`${pathWithoutExtension}.d.ts.map`, declarationMap, emitBOM);
      }
    }

    return { errors: this.errors };
  }

  protected useFile(filePath: string) {
    filePath = path.normalize(filePath);
    if (!path.isAbsolute(filePath)) {
      throw new Error('Absolute file path expected');
    }

    if (this.files.has(filePath)) return;
    this.files.add(filePath);

    let result: string;
    const extension = path.extname(filePath);
    switch (extension) {
      case '.lua': {
        const content = this.host.readFile(filePath);
        if (content !== undefined) {
          result = this.transformLuaFile(filePath, content);
        } else {
          const message = "Couldn't read a lua file";
          this.errors.push({ fileName: filePath, message });
          result = `error("${message}")`;
        }

        break;
      }

      case '.json':
      case '.js':
      case '.jsx':
      case '.ts':
      case '.tsx': {
        const message = "Couldn't import script file outside of TypeScript project";
        this.errors.push({ fileName: filePath, message });
        result = `error("${message}")`;
        break;
      }

      default: {
        const message = `${extension} is unknown`;
        this.errors.push({ fileName: filePath, message });
        result = `error("${message}")`;
      }
    }

    const pathWithoutExtension = this.toAbsolutePath(
      this.toOutputStructure(this.getRelativeToRootPath(path.trimExt(filePath))),
    );
    this.host.writeFile(`${pathWithoutExtension}.lua`, result, this.options.emitBOM || false);
  }

  protected transformLuaFile(filePath: string, fileContent: string) {
    if (this.options.resolveDependencies === false) return fileContent;

    return replaceImports(fileContent, request => {
      if (request === 'lualib_bundle') return request;

      let modulePath: string;
      try {
        modulePath = this.resolveDependency(filePath, request);
      } catch (error) {
        this.errors.push({ fileName: filePath, message: error.message });
        return error;
      }

      this.useFile(modulePath);
      return this.toLuaPath(
        this.toOutputStructure(this.getRelativeToRootPath(path.trimExt(modulePath))),
      );
    });
  }

  protected resolveDependency(issuer: string, request: string) {
    const resolved = resolve.sync(request, {
      basedir: path.dirname(issuer),
      extensions: ['.lua', '.ts', '.tsx', ...(this.options.allowJs ? ['.js', '.jsx'] : [])],
      readFileSync: (fileName, encoding) => this.host.readFile(fileName, encoding)!,
      packageFilter: (pkg, pkgFile) => {
        delete pkg.main;

        // FIXME: https://github.com/typescript-eslint/typescript-eslint/issues/723
        // eslint-disable-next-line prefer-destructuring
        const lua: PackageLuaField = pkg.lua;
        if (lua !== undefined) {
          if (typeof lua === 'string') {
            pkg.main = lua;
          } else if (typeof lua === 'object') {
            const luaTarget = this.options.luaTarget || tstl.LuaTarget.LuaJIT;
            pkg.main = lua[luaTarget];
            if (pkg.main === undefined) {
              throw new Error(`${pkgFile} not supports Lua ${luaTarget} target`);
            }
          } else {
            // eslint-disable-next-line unicorn/prefer-type-error
            throw new Error(`${pkgFile} has invalid "lua" field value`);
          }
        }

        return pkg;
      },
    });

    if (resolve.isCore(resolved)) {
      throw new Error(`${resolved} is core Node.js module`);
    }

    return resolved;
  }

  protected getRelativeToRootPath(fileName: string) {
    if (this.options.rootDir || this.options.rootDirs) {
      const roots: string[] = [];
      if (this.options.rootDirs) roots.push(...this.options.rootDirs);
      if (this.options.rootDir != null) roots.unshift(this.options.rootDir);

      return roots.map(d => path.relative(d, fileName)).find(x => !x.startsWith('..')) || fileName;
    }

    return fileName;
  }

  protected toOutputStructure(fileName: string) {
    let result = fileName;

    const upRelative = result.replace(/^(\.\.[/\\])*/, '');
    if (upRelative.startsWith('node_modules')) result = upRelative;

    if (result.startsWith('..') || path.isAbsolute(result)) {
      throw new Error(`Couldn't resolve "${fileName}" within rootDir(s)`);
    }

    return result.replace(/\./g, '__dot__');
  }

  protected toLuaPath(fileName: string) {
    return fileName.replace(/[\\/]/g, '.');
  }

  protected toAbsolutePath(fileName: string) {
    return path.resolve(this.options.outDir!, fileName);
  }
}

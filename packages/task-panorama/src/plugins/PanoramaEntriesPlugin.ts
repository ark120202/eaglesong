import parseJson from 'json-parse-better-errors';
import { promisify } from 'util';
import webpack from 'webpack';
import ModuleDependency from 'webpack/lib/dependencies/ModuleDependency';
import { makePathsRelative } from 'webpack/lib/util/identifier';
import WebpackError from 'webpack/lib/WebpackError';
import { XmlChunk } from './HtmlWebpackXmlPlugin';

class PanoramaManifestError extends WebpackError {
  public name = 'PanoramaManifestError';
  constructor(filename: string, message: string) {
    super(`Panorama manifest ${filename}\n${message}`);
    Error.captureStackTrace(this, this.constructor);
  }
}

class PanoramaEntryDependency extends ModuleDependency {
  public readonly type = 'panorama entry';
}

export interface Entry {
  name: string;
  source: string;
  type: string | null;
}

export class PanoramaEntriesPlugin {
  constructor(private readonly manifest: string) {}

  public apply(compiler: webpack.Compiler) {
    // FIXME:
    delete compiler.options.entry;

    // @ts-ignore
    // eslint-disable-next-line prefer-destructuring
    const context: string = compiler.context;
    // @ts-ignore
    const readFile: (path: string) => Promise<Buffer> = promisify(
      compiler.inputFileSystem.readFile.bind(compiler.inputFileSystem),
    );

    compiler.hooks.compilation.tap(
      this.constructor.name,
      (compilation, { normalModuleFactory }) => {
        // @ts-ignore
        compilation.dependencyFactories.set(PanoramaEntryDependency, normalModuleFactory);
      },
    );

    compiler.hooks.make.tapPromise(this.constructor.name, async compilation => {
      // @ts-ignore
      compilation.compilationDependencies.add(this.manifest);
      const result = await readFile(this.manifest);
      let entries: Entry[];
      try {
        entries = parseJson(result.toString('utf8'));
      } catch (error) {
        // @ts-ignore
        const manifestPath = makePathsRelative(compiler.options.context, this.manifest);
        compilation.errors.push(new PanoramaManifestError(manifestPath, error.message));
        return;
      }

      await Promise.all(
        entries.map(async ({ source, name }) => {
          const dep = new PanoramaEntryDependency(source);
          dep.loc = { name };
          await new Promise<void>(resolve => compilation.addEntry(context, dep, name, resolve));
        }),
      );

      compilation.hooks.reviveChunks.tap(this.constructor.name, chunks => {
        for (const chunk of chunks) {
          const entry = entries.find(e => e.name === chunk.name);
          if (entry?.type != null) {
            (chunk as XmlChunk).__type = entry.type;
          }
        }
      });
    });
  }
}

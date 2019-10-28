import posthtml from 'posthtml';
import webpack from 'webpack';

export const dependencies = (
  context: webpack.loader.LoaderContext,
  additionalScripts: string[],
): posthtml.Plugin => (tree: posthtml.Api) => {
  const root = tree.find((n): n is posthtml.Node => typeof n === 'object' && n.tag === 'root');
  const newTags: { scripts: string[]; styles: string[] } = {
    styles: [],
    scripts: [...additionalScripts],
  };

  tree.match({ tag: 'dependency', attrs: { src: true } }, node => {
    const src = node.attrs.src!;

    if (src.endsWith('.js') || src.endsWith('.vjs_c')) {
      newTags.scripts.push(src);
    } else if (src.endsWith('.css') || src.endsWith('.vcss_c')) {
      newTags.styles.push(src);
    } else if (src !== 'error://') {
      context.emitError(new Error(`Dependency '${src}' has invalid extension`));
    }

    return false;
  });

  const includes: posthtml.NodeTree = [
    '\n',
    ...Object.entries(newTags).flatMap(([tag, sources]) => {
      if (sources.length === 0) return [];

      const node: posthtml.Node = {
        tag,
        attrs: {},
        content: [
          '\n',
          ...sources.flatMap(src => [{ tag: 'include', attrs: { src }, content: [] }, '\n']),
        ],
      };

      return [node, '\n'];
    }),
  ];

  if (includes.length > 0) {
    if (!root) throw new Error('Root node not found');
    root.content = [
      ...includes,
      ...root.content.filter(
        (n, i) =>
          typeof n !== 'string' || (n.trim() === '' && typeof root.content[i - 1] === 'object'),
      ),
    ];
  }

  return tree;
};

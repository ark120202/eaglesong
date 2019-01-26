import posthtml from 'posthtml';

export function dependencies(additionalScripts: string[]): posthtml.Plugin {
  return (tree: posthtml.Api) => {
    const root = tree.find((n): n is posthtml.Node => typeof n === 'object' && n.tag === 'root');
    const newTags: { scripts: string[]; styles: string[] } = {
      scripts: [...additionalScripts],
      styles: [],
    };

    tree.match({ tag: 'dependency', attrs: { src: true } }, node => {
      const src = node.attrs.src!;

      if (src.endsWith('.js') || src.endsWith('.vjs_c')) {
        newTags.scripts.push(src);
      } else if (src.endsWith('.css') || src.endsWith('.vcss_c')) {
        newTags.styles.push(src);
      } else if (src !== 'ModuleBuildError') {
        throw new Error(`Dependency "${src}" has invalid extension`);
      }

      return false;
    });

    const includes = Object.entries(newTags).reduce<posthtml.NodeTree>(
      (acc, [tag, sources]) => {
        if (sources.length === 0) return acc;

        const node: posthtml.Node = {
          tag,
          attrs: {},
          content: sources.reduce<posthtml.NodeTree>(
            (nodes, src) => [
              ...nodes,
              {
                attrs: { src },
                content: [],
                tag: 'include',
              },
              '\n',
            ],
            ['\n'],
          ),
        };

        return [...acc, node, '\n'];
      },
      ['\n'],
    );

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
}

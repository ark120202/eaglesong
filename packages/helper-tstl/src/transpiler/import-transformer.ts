import * as ts from 'typescript';

// Internal
interface EmitResolver {
  isValueAliasDeclaration(node: ts.Node): boolean;
  isReferencedAliasDeclaration(node: ts.Node, checkChildren?: boolean): boolean;
  moduleExportsSomeValue(moduleReferenceExpression: ts.Expression): boolean;
}

// Internal
const isNamedImportBindings = (node: ts.Node): node is ts.NamedImportBindings =>
  node.kind === ts.SyntaxKind.NamedImports || node.kind === ts.SyntaxKind.NamespaceImport;

// TS compiler doesn't have `strictFunctionTypes` enabled
type TypedVisitor<T extends ts.Node> = (node: T) => ts.VisitResult<ts.Node>;
const typedVisitNode = <T extends ts.Node, U extends ts.Node>(
  node: T | undefined,
  visitor: TypedVisitor<U>,
  test: (node: ts.Node) => node is U,
) => ts.visitNode(node, visitor as ts.Visitor, test);

const typedVisitNodes = <T extends ts.Node, U extends ts.Node>(
  nodes: ts.NodeArray<T> | undefined,
  visitor: TypedVisitor<U>,
  test: (node: ts.Node) => node is U,
) => ts.visitNodes(nodes, visitor as ts.Visitor, test);

// Based on https://github.com/Microsoft/TypeScript/blob/025d82633915b67003ea38ba40b9239a19721c13/src/compiler/transformers/ts.ts
export const createImportElideTransformer = (): ts.TransformerFactory<ts.SourceFile> => context => {
  const resolver: EmitResolver = (context as any).getEmitResolver();

  function visitSourceFile(node: ts.SourceFile) {
    return ts.updateSourceFileNode(node, ts.visitNodes(node.statements, sourceElementVisitor));
  }

  function sourceElementVisitor(node: ts.Node): ts.VisitResult<ts.Node> {
    switch (node.kind) {
      case ts.SyntaxKind.ImportDeclaration:
        return visitImportDeclaration(node as ts.ImportDeclaration);
      case ts.SyntaxKind.ExportDeclaration:
        return visitExportDeclaration(node as ts.ExportDeclaration);
      default:
        return node;
    }
  }

  function visitImportDeclaration(node: ts.ImportDeclaration): ts.VisitResult<ts.Statement> {
    if (!node.importClause) {
      // Do not elide a side-effect only import declaration.
      //  import "foo";
      return node;
    }

    // Elide the declaration if the import clause was elided.
    const importClause = typedVisitNode(node.importClause, visitImportClause, ts.isImportClause);
    return importClause
      ? ts.updateImportDeclaration(node, undefined, undefined, importClause, node.moduleSpecifier)
      : undefined;
  }

  function visitImportClause(node: ts.ImportClause): ts.VisitResult<ts.ImportClause> {
    // Elide the import clause if we elide both its name and its named bindings.
    const name = resolver.isReferencedAliasDeclaration(node) ? node.name : undefined;
    const namedBindings = typedVisitNode(
      node.namedBindings,
      visitNamedImportBindings,
      isNamedImportBindings,
    );
    return name || namedBindings ? ts.updateImportClause(node, name, namedBindings) : undefined;
  }

  function visitNamedImportBindings(
    node: ts.NamedImportBindings,
  ): ts.VisitResult<ts.NamedImportBindings> {
    if (node.kind === ts.SyntaxKind.NamespaceImport) {
      return resolver.isReferencedAliasDeclaration(node) ? node : undefined;
    }

    const elements = typedVisitNodes(node.elements, visitImportSpecifier, ts.isImportSpecifier);
    return elements.length > 0 ? ts.updateNamedImports(node, elements) : undefined;
  }

  function visitImportSpecifier(node: ts.ImportSpecifier): ts.VisitResult<ts.ImportSpecifier> {
    return resolver.isReferencedAliasDeclaration(node) ? node : undefined;
  }

  function visitExportDeclaration(node: ts.ExportDeclaration): ts.VisitResult<ts.Statement> {
    if (!node.exportClause) {
      // Elide a star export if the module it references does not export a value.
      return resolver.moduleExportsSomeValue(node.moduleSpecifier!) ? node : undefined;
    }

    if (!resolver.isValueAliasDeclaration(node)) {
      // Elide the export declaration if it does not export a value.
      return;
    }

    // Elide the export declaration if all of its named exports are elided.
    const exportClause = typedVisitNode(node.exportClause, visitNamedExports, ts.isNamedExports);
    return exportClause
      ? ts.updateExportDeclaration(node, undefined, undefined, exportClause, node.moduleSpecifier)
      : undefined;
  }

  function visitNamedExports(node: ts.NamedExports): ts.VisitResult<ts.NamedExports> {
    // Elide the named exports if all of its export specifiers were elided.
    const elements = typedVisitNodes(node.elements, visitExportSpecifier, ts.isExportSpecifier);
    return elements.length > 0 ? ts.updateNamedExports(node, elements) : undefined;
  }

  function visitExportSpecifier(node: ts.ExportSpecifier): ts.VisitResult<ts.ExportSpecifier> {
    // Elide an export specifier if it does not reference a value.
    return resolver.isValueAliasDeclaration(node) ? node : undefined;
  }

  return file => visitSourceFile(file);
};

import {get} from '../utils/get';

// expression-eval: Small jsep based expression parser that supports array and object indexing
import expressionEval from 'expression-eval';

const cachedExpressionMap = {
  '-': object => object
};

// Calculates an accessor function from a JSON string
// '-' : x => x
// 'a.b.c': x => x.a.b.c
export default function parseStringExpression(propValue, configuration, isAccessor) {
  // NOTE: Can be null which represents invalid function. Return null so that prop can be ommitted
  if (propValue in cachedExpressionMap) {
    return cachedExpressionMap[propValue];
  }

  let func;
  // Compile with expression-eval
  const ast = expressionEval.parse(propValue);
  if (!ast.right && !ast.left && ast.type === 'Identifier') {
    func = row => get(row, propValue);
  } else {
    // NOTE: To avoid security risks, the arguments passed to the
    // compiled expresion must only give access to pure data (no globals etc)
    // We disable function call syntax?
    traverse(ast, node => {
      if (node.type === 'CallExpression') {
        throw new Error('Function calls not allowed in JSON expressions');
      }
    });
    func = isAccessor
      ? row => expressionEval.eval(ast, row)
      : // TBD - how do we pass args to general (non-accessor) functions?
        args => expressionEval.eval(ast, {args});
  }

  // Cache the compiled function
  cachedExpressionMap[propValue] = func;
  return func;
}

// Helper function to search all nodes in AST returned by expressionEval
// eslint-disable-next-line complexity
function traverse(node, visitor) {
  if (Array.isArray(node)) {
    node.forEach(element => traverse(element, visitor));
  } else if (node && typeof node === 'object') {
    if (node.type) {
      visitor(node);
    }
    for (const key in node) {
      traverse(node[key], visitor);
    }
  }
}
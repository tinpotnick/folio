/**
 * Minimal type surface for jexl (v2.3.0 ships no TypeScript
 * declarations). Only the API folio uses: synchronous evaluation
 * (and compiling an expression once to evaluate it per row), custom
 * binary operators, and transforms (ADR-0012).
 */
declare module "jexl" {
  /** A parsed expression, evaluated many times. */
  export interface Expression {
    evalSync(context?: Record<string, unknown>): unknown;
  }
  export interface Jexl {
    evalSync(expr: string, context?: Record<string, unknown>): unknown;
    compile(expr: string): Expression;
    addBinaryOp(
      name: string,
      precedence: number,
      fn: (left: unknown, right: unknown) => unknown,
    ): void;
    addTransform(
      name: string,
      fn: (value: unknown, ...args: unknown[]) => unknown,
    ): void;
    addFunction(
      name: string,
      fn: (value: unknown, ...args: unknown[]) => unknown,
    ): void;
  }
  const jexl: Jexl;
  export default jexl;
}

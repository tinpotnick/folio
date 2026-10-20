/**
 * Minimal type surface for jexl (v2.3.0 ships no TypeScript
 * declarations). Only the API folio uses: synchronous evaluation,
 * custom binary operators, and transforms (ADR-0012).
 */
declare module "jexl" {
  export interface Jexl {
    evalSync(expr: string, context?: Record<string, unknown>): unknown;
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

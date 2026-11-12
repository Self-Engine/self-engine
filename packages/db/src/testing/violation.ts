/** One broken schema rule, optionally narrowed to a column. */
export interface SchemaViolation {
  readonly table: string;
  readonly column?: string;
  readonly rule: string;
}

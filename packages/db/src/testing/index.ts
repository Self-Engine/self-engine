// For tests only: the checks a module's tests run against its database.

export { checkConventions } from "./conventions.ts";
export type {
  SchemaViolation,
  SchemaViolation as ConventionViolation,
  SchemaViolation as AgreementViolation,
} from "./violation.ts";
export { checkAgreement } from "./agreement.ts";

export type { TestSources } from "./test-sources.ts";
export { createTestSources } from "./test-sources.ts";

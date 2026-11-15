import { idSchema } from "@self-engine/db/schema";
import type { z } from "zod";

export const projectIdSchema = idSchema("Project");
/** A project's id, branded so no other entry's id takes its place. */
export type ProjectId = z.output<typeof projectIdSchema>;

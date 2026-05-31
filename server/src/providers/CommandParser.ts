import type { z } from "zod";
import type { commandResponseSchema, CommandRequest } from "../schemas.js";

export type CommandResponse = z.infer<typeof commandResponseSchema>;

export interface CommandParser {
  parse(input: CommandRequest): Promise<CommandResponse>;
}

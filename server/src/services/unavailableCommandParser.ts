import { commandResponseSchema } from "../schemas.js";
import type { CommandParser, CommandResponse } from "../providers/CommandParser.js";
import type { CommandRequest } from "../schemas.js";

const UNAVAILABLE_MESSAGE =
  "Gemini command agent is not configured. Set GEMINI_API_KEY on the backend to enable chat-driven scene edits.";

export class UnavailableCommandParser implements CommandParser {
  async parse(_input: CommandRequest): Promise<CommandResponse> {
    return commandResponseSchema.parse({
      message: UNAVAILABLE_MESSAGE
    });
  }
}

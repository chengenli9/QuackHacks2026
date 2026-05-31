import type { CommandParser, CommandResponse } from "../providers/CommandParser.js";
import type { CommandRequest } from "../schemas.js";

export class FallbackCommandParser implements CommandParser {
  constructor(
    private readonly primary: CommandParser,
    private readonly fallback: CommandParser
  ) {}

  async parse(input: CommandRequest): Promise<CommandResponse> {
    try {
      return await this.primary.parse(input);
    } catch {
      return this.fallback.parse(input);
    }
  }
}

export const USAGE = `Usage: ccprofile <command> [options]

Run Claude Code under separate, fully isolated configurations — one per area of work.

Commands:
  new <name> [--no-launch]     Create a Profile and launch it, so you can log in
  run [name] [-y] [-- args…]   Launch Claude Code under a Profile, forwarding args to claude
  list [--json]                List Profiles with their Profile Identity and last-used time
  current                      Which Profile this session is running under
  path <name>                  Absolute path to a Profile
  default [name]               Get or set the Profile used when run names none

Options:
  -y, --yes                    Answer yes to the confirmation prompt (run, new)
  -h, --help                   Show this help
  -v, --version                Show the version

Environment:
  CCP_PROFILES_DIR             Where Profiles live (default: $CLAUDE_CONFIG_DIR/profiles,
                               otherwise ~/.claude/profiles)
`;

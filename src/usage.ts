/**
 * Every command listed here now works, and so does every option: they are
 * listed only once they do. `-y/--yes` is `run`'s rather than global, so it
 * sits on that command's line as well as under Options, where the question it
 * answers can be named.
 */
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
  -h, --help                   Show this help
  -v, --version                Show the version
  -y, --yes                    For run: override a CLAUDE_CONFIG_DIR you set without asking

Environment:
  CCP_PROFILES_DIR             Where Profiles live (default: $CLAUDE_CONFIG_DIR/profiles,
                               otherwise ~/.claude/profiles)
  CLAUDE_CONFIG_DIR            If you set this yourself, run asks before overriding it
`;

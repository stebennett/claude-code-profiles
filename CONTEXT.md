# ccprofile

A tool for keeping several independent Claude Code configurations on one machine and launching Claude Code against a chosen one, so that separate areas of work do not share configuration.

## Language

**Config Directory**:
The directory Claude Code reads its user-level configuration and state from. Claude Code reads exactly one per session.
_Avoid_: config folder, dotfile directory, `.claude`

**Profile**:
A named Config Directory representing one area of work. A Profile is the source of truth for its own contents: it is edited directly, never generated or reconciled from a declaration elsewhere. A directory is a Profile by virtue of its name and its location in the Profiles Root, and nothing else.
_Avoid_: workspace, environment, context, persona

**Profile Identity**:
The Claude account a Profile is authenticated as. Each Profile authenticates separately, so two Profiles may hold different accounts. A Profile has no Identity until someone logs in to it.
_Avoid_: login, account, credentials, auth profile

**Profiles Root**:
The single directory containing every named Profile. Its location is configurable independently of any Config Directory.
_Avoid_: profile store, profiles home, profile directory

**Active Profile**:
The Profile a Run selected, recorded in the environment of the launched session so that the session can identify which Profile it is operating under.
_Avoid_: current profile, selected profile, active config

**Bare Config Directory**:
The Config Directory Claude Code reads when no Profile has been selected. It is not a Profile and is never managed by this tool.
_Avoid_: default, default profile, root config

**Default Profile**:
The Profile this tool selects when a Run names no Profile. It is configurable, and is therefore not necessarily the Bare Config Directory — the two are distinct concepts that deliberately may resolve differently.
_Avoid_: default config, primary profile

**Run**:
To launch Claude Code against a chosen Profile. A Run selects its Profile at launch; a Profile cannot be changed for a session already in progress.
_Avoid_: switch, activate, use

# Analysis of /md Command Directory Issue

## Problem Description
The user reported that running the `/md` command in the bot returned markdown files from the bot's installation directory, even though the bot's terminal session (xterm) had been navigated to a different directory.

## Root Cause Analysis
The issue stems from how the `/md` command determines the directory to search for markdown files.

In `src/features/coder/coder.bot.ts`, the `handleMd` method uses:
```typescript
const cwd = process.cwd();
```

`process.cwd()` returns the current working directory of the **Node.js process** that is running the bot application. This directory is static and typically corresponds to the location where the bot was started (e.g., `/home/tom/coderBOT`).

However, the interactive terminal session provided by the bot (via `/xterm`, `/copilot`, etc.) runs as a separate child process (managed by `node-pty`). When a user executes `cd` commands within this terminal session, only the **child process's** working directory changes. The parent Node.js process remains in its original starting directory.

## Technical Details
1.  **Process Separation**: The bot consists of a main Node.js process and one or more child processes (shells) for the interactive sessions.
2.  **Context Isolation**: The `/md` command is a "native" bot command executed by the Node.js process. It does not execute within the context of the shell session.
3.  **Missing Synchronization**: There is currently no mechanism to synchronize or query the current working directory of the shell process from the Node.js process. `node-pty` does not provide a direct API to retrieve the dynamic CWD of the running shell.

## Conclusion
The `/md` command is working as currently implemented, but its implementation does not align with the user's expectation of context-awareness. It searches the bot's root directory instead of the user's current shell directory because it lacks access to the shell's state.

## Potential Solutions (For Future Reference)
To fix this, the bot would need a way to determine the shell's current directory. Common approaches include:
1.  **OSC 7 Injection**: Configuring the shell to emit an OSC 7 escape sequence whenever the directory changes, which the bot can parse from the output stream.
2.  **Lsof / Proc Parsing**: On Linux, inspecting `/proc/[pid]/cwd` of the shell process (if the bot has sufficient permissions and knows the PID).
3.  **Shell Integration**: Wrapping `cd` in the shell to report its location to the bot.

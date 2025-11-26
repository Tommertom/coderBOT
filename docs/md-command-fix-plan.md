# Plan: Fixing /md Command Context Awareness

This document analyzes the complexity and feasibility of three options to enable the `/md` command to detect the current working directory (CWD) of the user's terminal session.

## Option Analysis

### 1. OSC 7 Injection
**Concept:** Configure the shell (bash/zsh) to emit a standard escape sequence (OSC 7) containing the CWD whenever the prompt is displayed. The bot parses this from the output stream.

*   **Complexity:** **High**
*   **Implementation Details:**
    *   Requires injecting code into the shell's startup script (`.bashrc`) or sending it upon session initialization.
    *   Requires a parser in the bot's output stream handler to detect, extract, and strip these sequences so they don't clutter the visual output (unless the xterm renderer handles them natively).
*   **Pros:** Standard mechanism used by modern terminals (VS Code, iTerm2). Real-time updates.
*   **Cons:** Fragile setup; depends on the specific shell (bash vs zsh vs sh). Can be broken by user configuration changes. Parsing stream data adds overhead and complexity to the `XtermService`.

### 2. Lsof / Proc Parsing (Recommended)
**Concept:** Query the operating system directly to find the CWD of the shell process. On Linux, this is done by reading the symbolic link `/proc/[PID]/cwd`.

*   **Complexity:** **Low**
*   **Implementation Details:**
    *   `node-pty` exposes the Process ID (PID) of the shell session.
    *   Node.js can simply read the link: `fs.readlinkSync('/proc/' + pid + '/cwd')`.
*   **Pros:**
    *   **Zero intrusion:** No changes needed to the shell configuration or environment.
    *   **Robust:** Works regardless of how the user changed directories (cd, pushd, scripts).
    *   **Simple:** Minimal code changes in the bot (just a helper function in `XtermService`).
*   **Cons:** Platform specific. Works natively on Linux (current environment). macOS requires executing `lsof`, which is slower, but the bot is running on Linux.

### 3. Shell Integration (Wrapping `cd`)
**Concept:** Define a shell function `cd` that calls the real `cd` and then prints a special marker or sends a signal to the bot.

*   **Complexity:** **Medium**
*   **Implementation Details:**
    *   Requires injecting a shell function: `function cd() { builtin cd "$@"; echo "BOT_CWD:$PWD"; }`.
    *   Bot must parse the output for the `BOT_CWD:` marker.
*   **Pros:** Conceptually simple to understand.
*   **Cons:**
    *   **Intrusive:** Modifies the user's shell environment.
    *   **Fragile:** Can be bypassed if the user uses `builtin cd` or executes a script that changes directory.
    *   **Output Pollution:** The marker might be visible to the user if not perfectly intercepted.

## Recommendation

**Proceed with Option 2 (Proc Parsing).**

It offers the best balance of reliability and simplicity. Since the bot is running in a Linux environment, reading `/proc/[PID]/cwd` is a standard, efficient, and safe way to inspect a child process's state without interfering with its operation.

## Proposed Implementation Steps

1.  Modify `XtermService` to expose a method `getSessionCwd(userId: string): Promise<string>`.
2.  Implement the logic to retrieve the PID for the user's session.
3.  Use `fs.readlink` to resolve `/proc/[PID]/cwd`.
4.  Update `CoderBot.handleMd` to call this new method instead of `process.cwd()`.
5.  Add error handling (fallback to `process.cwd()` if the PID lookup fails).

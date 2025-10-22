# Auto-Refresh Feature Test Plan

## Test Environment Setup
1. Start the coderBOT application
2. Open Telegram and connect to the bot
3. Start a session with `/copilot`, `/claude`, or `/cursor`
4. Use `/screen` to take an initial screenshot

## Test Cases

### TC1: Basic Auto-Refresh Functionality
**Objective**: Verify that auto-refresh works after sending a text message

**Steps**:
1. Start a session and take a screenshot with `/screen`
2. Send a text message (e.g., "ls")
3. Wait and observe the screenshot

**Expected Result**:
- Screenshot updates automatically 5 times
- Each update occurs approximately every 5 seconds
- Total duration ~25 seconds
- Console logs show: "Started auto-refresh for user X"
- Console logs show: "Auto-refreshed screen for user X (1/5)" through "(5/5)"
- Console logs show: "Completed 5 auto-refreshes for user X"

### TC2: Auto-Refresh with /send Command
**Objective**: Verify auto-refresh works with /send command

**Steps**:
1. Start a session and take a screenshot
2. Send command `/send pwd`
3. Wait and observe

**Expected Result**:
- Auto-refresh starts and updates 5 times
- Same behavior as TC1

### TC3: Prevent Parallel Processes
**Objective**: Verify that sending multiple commands doesn't start parallel refresh processes

**Steps**:
1. Start a session and take a screenshot
2. Send a text message quickly
3. Immediately send another text message
4. Send a third text message
5. Check console logs

**Expected Result**:
- Only one "Started auto-refresh" message in logs
- Multiple "Auto-refresh already running" messages
- Single refresh process completes all 5 refreshes

### TC4: No Screenshot Available
**Objective**: Verify graceful handling when no screenshot exists

**Steps**:
1. Start a session (don't take a screenshot)
2. Send a text message

**Expected Result**:
- No auto-refresh starts
- Console log shows: "No last screenshot found for user X, skipping auto-refresh"
- No errors

### TC5: Session Closed During Refresh
**Objective**: Verify cleanup when session closes during auto-refresh

**Steps**:
1. Start session and take screenshot
2. Send a text message to start auto-refresh
3. After 2-3 refreshes, send `/close`
4. Check console logs

**Expected Result**:
- Auto-refresh stops immediately
- No error messages
- Console shows refresh stopped before completing 5 cycles

### TC6: XtermBot Commands
**Objective**: Verify auto-refresh works with xterm commands

**Steps**:
1. Start `/xterm` session
2. Use `/screen` to take screenshot
3. Test each command that should trigger auto-refresh:
   - `/keys test`
   - `/enter`
   - `/tab`
   - `/space`
   - `/delete`
   - `/ctrl c`
   - `/ctrlc`
   - `/ctrlx`
   - `/esc`
   - `/1`, `/2`, `/3`, `/4`, `/5`

**Expected Result**:
- Each command triggers auto-refresh
- Only one refresh process runs at a time (check logs)

### TC7: Manual Refresh During Auto-Refresh
**Objective**: Verify behavior when user manually refreshes

**Steps**:
1. Start session and take screenshot
2. Send text message to start auto-refresh
3. After 2 refreshes, click the 🔄 Refresh button
4. Observe behavior

**Expected Result**:
- Manual refresh creates new screenshot message
- Auto-refresh detects message ID change
- Auto-refresh stops automatically
- Console logs show: "Last screenshot changed for user X, stopping auto-refresh"

### TC8: Multiple Users
**Objective**: Verify isolation between different users

**Steps**:
1. Use two Telegram accounts
2. Both start sessions and take screenshots
3. User A sends a message
4. User B sends a message
5. Observe both auto-refreshes

**Expected Result**:
- Each user has independent auto-refresh
- Both refresh processes run simultaneously
- No interference between users

### TC9: Callback Query (Negative Test)
**Objective**: Verify callbacks don't trigger auto-refresh

**Steps**:
1. Start copilot/claude session (with confirmation prompts)
2. Take screenshot that shows numbered options
3. Click a callback button (e.g., number selection)

**Expected Result**:
- No auto-refresh starts
- Console shows no auto-refresh logs
- This is correct behavior (callbacks excluded per requirements)

### TC10: File Upload (Negative Test)
**Objective**: Verify file uploads don't trigger auto-refresh

**Steps**:
1. Start session and take screenshot
2. Upload a photo or file

**Expected Result**:
- No auto-refresh starts
- File is saved correctly
- No auto-refresh logs in console

## Performance Tests

### PT1: Memory Leak Check
**Steps**:
1. Start session
2. Send 50 text messages rapidly
3. Monitor memory usage

**Expected Result**:
- Memory usage remains stable
- Only one refresh process ever runs
- All intervals cleaned up properly

### PT2: Long Session
**Steps**:
1. Start session and keep alive for 1 hour
2. Periodically send messages (every 2 minutes)
3. Monitor system resources

**Expected Result**:
- No memory accumulation
- Each auto-refresh completes and cleans up
- System remains stable

## Debugging Tips

### Check Console Logs
Look for these log messages:
- `Started auto-refresh for user {userId}`
- `Auto-refreshed screen for user {userId} (X/5)`
- `Completed 5 auto-refreshes for user {userId}`
- `Auto-refresh already running for user {userId}, skipping new process`
- `No last screenshot found for user {userId}, skipping auto-refresh`
- `Last screenshot changed for user {userId}, stopping auto-refresh`

### Common Issues
1. **No auto-refresh starts**: Check if screenshot was taken first
2. **Multiple refreshes overlap**: Check if prevention logic is working
3. **Refresh doesn't stop**: Verify clearInterval is called
4. **Memory usage grows**: Check for orphaned intervals

## Success Criteria
- ✅ All test cases pass
- ✅ No errors in console logs
- ✅ Memory usage remains stable
- ✅ User experience is smooth (no lag)
- ✅ Only one refresh process per user at any time
- ✅ Auto-refresh stops after 5 iterations or on session close

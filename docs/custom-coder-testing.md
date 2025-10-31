# Custom Coder Feature - Testing Guide

## Quick Test Scenarios

### Test 1: Create Custom Coder
```
/addcoder pythonexpert
Expected: ✅ Custom coder "/pythonexpert" created successfully!
```

### Test 2: Use Custom Coder
```
/pythonexpert
Expected: Terminal session starts, works like /copilot
```

### Test 3: Set Startup for Custom Coder
```
/pythonexpert
/startup resume from last checkpoint
Expected: ✅ Startup prompt saved for /pythonexpert

/close
/pythonexpert
Expected: After 3 seconds, "resume from last checkpoint" is auto-sent
```

### Test 4: Remove Custom Coder
```
/removecoder pythonexpert
Expected: ✅ Custom coder "/pythonexpert" removed successfully.
```

### Test 5: Input Sanitization
```
/addcoder Python-Expert!123
Expected: ✅ Custom coder "/pythonexpert" created successfully!

/removecoder Python-Expert
Expected: ✅ Custom coder "/pythonexpert" removed successfully.
```

### Test 6: Session-Based Startup
```
/startup test
Expected: ❌ No active session. Please start a coder first...

/copilot
/startup /cwd coderBOT
Expected: ✅ Startup prompt saved for /copilot

/startup
Expected: Shows current startup prompt for /copilot

/startup delete
Expected: ✅ Startup prompt deleted for /copilot
```

### Test 7: Reserved Command Protection
```
/addcoder copilot
Expected: ❌ "copilot" is a reserved command. Choose a different name.
```

### Test 8: Multiple Coders with Different Startups
```
/copilot
/startup /cwd project1
/close

/pythonexpert
/startup analyze codebase
/close

/copilot
Expected: Auto-sends "/cwd project1"

/close
/pythonexpert
Expected: Auto-sends "analyze codebase"
```

### Test 9: Backward Compatibility
```
# If you have old copilot-bot-2.json file:
/copilot
Expected: Old startup prompt still works
```

### Test 10: Help Text
```
/help
Expected: Shows addcoder and removecoder commands
```

## Files to Check

After testing, verify these files exist:
- `customcoders/{userId}-pythonexpert.json`
- `startip/copilot-{botId}.json` (old format still works)
- `startip/pythonexpert-{botId}.json` (new format)

## Success Criteria

✅ Custom coders can be created
✅ Custom coders can be removed  
✅ Custom coders work like built-in assistants
✅ Startup requires active session
✅ Startup uses current coder automatically
✅ Input sanitization is consistent
✅ Backward compatibility maintained

# Problem: Bot Detection Due to Non-Human Behavior

## Overview
The current automation logic for ticket booking is being detected as a bot by the website. The issue is not only speed, but also repetitive and unnatural interaction patterns.

Even manual rapid clicking sometimes gets flagged, which indicates the system is sensitive to behavior patterns, not just raw speed.

---

## Current Behavior (Problematic)

- The script repeatedly clicks the target button in a tight loop
- When a modal appears:
  - It closes the modal immediately
  - Then instantly retries clicking again
- No proper waiting for UI state changes
- Fixed delay timing (or no delay at all)
- Actions are too consistent and predictable

---

## Why This Gets Detected

### 1. No State Awareness
The bot does not check whether:
- A modal is currently open
- The page is still loading
- The previous action has completed

→ It blindly continues execution

---

### 2. Aggressive Retry Loop
- Click → Modal → Close → Click again (immediately)
- Happens too fast and too frequently

→ Not human-like behavior

---

### 3. Predictable Timing
- Same delay every time (or near-zero delay)
- No randomness

→ Easy pattern detection

---

### 4. Unrealistic Interaction Speed
- Instant reaction after closing modal
- No hesitation

→ Humans always have small delays

---

## Expected Behavior (Human-like)

The bot should behave more like a real user:

1. Click button
2. Wait for response (modal / page change)
3. If modal appears:
   - Handle modal
   - Wait briefly
4. Retry action after a realistic delay

---

## Requirements for Fix

### 1. Add State Detection

Before every action, check:
- Is a modal/dialog currently open?
- Is the page still loading?

Example:
- Detect `[role="dialog"]` or modal class
- Detect loading indicators

---

### 2. Implement Human-like Delay

Replace fixed delays with randomized delays:

- Short delay: 300–800 ms
- Medium delay: 500–1500 ms
- Occasional longer hesitation: up to ~2500 ms

---

### 3. Avoid Immediate Retry After Modal

After closing a modal:
- Wait before retrying
- Simulate human reaction time

---

### 4. Smarter Retry Loop

Instead of:
- Infinite rapid clicking

Use:
- Controlled loop with:
  - Condition checks
  - Delays
  - State awareness

---

### 5. Add Timing Variability (Jitter)

- Randomize delay intervals
- Occasionally pause longer than usual
- Avoid consistent patterns

---

### 6. Rate Limiting

Ensure:
- Minimum interval between clicks
- Prevent overly frequent actions

---

## Suggested Improvements (High Level)

- Introduce `humanDelay(min, max)`
- Add `isModalOpen()` detection
- Add `handleModal()` flow
- Refactor main loop to:
  - Check state
  - Act accordingly
  - Wait dynamically

---

## Goal

Make the automation:
- Less predictable
- Less aggressive
- More state-aware
- Closer to real human interaction patterns

---

## Notes

This is not about making the bot faster, but making it:
> "More natural and less detectable"
# Real-iPhone review — fourth edition

Only what a real phone can tell. Everything else (layout at 320/390/430,
light/dark, keyboard access, contrast, the gesture edge cases) is covered by the
automated suites and the recorded motion review.

Open https://couple-platform-review.vercel.app in Safari, sign in as אור.
Try each item once with a finger, and once holding the phone in one hand.

## 1. Add a task (the keyboard)
- [ ] Tap **+ משימה**. The composer appears and the keyboard rises **in the same
      motion** — the field is already focused, with no second tap.
- [ ] While the keyboard rises, **nothing on the screen moves**: the ✕, the
      field and the chips stay exactly where they appeared.
- [ ] Type a sentence. The screen still does not move.
- [ ] Tap **נטיה**, then the send arrow (or ↵ on the keyboard). The arrow lifts
      away at once, the composer closes, and the new task slides into the list.
- [ ] After it closes, the list is where you left it (not scrolled, not shifted).

## 2. Choose a date
- [ ] Open the composer, tap the calendar chip. The keyboard goes down and a
      calendar appears under the chips. Today is ringed.
- [ ] Move to next month (‹ ›) and pick a day. The calendar closes and the chip
      shows the day you chose.
- [ ] Tap **שעה**. iOS's own time wheel opens.

## 3. Complete and reopen
- [ ] Tap a task's circle. It presses in, fills with the owner's colour, the
      tick draws, the line crosses the title, and a soft light passes through
      the row. **No other row moves.**
- [ ] The room's light on that person's side brightens for a moment.
- [ ] Tap again to reopen: it reverses quickly, still in place.

## 4. Rate (the swipe)
- [ ] On a finished task of נטיה's, tap **דרגו**. A sheet rises: the task, "איך
      יצא?", and a long coloured track.
- [ ] Put your thumb anywhere on the track and **slide slowly** end to end. The
      light follows your thumb, the word above changes (לא יצא → מושלם), and
      the sheet's glow changes colour with it.
- [ ] Hold still for two seconds without lifting. **Nothing is saved; the sheet
      stays.**
- [ ] Lift your thumb. The light settles, the word stays readable for a moment,
      then the sheet leaves and the row shows the word.
- [ ] Try a quick flick to one end. It lands on the end value.
- [ ] Start a slide, then drag your thumb **up** off the track and let go. It
      still commits what the word showed.
- [ ] Tap the word in the row to change it. The sheet opens on your answer.
- [ ] Drag the sheet down by its top handle. It follows your thumb and leaves.

## 5. Close the day
- [ ] Open סגירת היום (from Today when it is time, or from עוד).
- [ ] Slide along the track. **The whole screen re-lights under your thumb**:
      blue dusk at one end, warm morning at the other.
- [ ] Letting go does not close the day — the button does.

## 6. Safari itself
- [ ] Scroll Today up and down so the Safari toolbar hides and shows. The
      background light does not shift or jump.
- [ ] Rotate to landscape and back on the composer and the rating sheet.
- [ ] Turn on Reduce Motion (Settings → Accessibility → Motion) and repeat 3
      and 4: changes still happen, without movement.

Anything that moves when it should not, or makes you hesitate, is a bug. A
screen recording of it is the most useful report.

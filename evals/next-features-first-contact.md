---

name: next-features-first-contact
feature: select-columns / date-controls / cross-filtering / motion-in-slides
steps:

- Open the demo host on the sprint-plan example (palette: "Open
  example: Sprint plan").
- See status cells as chips; click one and pick another status from
  the dropdown; the totals row and charts follow.
- Click a target-date cell: a calendar opens; pick a date; the cell
  commits the ISO date.
- Click a bar in "Tasks and effort by status": the owner chart
  filters to it and a `status = ...` chip appears; click × to clear.
- Open the murmuration example and press Play: the swarm animates on
  its slide.
  expected:
- Select columns render chips and edit via dropdown (multi via
  checkable list); date/datetime cells edit via picker; totals and
  dependent charts recompute; cross-filter chips appear and clear
  (view-only, document unchanged); motion figures autoplay in slides.

---
name: bidi-first-contact
feature: bidi-typography
steps:
  - Start the demo host. Switch to Markdown view and type a short
    Arabic paragraph (e.g. a report line) alongside the English
    prose.
  - Switch to Document view.
  - Switch to Markdown view again and back.
expected:
  - The Arabic paragraph renders right-to-left and justifies to the
    RIGHT edge of the column, with no per-paragraph markup or
    settings; the English paragraphs stay left-justified.
  - The caret moves through the Arabic text sensibly and typing
    inserts correctly.
  - The source is plain text both directions - no dir attributes
    or alignment marks appear anywhere.
---

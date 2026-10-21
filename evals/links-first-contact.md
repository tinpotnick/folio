---
name: links-first-contact
feature: links
steps:
  - Start the demo host and open the Field operations example (palette: "Open example: field-operations") and scroll to
    the "More examples" section.
  - Click the "A pure-prose poem" link.
  - Go back to the sample (reload) and click into a paragraph;
    select a few words and press the chain-icon button in the
    format group.
  - In the bar that appears under the new link, type a label and
    a URL, and press Apply.
  - Click the new link; then select its text, press the chain
    button again, and press "Remove link".
expected:
  - The four example links render as styled links in the
    document.
  - Clicking opens the poem in place - the document view and the
    Markdown source both switch to it.
  - The selected words become a link and the bar appears with the
    label and URL pre-filled; Apply turns them into the working
    link.
  - Clicking the new link follows it; Remove link deletes the
    link but keeps its text, and the Markdown source reflects
    every step.
---

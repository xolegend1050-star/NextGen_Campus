# Report generator

Builds `out/NextGen_Campus_Project_Report.pdf` — the project report, in black and
white, ready to print.

It lives in the repository rather than in a temporary folder so it cannot be lost
again. The version that produced the previous 85-page report was written outside the
repository and was deleted by a temp cleanup; the content had to be recovered from
the PDF's own text layer.

## Running it

```
npm install
npm run extract     # regenerate the API and schema reference data from the source
npm run build       # lay out the report
npm run verify      # check the finished PDF for print safety
```

`build` runs the layout repeatedly until two consecutive passes agree on every page
number, because the index is part of the document it measures.

## The print rules this exists to satisfy

The previous version was fine on a screen and unusable on paper. These are the rules
that changed:

- Pure black on white. There is no palette; `theme.js` defines two values. The one
  exception is the college letterhead, which is the institution's own scan and is
  converted to high contrast greyscale by `tools/prepare-letterhead.js`.
- Hierarchy comes from size, weight and rules, never from hue.
- Every table is fully bordered on every row. The old version used alternating
  shading, which is the first thing a photocopier destroys.
- Nothing anywhere is below 9pt. The old version had 8.5pt text in about ten
  thousand places.
- No page is blank, and no heading is stranded at the foot of a page.

## Looking at the document

The verifier proves properties. It cannot tell you that a page reads badly, that a
caption has drifted from its figure, or that a screenshot has an empty band under
it. Every defect found in this document by looking at it was invisible to the
checks.

```
npm run serve                      # http://localhost:8732
open http://localhost:8732/preview.html?pages=1,4,57&scale=1.3
```

Renders pages of the finished PDF to canvases in the browser and stacks them.
`?pages=` takes a comma separated list, `?scale=` the zoom. It runs pdf.js in the
browser because rasterising it in Node crashes the native canvas binding.

## What `verify.js` checks

Ten checks, run against the finished PDF rather than against the generator's own
bookkeeping, because a generator that believes it wrote 9.5pt text is not evidence
that 9.5pt text exists.

1. Minimum font size
2. Blank and underfilled pages
3. Colour operators, read out of the decompressed content streams
4. Margin overflow
5. Orphan headings
6. Contents page numbers against the pages the headings are actually on
7. Print simulation: ink coverage per page
8. Figure integrity: every caption is backed by a painted image, and vice versa
9. Section completeness: every section in the chapter plan exists as a heading
10. Running head: the chapter printed on each page is the chapter it belongs to

Checks 9 and 10 exist because two real defects passed all of the first eight. A
trim cut a table on the wrong bracket and silently deleted three whole sections;
the contents page agreed with the document because both were built from the same
marks, so neither disagreed with the other. And the running head read a single
variable at the end of the build, so every page in the document was headed with the
last chapter. Both were found by looking at the printed pages.

It exits non-zero if any check fails, so it can be wired into a build.

## Why the appendices are generated

Appendix E (149 endpoints), Appendix F (54 tables) and Appendix G (the index
catalogue) are read out of `backend/src/routes/*.js`, `backend/src/config/database.sql`
and `backend/migrations/*.sql`. A hand-maintained table of endpoints disagrees with
the endpoints within one commit. Run `npm run extract` after changing a route or the
schema.

## Files

| File | Role |
|---|---|
| `theme.js` | Page geometry, the two ink values, type sizes, the 9pt floor |
| `render.js` | Headings, prose, lists, tables, code, notes |
| `front.js` | Cover, signature blocks, contents, running head and foot |
| `build.js` | Two-pass driver, writes `out/layout.json` |
| `verify.js` | The seven print-safety checks |
| `details.js` | Report identity and the section plan |
| `extract-routes.js` | Reads the route table into `data/api-routes.json` |
| `extract-schema.js` | Reads the schema into `data/db-schema.json` |
| `recover-text.js` | Recovers text from a previous PDF, if one is ever lost again |
| `tools/prepare-letterhead.js` | Converts the letterhead to high contrast greyscale |
| `tools/prepare-screenshots.js` | Sizes captured screenshots for print; keeps colour |
| `serve.js`, `preview.html` | Renders finished pages in a browser to look at |
| `content/*.js` | The chapters and appendices |
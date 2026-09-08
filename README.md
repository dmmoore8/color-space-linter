# colorlint

CSS lets you write the same color half a dozen ways, and most of those ways
have footguns that aren't syntax errors: `rgb(300 0 0)` clamps silently,
`rgb(255, 50%, 0)` mixes number and percentage channels (invalid per spec,
but plenty of tooling swallows it), and a hue of `hsl(730 50% 50%)` is
probably a typo, not an intentional four-turns-around-the-wheel.

colorlint scans CSS-like source for these problems and reports them with
line and column numbers, the way a normal linter would.

## What it checks

- `hex-length` — hex colors must have 3, 4, 6, or 8 digits after `#`.
- `rgb-range` — numeric `rgb()`/`rgba()` channels must fall in 0-255,
  percentage channels in 0%-100%.
- `channel-mix` — `rgb()`/`rgba()` must not mix bare numbers and
  percentages across channels.
- `hue-range` — the hue channel in `hsl()`, `hwb()`, `lch()`, and `oklch()`
  must fall in 0-360 degrees.
- `lightness-range` — the lightness channel in `lab()`, `oklab()`, `lch()`,
  and `oklch()` must fall in 0-100 (`lab()`/`lch()`) or 0-1 (`oklab()`/
  `oklch()`); percentages must fall in 0%-100% either way.
- `chroma-range` — the chroma channel in `lch()` and `oklch()` must be
  non-negative and fall within the spec's reference range for a 100% value
  (0-150 for `lch()`, 0-0.4 for `oklch()`).

## Strict by default, `--lenient` as the escape hatch

Every rule above is an error by default and fails the run (exit code 1).
Real stylesheets accumulate legacy patterns over years, so `--lenient`
downgrades the range and consistency rules to warnings that print but don't
fail the build. `hex-length` stays an error either way, since a hex color
with 5 digits isn't a style disagreement, it's broken.

```
colorlint src/**/*.css
colorlint --lenient src/**/*.css
```

## Machine-readable output

Pass `--format json` to get a single JSON object on stdout instead of the
text report, for feeding into another tool:

```
$ colorlint --format json theme.css
{"lenient":false,"errorCount":3,"warningCount":0,"files":[{"filePath":"theme.css","findings":[{"line":2,"column":12,"ruleId":"hex-length","message":"hex color \"#1a2b3\" has 5 digit(s); expected 3, 4, 6, or 8","severity":"error"}, ...]}]}
```

`files` includes every file that was linted, even ones with no findings.
Exit code behavior is unchanged: nonzero if any error-severity finding
exists.

## Example

Given `theme.css`:

```css
:root {
  --brand: #1a2b3;
  --accent: rgb(255, 50%, 0);
  --highlight: hsl(730 80% 50%);
  --muted: rgba(120, 120, 120, 0.5);
}
```

```
$ colorlint theme.css
theme.css
  2:12  error  hex color "#1a2b3" has 5 digit(s); expected 3, 4, 6, or 8  (hex-length)
  3:13  error  rgb() mixes bare numbers and percentages across channels; use one form consistently  (channel-mix)
  4:16  error  hsl() hue "730" is outside 0-360; wrap it explicitly if that is intended  (hue-range)

3 error(s), 0 warning(s)
```

```
$ colorlint --lenient theme.css
theme.css
  2:12  error  hex color "#1a2b3" has 5 digit(s); expected 3, 4, 6, or 8  (hex-length)
  3:13  warn   rgb() mixes bare numbers and percentages across channels; use one form consistently  (channel-mix)
  4:16  warn   hsl() hue "730" is outside 0-360; wrap it explicitly if that is intended  (hue-range)

1 error(s), 2 warning(s) (lenient mode)
```

The `--muted` line has no findings; a comma-separated `rgba()` with a
number channel and a trailing alpha value is valid on its own.

## Ignoring a line

Sometimes a value is intentionally out of range. Add a CSS comment to
silence findings on that line, or the line after it:

```css
--brand: rgb(300 0 0); /* colorlint-disable-line */
/* colorlint-disable-next-line */
--accent: hsl(730 80% 50%);
```

Name specific rule ids, comma-separated, to silence only those:

```css
--brand: rgb(300 0 0); /* colorlint-disable-line rgb-range */
```

A bare `colorlint-disable-line`/`colorlint-disable-next-line` with no rule
ids silences every rule on that line.

## Building and running

There are no runtime dependencies. You need a TypeScript compiler on your
machine to build:

```
tsc
node dist/cli.js theme.css
```

## Known limitations (for now)

- Color functions are matched with a single-line regex, so a color value
  split across multiple lines won't be seen.
- `var()` or `calc()` nested inside a color function isn't understood.

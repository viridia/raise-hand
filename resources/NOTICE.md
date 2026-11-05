# Icon

`back_hand.svg` and `back_hand-fill.svg` are the Material Symbols `back_hand` icon (outlined, weight
400), from the npm package `@material-symbols/svg-400` 0.48.3. Copyright Google, licensed under the
Apache License 2.0: <https://www.apache.org/licenses/LICENSE-2.0>.

`raise-hand.woff` holds the same two shapes as an icon font, because a status bar item can only show
font glyphs. It has `\E001` (outlined) and `\E002` (filled). It was built once with `svgicons2svgfont`,
`svg2ttf` and `ttf2woff`. Those tools are not project dependencies. The paths must be moved into
positive coordinates first (a `translate(0 960)` under a `0 0 960 960` viewBox), since the converter
places them far off the glyph otherwise.

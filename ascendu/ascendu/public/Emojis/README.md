# Lumora emoji image assets

This folder is the single source for pictographs and the seven UI glyph images used in Lumora. UI text is converted to local images by `src/EmojiText.jsx` and the Vite source transform; do not add new emoji glyphs directly to interface markup without adding their image here.

## Adding an image

- Use a transparent PNG for a color emoji, or an SVG for a simple UI symbol.
- Name the asset with its Unicode code points in uppercase hexadecimal, separated by hyphens. Ignore variation selectors `FE0E` and `FE0F`. For example, `📚` is `1F4DA.png`, and the joined `🧑‍🎓` is `1F9D1-200D-1F393.png`.
- For an ordinary emoji, add the PNG. For one of the seven custom controls (`〰`, `↔`, `↩`, `⏸`, `▶`, `☀`, `✉`), use its existing SVG mapping in `src/EmojiText.jsx`.
The Vite check will fail the build if a new source emoji has no matching asset, so this folder stays in use as the app grows. `src/EmojiText.jsx` automatically uses a newly added file when its Unicode filename matches the character sequence.

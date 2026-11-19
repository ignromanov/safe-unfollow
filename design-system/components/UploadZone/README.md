Desktop drag-and-drop target for the Instagram ZIP, from `src/components/upload/DesktopDropZone.tsx` (phones get the separate touch button).

The consumer provides the file input handlers, `isProcessing`, `isDragOver` and a drag validation result. The whole zone is a labelled control with a visually hidden `<input type="file" accept=".zip">`. Rest: `card` surface, 4px dashed `border`, 32px corners, 32px padding, 16:9. Drag over a valid file: `primary` border and a 10% `primary` tint, scale 1.02, large shadow, icon tile turns `primary` and tilts. Invalid file: amber border and tint. Processing swaps the content for a spinner and "Analyzing locally...". Headline is `display` bold; helper text is zinc-500 (about 4.8:1 on `card`).

Copy: say "Your file never leaves your device" and "Either export format works, JSON or HTML"; never "JSON only". Keep ad slots out of the drop target itself.

Static rendition: no behaviour or animation.

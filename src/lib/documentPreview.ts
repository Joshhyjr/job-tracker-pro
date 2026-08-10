const PREVIEWABLE_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
]);

export function isPreviewableDocumentDataUrl(dataUrl: string): boolean {
  const mediaType = /^data:([^;,]+)(?:;[^,]*)?,/i.exec(dataUrl)?.[1].trim().toLowerCase() ?? "";
  // Preview is an exact inert allowlist; active HTML, XML, and SVG uploads remain available for download only.
  return PREVIEWABLE_DOCUMENT_MIME_TYPES.has(mediaType);
}

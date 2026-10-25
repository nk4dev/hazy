// Minimal typings for `quilljs-markdown` (ships no types). We only use the
// constructor + `destroy()`. See components/note-editor.tsx.
declare module "quilljs-markdown" {
  import type Quill from "quill";

  interface QuillMarkdownOptions {
    /** HTML tag names to skip, e.g. ["h4", "h5", "h6", "strikethrough"]. */
    ignoreTags?: string[];
    /** Per-tag pattern overrides. */
    tags?: Record<string, { pattern: RegExp }>;
  }

  export default class QuillMarkdown {
    constructor(quill: Quill, options?: QuillMarkdownOptions);
    destroy(): void;
  }
}

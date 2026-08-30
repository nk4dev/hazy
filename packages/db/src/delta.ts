/**
 * A single op from a Quill (Delta) document. hazy-note stores a note's body as
 * the bare `ops` array (`notes.body`); the editor round-trips it with
 * `quill.setContents({ ops })` / `quill.getContents().ops`.
 */
export type DeltaOp = {
  insert?: string | Record<string, unknown>;
  attributes?: Record<string, unknown>;
  retain?: number;
  delete?: number;
};

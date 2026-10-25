import { describe, expect, test } from "bun:test";
import {
  buildCorpus,
  queryTerms,
  rankBySimilarity,
  type SearchDoc,
  snippet,
  tagCloud,
  tagSearch,
  textSearch,
} from "./search";
import type { Item, Note } from "./types";

const doc = (over: Partial<SearchDoc>): SearchDoc => ({
  id: "1",
  kind: "note",
  title: "",
  text: "",
  tags: [],
  href: "/x",
  external: false,
  ...over,
});

describe("queryTerms", () => {
  test("splits on whitespace, lowercases", () => {
    expect(queryTerms("Hello World")).toEqual(["hello", "world"]);
  });
  test("keeps quoted phrases together", () => {
    expect(queryTerms('foo "bar baz" qux')).toEqual(["foo", "bar baz", "qux"]);
  });
  test("empty query → no terms", () => {
    expect(queryTerms("   ")).toEqual([]);
  });
});

describe("textSearch", () => {
  const docs = [
    doc({ id: "a", title: "TypeScript tips", text: "generics and inference" }),
    doc({ id: "b", title: "Cooking", text: "a note about typescript on the side", tags: ["food"] }),
    doc({ id: "c", title: "Rust", text: "borrow checker", tags: ["typescript"] }),
  ];

  test("every term must match somewhere", () => {
    expect(textSearch(docs, "typescript inference").map((h) => h.id)).toEqual(["a"]);
  });
  test("title hit ranks above body-only hit", () => {
    const ids = textSearch(docs, "typescript").map((h) => h.id);
    expect(ids[0]).toBe("a"); // title
    expect(ids).toContain("b"); // body
    expect(ids).toContain("c"); // tag
  });
  test("no query → empty", () => {
    expect(textSearch(docs, "")).toEqual([]);
  });
  test("no match → empty", () => {
    expect(textSearch(docs, "kubernetes")).toEqual([]);
  });
});

describe("tagSearch", () => {
  const docs = [
    doc({ id: "a", tags: ["nextjs", "react"] }),
    doc({ id: "b", tags: ["Node"] }),
    doc({ id: "c", tags: [] }),
  ];
  test("substring, case-insensitive", () => {
    expect(tagSearch(docs, "js").map((h) => h.id)).toEqual(["a"]);
    expect(tagSearch(docs, "NODE").map((h) => h.id)).toEqual(["b"]);
  });
  test("strips a leading #", () => {
    expect(tagSearch(docs, "#react").map((h) => h.id)).toEqual(["a"]);
  });
});

describe("tagCloud", () => {
  test("counts and sorts by frequency", () => {
    const docs = [doc({ tags: ["x", "y"] }), doc({ tags: ["x"] }), doc({ tags: ["x", "z"] })];
    expect(tagCloud(docs)).toEqual([
      { tag: "x", count: 3 },
      { tag: "y", count: 1 },
      { tag: "z", count: 1 },
    ]);
  });
});

describe("rankBySimilarity", () => {
  const docs = [doc({ id: "a" }), doc({ id: "b" }), doc({ id: "c" })];
  test("sorts desc, drops below floor, rounds score", () => {
    const hits = rankBySimilarity(docs, [0.1, 0.9, 0.42], { floor: 0.2 });
    expect(hits.map((h) => h.id)).toEqual(["b", "c"]);
    expect(hits[0].score).toBe(0.9);
    expect(hits[1].score).toBe(0.42);
  });
});

describe("snippet", () => {
  test("windows around the first term hit", () => {
    const d = doc({ text: `${"x".repeat(80)} needle ${"y".repeat(80)}` });
    const s = snippet(d, ["needle"], 60);
    expect(s).toContain("needle");
    expect(s.startsWith("…")).toBe(true);
  });
  test("falls back to leading text", () => {
    expect(snippet(doc({ text: "short body" }), ["absent"])).toBe("short body");
  });
});

describe("buildCorpus", () => {
  test("notes first, then non-note sources", () => {
    const notes = [
      { id: "n1", title: "N", body: [{ insert: "hi\n" }], tags: [{ label: "t", tone: "neutral" }] },
    ] as unknown as Note[];
    const items = [
      {
        id: "s1",
        kind: "article",
        title: "S",
        url: "http://s",
        site: "s",
        summary: ["sum"],
        points: [],
        tags: ["a"],
        suggestedTags: ["b"],
      },
      {
        id: "s2",
        kind: "note",
        title: "memo",
        url: "",
        site: "",
        summary: [],
        points: [],
        tags: [],
        suggestedTags: [],
      },
    ] as unknown as Item[];
    const corpus = buildCorpus(notes, items);
    expect(corpus.map((d) => d.id)).toEqual(["n1", "s1"]); // s2 (kind note) dropped
    expect(corpus[0].kind).toBe("note");
    expect(corpus[1].external).toBe(true);
    expect(corpus[1].tags).toEqual(["a", "b"]);
  });
});

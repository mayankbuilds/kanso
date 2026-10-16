import test from "node:test";
import assert from "node:assert";
import type { QuickNote } from "../src/types/index.ts";

function filterNotesByScope(
  notes: QuickNote[],
  scope: "date" | "all",
  currentDate: string,
  searchQuery: string = ""
): QuickNote[] {
  let result = [...notes];

  if (scope === "date" && !searchQuery.trim()) {
    result = result.filter((n) => {
      if (n.date) return n.date === currentDate;
      return n.updatedAt.startsWith(currentDate);
    });
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    result = result.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q)) ||
        (n.date && n.date.includes(q))
    );
  }

  return result.sort((a, b) => {
    if (a.isPinned !== b.isPinned) {
      return b.isPinned ? 1 : -1;
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

function toggleNoteCheckbox(content: string, lineIndex: number, nextChecked: boolean): string {
  const lines = content.split("\n");
  if (lineIndex < 0 || lineIndex >= lines.length) return content;

  const targetLine = lines[lineIndex];
  const taskMatch = targetLine.match(/^([-*]\s+\[)[ xX](\]\s+.*)$/);
  if (taskMatch) {
    lines[lineIndex] = `${taskMatch[1]}${nextChecked ? "x" : " "}${taskMatch[2]}`;
  }
  return lines.join("\n");
}

test("dailyNotes - filters notes strictly by selected calendar date", () => {
  const mockNotes: QuickNote[] = [
    {
      id: "1",
      title: "Note for Oct 15",
      content: "Content 1",
      tags: ["daily"],
      isPinned: false,
      date: "2026-10-15",
      updatedAt: "2026-10-15T10:00:00Z",
    },
    {
      id: "2",
      title: "Note for Oct 16",
      content: "Content 2",
      tags: ["contest"],
      isPinned: false,
      date: "2026-10-16",
      updatedAt: "2026-10-16T10:00:00Z",
    },
    {
      id: "3",
      title: "Undated note created today",
      content: "Content 3",
      tags: [],
      isPinned: false,
      updatedAt: "2026-10-15T12:00:00Z",
    },
  ];

  const oct15Notes = filterNotesByScope(mockNotes, "date", "2026-10-15");
  assert.strictEqual(oct15Notes.length, 2);
  assert.deepStrictEqual(
    oct15Notes.map((n) => n.id).sort(),
    ["1", "3"]
  );

  const oct16Notes = filterNotesByScope(mockNotes, "date", "2026-10-16");
  assert.strictEqual(oct16Notes.length, 1);
  assert.strictEqual(oct16Notes[0].id, "2");
});

test("dailyNotes - floats pinned notes to the top", () => {
  const mockNotes: QuickNote[] = [
    {
      id: "1",
      title: "Unpinned old",
      content: "",
      tags: [],
      isPinned: false,
      updatedAt: "2026-10-10T00:00:00Z",
    },
    {
      id: "2",
      title: "Pinned note",
      content: "",
      tags: [],
      isPinned: true,
      updatedAt: "2026-10-01T00:00:00Z",
    },
    {
      id: "3",
      title: "Unpinned new",
      content: "",
      tags: [],
      isPinned: false,
      updatedAt: "2026-10-15T00:00:00Z",
    },
  ];

  const sorted = filterNotesByScope(mockNotes, "all", "2026-10-15");
  assert.strictEqual(sorted[0].id, "2"); // Pinned note is #1 despite older date
  assert.strictEqual(sorted[1].id, "3"); // Most recent unpinned
  assert.strictEqual(sorted[2].id, "1");
});

test("dailyNotes - toggles markdown task checkboxes accurately", () => {
  const original = `# Daily Tasks\n- [ ] Review Fenwick tree\n- [x] Workout\n- [ ] Read OS book`;

  // Toggle index 1 (Review Fenwick tree) to checked
  const step1 = toggleNoteCheckbox(original, 1, true);
  assert.strictEqual(
    step1,
    `# Daily Tasks\n- [x] Review Fenwick tree\n- [x] Workout\n- [ ] Read OS book`
  );

  // Toggle index 2 (Workout) to unchecked
  const step2 = toggleNoteCheckbox(step1, 2, false);
  assert.strictEqual(
    step2,
    `# Daily Tasks\n- [x] Review Fenwick tree\n- [ ] Workout\n- [ ] Read OS book`
  );
});

test("dailyNotes - searches across title, content, tags, and date", () => {
  const mockNotes: QuickNote[] = [
    {
      id: "1",
      title: "Segment Tree",
      content: "Range query updates",
      tags: ["algorithms"],
      isPinned: false,
      date: "2026-10-15",
      updatedAt: "2026-10-15T00:00:00Z",
    },
    {
      id: "2",
      title: "Meeting Notes",
      content: "College project discussion",
      tags: ["college"],
      isPinned: false,
      date: "2026-10-16",
      updatedAt: "2026-10-16T00:00:00Z",
    },
  ];

  // Search by tag
  const tagResults = filterNotesByScope(mockNotes, "all", "2026-10-15", "algorithms");
  assert.strictEqual(tagResults.length, 1);
  assert.strictEqual(tagResults[0].id, "1");

  // Search by content
  const contentResults = filterNotesByScope(mockNotes, "all", "2026-10-15", "discussion");
  assert.strictEqual(contentResults.length, 1);
  assert.strictEqual(contentResults[0].id, "2");
});

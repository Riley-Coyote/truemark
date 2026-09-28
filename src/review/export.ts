/**
 * The designer's brief: every open thread, page by page, then each question with its latest
 * answer, as Markdown to paste or save.
 */
import { stamp } from "./time";
import type { Category, Note, Question } from "./types";

export const categoryLabel: Record<Category, string> = {
  change: "Change",
  missing: "Missing",
  question: "Question",
  love: "Love it",
};

/** Continuation lines of a list item line up under its text. */
const indent = (text: string, by: string) => text.trim().replace(/\r?\n/g, `\n${by}`);

export function latestAnswer(notes: Note[], questionId: string): Note | null {
  let latest: Note | null = null;
  for (const note of notes) {
    if (note.kind === "answer" && note.questionId === questionId && (!latest || note.createdAt > latest.createdAt)) latest = note;
  }
  return latest;
}

export function answerText(note: Note): string {
  const choices = note.answer?.choices ?? [];
  const text = note.answer?.text?.trim();
  return [choices.join(", "), text].filter(Boolean).join(" · ") || note.body;
}

export function briefMarkdown(notes: Note[], questions: Question[], now: Date = new Date()): string {
  const lines: string[] = [`# TrueMark review — brief, ${stamp(now.toISOString())}`, ""];
  const threads = notes
    .filter((n) => (n.kind === "comment" || n.kind === "page") && n.status === "open")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const pages = new Map<string, Note[]>();
  for (const thread of threads) pages.set(thread.route, [...(pages.get(thread.route) ?? []), thread]);

  if (!pages.size) lines.push("No open notes.", "");
  for (const [route, pageThreads] of pages) {
    lines.push(`## ${pageThreads[0].pageTitle} — ${route}`, "");
    for (const thread of pageThreads) {
      const category = thread.category ? `[${categoryLabel[thread.category]}] ` : "";
      lines.push(`- (${thread.author.name}, ${stamp(thread.createdAt)}) ${category}${indent(thread.body, "  ")}`);
      notes
        .filter((n) => n.kind === "reply" && n.threadId === thread.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .forEach((reply) => lines.push(`  - (${reply.author.name}, ${stamp(reply.createdAt)}) ${indent(reply.body, "    ")}`));
    }
    lines.push("");
  }

  lines.push("## Answers", "");
  for (const question of questions) {
    const answer = latestAnswer(notes, question.id);
    lines.push(
      answer
        ? `- ${question.title} — ${question.route}: ${indent(answerText(answer), "  ")} (${answer.author.name}, ${stamp(answer.createdAt)})`
        : `- ${question.title} — ${question.route}: no answer yet`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

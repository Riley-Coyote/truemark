import { Markdown } from "../brand/Markdown";
/** Refusals, answers and checked drafts all use the site's HTML-free renderer. */
export function MessageText({ text }: { text: string }) {
  return <div className="assistant-message-text"><Markdown source={text} variant="chat" /></div>;
}

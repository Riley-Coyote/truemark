/** Where the shopper is, for the storefront chat: set by the chat as the page changes, read by each
 *  request. Plain data; the server cleans it again and sets it off from its instructions. */
export type ChatContext = {
  page: string;
  product?: { id: string; name: string; size: string; lot: string };
  bag?: { items: number; subtotal: number };
  signedIn?: boolean;
};

let current: ChatContext | null = null;
export function setChatContext(context: ChatContext | null) {
  current = context;
}
export function chatContext() {
  return current;
}

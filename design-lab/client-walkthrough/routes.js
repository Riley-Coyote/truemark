/** Only local business screens can become a saved walkthrough destination. */
export function safeWalkthroughPath(value, origin) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x20]/.test(value)) return null;
  const url = new URL(value, origin);
  const businessRoute = /^\/(?:$|(?:products|product|verify|cart|checkout|track|account|my-account|access|partners|admin|quality|handling|about|research-blog|journal|contact|privacy|privacy-policy|terms|terms-and-conditions|refund_returns|shipping-policy|walkthrough-messages)(?:\/|$))/;
  return url.origin === origin && businessRoute.test(url.pathname) ? url.pathname + url.search + url.hash : null;
}

import { normalizeLanguage, translate, translateMessage } from './translate.mjs';

const dictionary = await fetch('/en.json').then(response => {
  if (!response.ok) throw new Error('Language file unavailable');
  return response.json();
});
const storageKey = 'spam-inspector-language';
let saved;
try { saved = localStorage.getItem(storageKey); } catch {}
let language = ['fr', 'en'].includes(saved) ? saved : normalizeLanguage(navigator.language);
const texts = [], attributes = [];
const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
while (walker.nextNode()) {
  const node = walker.currentNode;
  if (node.data.trim() && !node.parentElement.closest('script, style, select')) texts.push([node, node.data]);
}
for (const element of document.querySelectorAll('[placeholder], [aria-label], [title]')) {
  for (const name of ['placeholder', 'aria-label', 'title']) {
    if (element.hasAttribute(name)) attributes.push([element, name, element.getAttribute(name)]);
  }
}
const selector = document.querySelector('#language');
export const getLanguage = () => language;
export const t = (source, values) => translate(source, language, dictionary, values);
export const message = source => translateMessage(source, language, dictionary);
export function setLanguage(value, notify = true) {
  language = normalizeLanguage(value);
  try { localStorage.setItem(storageKey, language); } catch {}
  document.documentElement.lang = language;
  if (selector) selector.value = language;
  for (const [node, original] of texts) {
    if (node.isConnected) node.data = original.replace(/\S[\s\S]*\S|\S/, text => t(text));
  }
  for (const [element, name, original] of attributes) element.setAttribute(name, t(original));
  document.title = t(document.querySelector('meta[name="original-title"]')?.content || 'SPAM Card Inspector');
  if (notify) window.dispatchEvent(new CustomEvent('languagechange', { detail: language }));
}
selector?.addEventListener('change', () => setLanguage(selector.value));
setLanguage(language, false);

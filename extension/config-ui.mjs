const dictionary = await fetch(new URL('./config-en.json',import.meta.url)).then(response=>response.json());
let language = navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en';
try {const saved=localStorage.getItem('spam-config-language');if(['fr','en'].includes(saved))language=saved;} catch {}
export const getConfigLanguage = () => language;
export const t = (source, values={}) => {
  const text = language==='en' && Object.hasOwn(dictionary,source) ? dictionary[source] : source;
  return String(text).replace(/\{(\w+)\}/g,(match,key)=>Object.hasOwn(values,key)?String(values[key]):match);
};
const originals=[],walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
while(walker.nextNode()) {const node=walker.currentNode;if(node.data.trim()&&!node.parentElement.closest('script,style,select'))originals.push([node,node.data]);}
const select=document.querySelector('#config-language');
function apply(value) {
  language=value==='fr'?'fr':'en';document.documentElement.lang=language;select.value=language;
  try{localStorage.setItem('spam-config-language',language);}catch{}
  for(const [node,original] of originals)if(node.isConnected)node.data=original.replace(/\S[\s\S]*\S|\S/,text=>t(text));
  document.title=t('Configurer SPAM');
}
select.addEventListener('change',()=>{apply(select.value);window.dispatchEvent(new Event('configlanguagechange'));});
apply(language);

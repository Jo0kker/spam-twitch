export function normalizeLanguage(value) {
  return String(value || '').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export function translate(source, language, dictionary, values = {}) {
  let result = language === 'en' ? dictionary[source] ?? source : source;
  return result.replace(/\{(\w+)\}/g, (match, key) => Object.hasOwn(values, key) ? String(values[key]) : match);
}

export function translateMessage(source, language, dictionary) {
  if (language !== 'en' || !source) return source;
  if (Object.hasOwn(dictionary, source)) return dictionary[source];
  const downloading = /^Téléchargement de la version (\d+\.\d+\.\d+)…$/.exec(source);
  if (downloading) return translate('Téléchargement de la version {version}…', language, dictionary, {version: downloading[1]});
  const ready = /^Version (\d+\.\d+\.\d+) prête — installation à la fermeture$/.exec(source);
  if (ready) return translate('Version {version} prête — installation à la fermeture', language, dictionary, {version: ready[1]});
  // Keep technical details intact while translating known error/status prefixes.
  for (const prefix of ['Transmission : ', 'Lecture du jeu : ', 'Mise à jour indisponible : ', 'Serveur HTTP ', 'Erreur ']) {
    if (source.startsWith(prefix)) return (dictionary[prefix] || prefix) + translateMessage(source.slice(prefix.length), language, dictionary);
  }
  return source;
}

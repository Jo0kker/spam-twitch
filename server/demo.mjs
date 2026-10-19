export function demoSnapshot(sequence = 1) {
  return { version: 1, sessionId: 'demo-local', sequence, capturedAt: Date.now(), source: 'demo', scene: 'Démonstration — cartes fictives', screen: { width: 1920, height: 1080 },
    cards: [
      { instanceId: 'demo-a', cardId: 'demo-a', name: 'Carte exemple · Feu', element: 'Feu', hp: 24, maxHp: 30, income: 3, side: 'ally', bounds: { x: .18, y: .56, w: .135, h: .33 }, abilities: [{ id: 'a', kind: 'active', name: 'Capacité de démonstration', description: 'Cette fiche est fictive. Une fois le connecteur chargé, elle sera remplacée par les données de SPAM.', cooldown: 1, maxCooldown: 3 }] },
      { instanceId: 'demo-b', cardId: 'demo-b', name: 'Carte exemple · Nature', element: 'Nature', hp: 40, maxHp: 40, income: 2, side: 'ally', bounds: { x: .34, y: .56, w: .135, h: .33 }, abilities: [{ id: 'b', kind: 'passive', name: 'Effet passif', description: 'Survole chaque zone pour lire ses capacités et ses statistiques.', cooldown: 0, maxCooldown: 0 }] },
      { instanceId: 'demo-c', cardId: 'demo-c', name: 'Carte exemple · Eau', element: 'Eau', hp: 18, maxHp: 25, income: 4, side: 'opponent', bounds: { x: .5, y: .1, w: .135, h: .33 }, abilities: [{ id: 'c', kind: 'active', name: 'Autre capacité', description: 'Les positions sont relatives à l’image du jeu et restent utilisables lorsque le lecteur change de taille.', cooldown: 0, maxCooldown: 2 }] }
    ] };
}

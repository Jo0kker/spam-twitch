# Composants tiers

## Installateur Windows

L’assistant Windows est généré avec **Inno Setup 6.7.3**, de Jordan Russell et Martijn Laan. Le moteur conserve les informations de copyright et adresses d’origine intégrées par Inno Setup. Le compilateur n’est pas inclus dans le compagnon.

https://jrsoftware.org/ · https://jrsoftware.org/isdl.php

## BepInEx et son chargeur

Le compagnon portable inclut la distribution officielle Windows x64 **BepInEx 5.4.23.5**, sans modification de ses binaires. Elle est téléchargée depuis :

https://github.com/BepInEx/BepInEx/releases/tag/v5.4.23.5

Projet et licences : https://github.com/BepInEx/BepInEx. Les fichiers de licence et notices de cette distribution sont conservés lorsqu’ils sont présents. BepInEx et ses composants tiers gardent leurs licences respectives.

## Node.js

Le moteur Electron du compagnon inclut Node.js, sous licence MIT avec des composants tiers sous leurs propres licences. Les licences de ce moteur figurent dans `LICENSE` et `LICENSES.chromium.html`. Une copie de la notice du runtime Node utilisé pour le build reste fournie dans `runtime/NODE-LICENSE.txt`.

https://nodejs.org/ · https://github.com/nodejs/node/blob/main/LICENSE

## Application de bureau Electron

Le compagnon de bureau embarque Electron **44.9.0**, distribué officiellement par https://github.com/electron/electron/releases/tag/v44.9.0. Le ZIP Windows x64 a été comparé au SHA-256 du manifeste officiel : `88e08039d0ef359bab9f674e8051fa103bd8628ea7c5a5e1daaa610a8a0c6931`. Le fichier `LICENSE` et `LICENSES.chromium.html` du runtime sont conservés dans le paquet. Electron inclut Chromium, Node.js et leurs composants tiers ; le navigateur externe de l’utilisateur n’est pas lancé par le compagnon de bureau.

## Twitch Extension Helper

Le frontend charge l’Extension Helper depuis le domaine officiel Twitch. Ce fichier n’est pas recopié dans le paquet.

https://dev.twitch.tv/docs/extensions/reference/

## SPAM

Le jeu, ses assemblies, illustrations et ressources ne sont pas distribués avec ce projet. Le connecteur référence les assemblies de l’installation locale lors de sa compilation et lit les cartes affichées au moment de son exécution. SPAM et ses contenus appartiennent à leurs ayants droit.

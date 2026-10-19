# Code signing policy

Responsable des contributions, des revues et des approbations de publication : [Jo0kker](https://github.com/Jo0kker).

État actuel : **aucun certificat Authenticode du projet n’est configuré**. Les attestations GitHub permettent de vérifier le dépôt et le workflow d’origine d’un artefact. La signature Ed25519 des manifestes protège la chaîne de mise à jour du client. Ces mécanismes n’établissent pas un éditeur reconnu par Windows et ne garantissent pas l’absence d’avertissement SmartScreen.

Option envisagée : [SignPath Foundation](https://signpath.org/) propose une signature gratuite aux projets open source acceptés. L’éligibilité, la réputation du projet, l’authentification à deux facteurs, les approbations et les conditions de publication doivent être validées avant toute demande. Le service n’est pas acquis et aucun accord n’a été accepté au nom du responsable.

Seuls nos propres artefacts pourront être soumis à la signature du projet ; ne pas signer le moteur Electron comme s’il était notre propre exécutable. Les dépendances et leurs licences sont décrites dans `THIRD-PARTY-NOTICES.md`. Les bibliothèques propriétaires du jeu restent sur le PC du joueur.

[Confidentialité](https://spam-twitch.codible.net/privacy.html) — contact : benjamin@codible.net.

## Publication

1. Mettre la même version stable dans `package.json` et `desktop/package.json`.
2. Tester et revoir le code, notamment le workflow et les scripts de packaging.
3. Créer un tag `vX.Y.Z` correspondant à la version. GitHub Actions construit et publie l’installateur, le ZIP, les sommes SHA256 et le manifeste signé.
4. Vérifier la provenance : `gh attestation verify SPAM-Twitch-Setup-X.Y.Z.exe -R Jo0kker/spam-twitch`.

Le secret Actions `SPAM_UPDATE_PRIVATE_KEY` contient la clé privée PEM de publication. Ne jamais la committer, l’ajouter à un artefact ou la recopier dans un client. La clé publique correspondante est dans `desktop/update-config.json`.

Pour reconstruire sur Windows : Node 24.19.0, `powershell -File tools/Prepare-Build.ps1`, puis `node tools/package.mjs --skip-ebs`. Aucun achat ou compte de signature n’est nécessaire pour ce build non signé Authenticode.

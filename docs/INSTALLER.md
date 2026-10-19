# Installation Windows et distribution

Parcours public : https://spam-twitch.codible.net/ → installer Windows → ouverture de la fenêtre de bureau → installer le connecteur SPAM et relancer le jeu → générer le code dans Twitch et associer le PC.

Le serveur distant est prérempli. Le raccourci du menu Démarrer lance directement `SpamCardInspector.exe`, sans ouvrir le navigateur et sans daemon Node séparé. **Fermer la fenêtre ou Application → Quitter arrête la transmission et l’application.** Réduire la fenêtre la garde dans la barre des tâches. Un deuxième lancement réactive la fenêtre existante.

`desktop/main.cjs` héberge le serveur interne dans le processus principal Electron, sur un port de boucle locale alloué dynamiquement. Sa fermeture arrête le serveur et le lecteur du jeu, puis termine l’application. Le renderer est isolé, sans intégration Node et avec sandbox active. Aucun accès Node n’est exposé aux pages. Le fichier de processus privé sert au lanceur d’arrêt et à l’installateur ; les PID sont vérifiés contre le chemin de l’exécutable et le dossier d’installation avant tout arrêt forcé de secours.

## Installateur

`installer/SpamTwitch.iss` utilise Inno Setup 6.7.3. Installer par utilisateur dans `%LOCALAPPDATA%\Programs\SPAMCardInspector`, sans privilèges administrateur pour le compagnon. Raccourcis Démarrer (ouvrir / arrêter), Bureau facultatif, entrée de désinstallation Windows. La mise à jour arrête uniquement le processus appartenant au dossier installé avant de remplacer ses fichiers. Les configurations `.runtime/` et le connecteur situé dans le jeu sont conservés lors de la désinstallation.

Le binaire n’est pas signé avec un certificat éditeur. Aucun contournement des protections Windows n’est automatisé.

Electron 44.9.0 doit être extrait dans `.tools/electron/`. Le ZIP officiel Windows x64 et le manifeste `SHASUMS256.txt` proviennent de la release officielle ; le hash vérifié est consigné dans les notices tierces. Les licences du runtime sont conservées. Le binaire Node séparé de l’ancienne version n’est plus distribué.

## Build

Procédure actuelle : `powershell -File tools/Prepare-Build.ps1`, puis `node tools/package.mjs --skip-ebs`. Le script contrôle les dépendances officielles par SHA256. Le connecteur est distribué en source et compilé localement avec le jeu du joueur. Les versions des paquets suivent `package.json` ; les exemples 0.1.0 ci-dessous décrivent la première distribution.

Placer le compilateur officiel dans `.tools/inno-setup/ISCC.exe`, puis lancer `node tools/package.mjs --backend-url=https://spam-twitch.codible.net`. La source du compilateur utilisée est https://github.com/jrsoftware/issrc/releases/download/is-6_7_3/innosetup-6.7.3.exe, liée par le site officiel. Signature Authenticode vérifiée : Pyrsys B.V. ; SHA-256 de cette dépendance : `9c73c3bae7ed48d44112a0f48e66742c00090bdb5bef71d9d3c056c66e97b732`.

Le packaging produit le ZIP portable, `SPAM-Twitch-Setup-0.1.0.exe`, un manifeste SHA-256 et le ZIP serveur qui contient les deux téléchargements. Il ne modifie pas les assets déjà soumis à Twitch.

## Validation

`powershell -NoProfile -ExecutionPolicy Bypass -File tests/windows-installer.ps1` compile une édition avec une identité de produit distincte, installe dans un dossier de test avec espaces, vérifie les raccourcis et fichiers, réinstalle en conservant une association fictive, puis désinstalle et vérifie la conservation des données. Le jeu et le compagnon actif du développeur ne sont pas modifiés.

`node tests/desktop-lifecycle.mjs` lance réellement Electron avec une fenêtre de test, vérifie son chargement puis sa fermeture. Le test constate la fermeture du port et l’arrêt de tous les PID recensés par l’application. Une seconde séquence vérifie le verrou d’instance et la commande Quitter. Passer le chemin de `SpamCardInspector.exe` en argument teste également la distribution construite.

Après publication, comparer le téléchargement public à `update.json`, vérifier sa signature et l’attestation GitHub. Le frontend Twitch en cours d’examen reste inchangé.

## Mises à jour automatiques

Le client installé recherche la dernière publication stable sur GitHub au démarrage puis toutes les quatre heures. La clé publique embarquée vérifie le manifeste Ed25519 avant le téléchargement de l’installateur ; le SHA256 et la taille sont contrôlés après téléchargement. À la fermeture, un helper situé hors du dossier d’installation attend la fin du processus, contrôle à nouveau le SHA256 puis lance Inno Setup avec `/VERYSILENT /NORESTART` dans le même dossier. Il ne relance pas le compagnon. L’association est conservée. Un arrêt demandé par un installateur externe avec `--quit` annule l’installation automatique concurrente.

La version portable reste manuelle. La version 0.1.0 doit être remplacée une fois par un installateur récent. La 0.2.0 est marquée en préversion à cause d’un en-tête HTTP incorrect lors de la recherche ; utiliser 0.2.1 ou une version ultérieure.

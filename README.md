# SPAM Card Inspector

Compagnon Windows et extension Twitch pour afficher les capacités des cartes visibles de SPAM au survol de la vidéo. Projet indépendant de Jo0kker, non affilié à Ticroco ou Twitch.

## Installer

Télécharger l’installateur sur [GitHub Releases](https://github.com/Jo0kker/spam-twitch/releases/latest). Windows 10/11 x64 est requis. Suivre l’assistant puis ouvrir SPAM Card Inspector depuis le menu Démarrer.

1. Vérifier le dossier de SPAM et cliquer sur **Préparer SPAM**. Le connecteur est compilé avec les fichiers de votre jeu ; aucune bibliothèque propriétaire du jeu n’est distribuée.
2. Fermer puis relancer SPAM après la première installation du module.
3. Activer SPAM Card Inspector dans un emplacement Overlay Twitch. Générer un code dans la configuration de l’extension, puis le saisir dans le compagnon. La connexion au service SPAM est automatique, sans adresse à saisir.
4. Pour les lives suivants, ouvrir le compagnon et SPAM. L’association est conservée.

**L’extension Twitch 0.1.1 est en cours d’examen : seuls les comptes de test autorisés peuvent l’utiliser actuellement.** Le téléchargement du compagnon ne vaut pas accès au catalogue Twitch.

Les viewers n’installent rien. Ils survolent les cartes dans le lecteur Twitch sur ordinateur pour afficher une fiche compacte des capacités ; la fiche se ferme lorsque le pointeur quitte la carte.

Fermer la fenêtre ou **Application → Quitter** arrête le compagnon et la transmission. Réduire la fenêtre laisse fonctionner l’application. Un second lancement remet la fenêtre existante au premier plan.

## Mises à jour

À partir de la version 0.2.1 installée, l’application recherche les publications stables au démarrage et toutes les quatre heures. Elle télécharge la nouvelle version, vérifie son manifeste signé et son SHA256, puis l’installe à la fermeture. Elle ne se relance pas après la fermeture. Le menu **Application** affiche l’état et permet une recherche manuelle. L’association Twitch est conservée. Une panne réseau ne bloque pas le compagnon.

La version portable reste disponible dans les publications ; elle ne s’installe pas automatiquement. La version 0.1.0 nécessite une première installation manuelle de 0.2.1 pour obtenir l’updater. Le connecteur installé dans le jeu n’est pas remplacé automatiquement pendant une partie.

## État de l’association

Le compagnon affiche en permanence le PC associé, la chaîne et son état ; les dates et le dernier contact confirmé sont dans les détails de connexion. « PC connecté » et « Transmission active » sont distincts : le jeu n’a pas besoin d’être ouvert pour confirmer la connexion du compagnon. Les métadonnées des anciennes associations sont conservées quand elles existent ; les dates manquantes ne sont pas inventées.

Le panneau Twitch préparé affiche le PC actif ou hors ligne, le code en attente avec son compte à rebours, son utilisation et les actions d’annulation ou de révocation. Sa mise en ligne nécessite une version Twitch modifiable et un nouvel examen. La version 0.1.1 en cours d’examen reste inchangée ; la copie 0.1.2 est disponible aux testeurs autorisés.

## Confiance et code signing policy

Le code du projet est sous [licence MIT](LICENSE). Les dépendances conservent leurs licences propres ; la licence du projet ne couvre ni SPAM ni ses illustrations. Voir [les notices tierces](THIRD-PARTY-NOTICES.md).

Les installateurs sont construits par le [workflow GitHub Actions](.github/workflows/build.yml). Les publications comportent les SHA256 et des attestations de provenance vérifiables avec :

```powershell
gh attestation verify SPAM-Twitch-Setup-0.3.0.exe -R Jo0kker/spam-twitch
```

L’installateur n’a **pas encore de signature Authenticode reconnue par Windows**. GitHub Actions et la signature des manifestes ne remplacent pas un certificat Windows. Une candidature à SignPath Foundation est envisagée, sans garantie d’acceptation. Voir la [code signing policy](docs/CODE-SIGNING.md) et [SECURITY.md](SECURITY.md).

## Construire sur Windows

Node 24.19.0 et PowerShell Windows sont nécessaires. Les dépendances de build sont téléchargées depuis leurs éditeurs et contrôlées par SHA256 :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/Prepare-Build.ps1
node --test tests/*.test.mjs
node tools/package.mjs --skip-ebs
node tests/desktop-lifecycle.mjs dist/SPAM-Twitch-Companion-0.3.0/SpamCardInspector.exe
```

Les artefacts sont dans `dist/`. Aucun fichier du jeu ni secret Twitch n’est nécessaire pour construire le compagnon. Le connecteur est compilé séparément sur le PC du joueur avec .NET Framework et les références du jeu.

Créer un tag `vX.Y.Z` correspondant aux versions des deux `package.json` déclenche la publication. La clé privée de manifeste est un secret Actions ; elle n’est jamais incluse dans le client ou le dépôt. Consulter [la procédure de publication](docs/CODE-SIGNING.md).

## Architecture et hébergement

```text
SPAM → connecteur BepInEx → état local des cartes visibles
     → compagnon Windows → serveur EBS HTTPS → extension Twitch
```

Le connecteur lit les objets affichés et ne modifie pas les règles du jeu. La collection et un plateau de combat ont été testés avec transmission réelle et variation des PV. Le filtrage des cartes enfumées, retournées, mélangées ou mortes et la synchronisation précise OBS nécessitent encore des validations complémentaires. Aucune carte cachée ne doit être révélée.

Le backend gère l’association par code, l’authentification Twitch, l’isolation des chaînes, un historique borné et les notifications PubSub. Le frontend Twitch est téléversé séparément : les mises à jour du compagnon ne remplacent pas la version soumise à Twitch.

Pour développer : `node server/local.mjs`. Pour héberger : [Twitch](docs/TWITCH-SETUP.md) et [Dokploy](docs/DOKPLOY.md). Les secrets du serveur doivent rester dans ses variables d’environnement. Ne jamais publier `.runtime/companion.json`, `.env` ou des journaux privés.

Pour désinstaller le connecteur, fermer SPAM puis lancer depuis le dossier du compagnon :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/Install-Connector.ps1 -GamePath "C:\chemin\vers\SPAM" -Uninstall
```

La désinstallation Windows retire le compagnon et conserve les données locales et le connecteur du jeu. À partir du compagnon 0.3.0, « Révoquer l’accès de ce PC » révoque réellement la clé sur le serveur avant de retirer l’association locale. En cas de panne réseau, la révocation doit être réessayée. Le nouveau panneau Twitch permet également la révocation distante. Un seul PC est autorisé par chaîne ; associer un nouveau PC remplace le précédent. Les anciennes versions ne révoquent pas leur clé côté serveur.

Support : benjamin@codible.net · [Confidentialité](https://spam-twitch.codible.net/privacy.html) · [Conditions](https://spam-twitch.codible.net/terms.html)
### Talents sous les cartes (compagnon 0.3.1 / connecteur 0.1.3)

L’écran « Choisis tes talents » expose une zone de survol par ligne visible, avec la description localisée du talent et son état sélectionné, disponible ou verrouillé. Les panneaux masqués ne sont pas transmis. Cet ajout utilise le protocole de l’overlay existant : aucune nouvelle version Twitch n’est nécessaire. Après une mise à jour du compagnon, cliquer sur **Actualiser le module SPAM**, puis relancer SPAM pour charger le nouveau module.

Un test des talents est accessible sans ranked dans le compagnon : cliquer sur « Tester cartes et talents », puis survoler les zones Disponible, Sélectionné et Verrouillé dans l’aperçu. Les noms/descriptions de cette démo sont explicitement fictifs et ne sont jamais transmis à Twitch. « Revenir au jeu » supprime ces zones et reprend les données réelles. Ce test valide le rendu et le protocole de l’overlay actuel, pas la géométrie de l’écran ranked ni son état réel.

### Association simplifiée (compagnon 0.3.2)

La connexion au service SPAM est automatique. Dans Twitch, cliquer sur **Générer mon code**, puis coller le code dans le compagnon et cliquer sur **Associer**. Aucune adresse de serveur n’est à saisir. Le nom du PC est facultatif et les réglages d’alignement sont repliés. Le nouveau panneau est actuellement disponible dans la copie de test Twitch 0.1.2 ; la soumission 0.1.1 reste inchangée pendant son examen.


### Interface 0.4.0

Le compagnon affiche les étapes de préparation de SPAM et d’association Twitch, les états du jeu et de transmission, puis les cartes et talents détectés. L’aperçu et la démo sont repliés par défaut. Le site fournit directement les téléchargements, les étapes et le dépannage. Les marqueurs TextMeshPro sont nettoyés dans les descriptions, et l’overlay de test adapte ses fiches à la place disponible sans barre de défilement.

## Affichage des cartes (Twitch 0.2.0)

Dans la configuration Twitch de la version 0.2.0, la section **Affichage pour vos viewers** propose un aperçu et des réglages enregistrés pour la chaîne. Le mode complet affiche les statistiques de compétences et résistances reçues du jeu ; le mode simple conserve les compétences et passifs. Les PV, revenus et textes d’histoire sont optionnels.

Le volet s’ouvre au survol par défaut et se ferme en quittant la carte. Le streamer peut choisir l’ouverture au clic pour laisser les viewers lire et faire défiler la fiche. Sur un petit lecteur, une fiche longue en mode survol se fait défiler en gardant le pointeur sur la carte.

Les résistances et probabilités nécessitent le connecteur **0.1.4** : cliquer sur **Actualiser le module SPAM** dans le compagnon, puis redémarrer SPAM. Les images du jeu ne sont pas redistribuées. Les noms et descriptions restent dans la langue fournie par SPAM ; les libellés de l’interface sont disponibles en FR/EN.

Les fichiers de cette nouvelle interface sont distincts de la soumission Twitch 0.1.1. Tester une nouvelle version hébergée ne remplace pas la version en cours d’examen.

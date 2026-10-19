# Déploiement du serveur SPAM Twitch dans Dokploy

## Source Git actuelle

Le serveur peut désormais être construit directement depuis `https://github.com/Jo0kker/spam-twitch.git`, branche `main`, Build Path `/`, Dockerfile `Dockerfile`, contexte `.`. Le dépôt est public et ne nécessite pas de clé SSH. Conserver les variables privées dans Dokploy, le port 8788, le domaine HTTPS et le volume `/data` existants.

Les installateurs viennent de GitHub Releases. Le Dockerfile ne copie plus les gros téléchargements ; les anciens liens de téléchargement redirigent vers GitHub. Les procédures ZIP et de découpage ci-dessous concernent l’ancien hébergement des fichiers, et ne sont plus nécessaires pour le déploiement depuis Git.

Le paquet `SPAM-Twitch-EBS-0.1.0.zip` peut être utilisé comme source **Application / Drag and Drop .zip** dans Dokploy. Il contient le Dockerfile à sa racine et n’inclut aucun secret ni donnée locale du streamer.

## Informations nécessaires

- L’adresse du panneau Dokploy et un serveur de déploiement disponible.
- Un sous-domaine dédié au backend, avec un certificat HTTPS valide.
- Une extension créée dans la console développeur Twitch : son Client ID et son secret de signature.

Le secret de l’extension se renseigne directement dans les variables d’environnement de Dokploy. Il ne doit pas être ajouté au ZIP ou au frontend Twitch.

## Créer l’application

1. Créer un projet `SPAM Twitch`, puis un service **Application**, par exemple `spam-twitch-ebs`, sur le serveur choisi.
2. Choisir la source **Drag and Drop .zip** et charger `SPAM-Twitch-EBS-0.1.0.zip`. Un dépôt Git contenant le même projet peut aussi servir de source.
3. Choisir le type de build **Dockerfile**, avec `Dockerfile` à la racine et le contexte de build à la racine.
4. Conserver la commande de démarrage définie dans l’image : `node server/ebs.mjs`.
5. Utiliser **une seule réplique sur le serveur choisi** : cette version conserve l’historique en mémoire et les associations dans un fichier local persistant. Elle ne partage pas son état entre plusieurs instances. Lors d’une mise à jour, arrêter l’ancienne instance avant de démarrer la nouvelle.

Le conteneur écoute sur `0.0.0.0:8788`. Il fonctionne avec l’utilisateur `node` et n’a pas besoin d’accéder à l’installation du jeu.

## Variables d’environnement

Dans l’onglet **Environment**, renseigner :

```dotenv
TWITCH_EXTENSION_CLIENT_ID=
TWITCH_EXTENSION_SECRET=
HOST=0.0.0.0
PORT=8788
EBS_DATA_PATH=/data/credentials.json
ALLOW_LOCAL_TESTING=false
```

Le Client ID et le secret Twitch doivent être réels avant le démarrage. Le serveur s’arrête explicitement s’ils sont absents ; il ne remplace pas les secrets manquants par des valeurs de démonstration. Pour les notifications de chaîne, il utilise l’ID numérique du broadcaster, comme dans l’exemple officiel Twitch. `TWITCH_EXTENSION_OWNER_ID` reste disponible comme surcharge facultative.

## Volume persistant

Dans **Advanced / Volumes**, ajouter un volume Docker nommé, par exemple `spam-twitch-data`, monté sur **`/data`**.

Ce volume conserve les associations des PC et les réglages des chaînes lors des redéploiements. Le chemin doit être accessible en écriture à l’utilisateur `node` du conteneur (UID 1000). Un volume neuf reprend normalement les permissions du dossier `/data` préparé dans l’image.

Conserver l’application sur le même serveur pour retrouver ce volume. L’historique des cartes, lui, est reconstruit après chaque redémarrage lorsque le compagnon se reconnecte.

## Domaine et HTTPS

Dans l’onglet **Domains**, configurer :

| Champ | Valeur |
| --- | --- |
| Host | Le sous-domaine choisi, sans `https://` |
| Path | `/` |
| Internal Path | Vide |
| Strip Path | Désactivé |
| Container Port | `8788` |
| HTTPS | Activé |
| Certificate | Let's Encrypt, ou un certificat valide déjà configuré |

Le DNS doit pointer vers le serveur qui reçoit les requêtes pour cette application. Le port indiqué dans **Domains** sert au routage interne via Traefik ; il n’est pas nécessaire d’ajouter une publication directe du port 8788 dans **Advanced / Ports**.

Utiliser un sous-domaine à la racine : les URL du compagnon et de l’extension sont prévues pour une origine comme `https://spam-api.example.com`, sans préfixe `/spam`.

## Déployer et vérifier

1. Enregistrer les réglages et lancer **Deploy**.
2. Vérifier le build, puis le démarrage dans les journaux Dokploy.
3. Ouvrir `https://SOUS-DOMAINE/health`. Le service doit répondre :

```json
{"ok":true,"service":"SPAM Twitch EBS","version":"0.1.0"}
```

Le Dockerfile fournit également un healthcheck interne sur `/health`. Un contrôle externe HTTPS reste nécessaire pour vérifier le domaine et le certificat.

4. Ajouter cette origine HTTPS à l’allowlist des domaines de requêtes de l’extension dans Twitch.
5. Dans la configuration Twitch de l’extension, saisir cette même origine puis générer le code d’association.
6. Dans le compagnon Windows, saisir l’origine et le code. Ouvrir des cartes dans SPAM et vérifier « Transmission active ».
7. Tester avec un compte viewer autorisé en **Hosted Test**, puis vérifier le fonctionnement pendant un combat et le retard de la vidéo.

## État de la vérification

Le backend et le circuit d’association sont testés localement avec les données réelles de SPAM. Le 19 octobre 2026, le ZIP serveur a été déployé avec succès sur **web-2** via Dokploy, avec un volume nommé `spam-twitch-data` monté sur `/data`. Le DNS `spam-twitch.codible.net` pointe vers ce serveur, le domaine utilise Let's Encrypt et `https://spam-twitch.codible.net/health` répond avec l’état attendu. La stratégie de mise à jour est `Stop First` et le service utilise une seule réplique.

L’accueil public, la confidentialité et les conditions d’utilisation sont servis depuis `server/site/`. Le ZIP Windows est inclus dans `downloads/` par le script de packaging ; le Dockerfile copie ce dossier. Le manifeste `/downloads.json` indique sa taille et son empreinte SHA-256. Le téléchargement utilise un flux et une URL de fichier précise, sans ouvrir de répertoire arbitraire.

Après le chargement ZIP dans **Drop**, le build peut être terminé alors que l’ancienne image répond encore. Lancer ensuite **Deploy Settings / Deploy**, confirmer et attendre la fermeture du dialogue ainsi que « Application deployed successfully ». Vérifier alors le domaine et le manifeste exact, plutôt que de conclure au succès à partir du build. **Reload** est également disponible pour recharger le service ; un rechargement de l’ancienne image ne remplace pas l’application de la nouvelle. `/`, les pages et les fichiers répondent ensuite 200, `/api/state` sans JWT reste protégé (401), et le compagnon se reconnecte avec son association persistée. Vérifier le téléchargement public complet contre le manifeste après chaque remplacement du paquet.

Le parcours public propose désormais l’installateur `SPAM-Twitch-Setup-0.1.0.exe` en premier. Le ZIP portable reste disponible. Les deux fichiers sont autorisés individuellement par le backend et leurs empreintes sont dans `/downloads.json`.

La version de bureau embarque son moteur et les deux distributions dépassent ensemble la taille d’un envoi unique accepté sur ce panneau. `tools/package-desktop-deploy.mjs` prépare donc des ZIP de morceaux de 64 000 000 octets, puis un ZIP final. Les appliquer dans l’ordre indiqué par `.runtime/desktop-deploy/sequence.json` : charger une partie, attendre **Deployment saved**, lancer le déploiement et vérifier dans les logs le nom du morceau copié avant de passer au suivant. L’image locale de cette application sert de base et doit déjà exister sur le build server. Le dernier build assemble les fichiers, vérifie les deux SHA-256 et conserve les morceaux dans l’image pour permettre une nouvelle compilation du contexte final. Aucun changement des protections réseau du panneau n’est nécessaire. Le téléchargement public complet de l’EXE est ensuite comparé au manifeste. Le ZIP serveur complet reste également produit pour un déploiement qui accepte sa taille.

## Références Dokploy

- [Sources et chargement ZIP](https://docs.dokploy.com/docs/core/providers)
- [Applications et volumes](https://docs.dokploy.com/docs/core/applications)
- [Domaines, HTTPS et port interne](https://docs.dokploy.com/docs/core/domains)

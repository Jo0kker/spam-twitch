# Configurer l’extension sur Twitch

## 1. Créer l’extension

Ouvrir https://dev.twitch.tv/console/extensions avec le compte qui possédera l’extension et créer une extension nommée, par exemple, « SPAM Card Inspector ».

Configurer une vue **Video Overlay** pour PC. Ce projet ne fournit pas de vue mobile : le survol avec la souris est prévu pour le lecteur web sur ordinateur.

Fichiers à renseigner dans Asset Hosting :

| Vue | Fichier |
| --- | --- |
| Video Overlay | `video_overlay.html` |
| Configuration | `config.html` |
| Live Configuration, si utilisée | `config.html` |

Activer le service de configuration Twitch, notamment le segment broadcaster accessible en écriture au streamer. L’adresse du backend y est conservée ; elle peut aussi être préremplie dans `runtime-config.json` au moment de construire le ZIP. Ne pas activer la demande d’identité viewer, les permissions de chat ou les Bits : ce projet n’en a pas besoin.

Ajouter **l’origine HTTPS du serveur EBS** dans l’allowlist des domaines de requêtes, par exemple `https://spam-ebs.example`. La politique CSP Twitch bloquera sinon les appels. Le frontend n’embarque pas de politique CSP de remplacement.

## 2. Héberger le backend

Pour Dokploy, le [guide dédié](DOKPLOY.md) détaille les réglages du service et du domaine.

Extraire `SPAM-Twitch-EBS-0.1.0.zip` sur un hébergement permettant un processus Node.js 22+ et une origine HTTPS publique. L’application locale du streamer ne sert pas directement les viewers.

Configurer ces variables côté serveur :

```dotenv
TWITCH_EXTENSION_CLIENT_ID=identifiant_de_l_extension
TWITCH_EXTENSION_SECRET=secret_extension_base64
HOST=0.0.0.0
PORT=8788
EBS_DATA_PATH=/data/credentials.json
ALLOW_LOCAL_TESTING=false
```

Le secret est celui de l’extension affiché dans la console développeur, pas un jeton OAuth de compte. Ne le mettre ni dans les fichiers de l’extension, ni dans le compagnon, ni dans un dépôt Git. Les notifications PubSub de chaîne utilisent l’ID numérique du broadcaster. `TWITCH_EXTENSION_OWNER_ID` permet de surcharger cette valeur si nécessaire. Ne jamais coller les secrets dans les journaux ou le chat.

Commande de démarrage :

```text
node server/ebs.mjs
```

L’hébergeur doit fournir HTTPS devant le service. `GET /health` permet de contrôler sa disponibilité. Conserver le fichier `EBS_DATA_PATH` sur un volume persistant pour ne pas perdre les associations après un redémarrage.

Le projet inclut également un Dockerfile :

```text
docker build -t spam-twitch-ebs .
docker run --env-file .env -p 127.0.0.1:8788:8788 -v spam-twitch-data:/data spam-twitch-ebs
```

Cette commande publie le port uniquement sur la boucle locale de l’hôte ; placer le proxy HTTPS devant. Sur une plateforme gérée, utiliser son routage HTTPS et son volume persistant.

## 3. Charger les fichiers Twitch

Charger `SPAM-Twitch-Extension-0.1.0.zip` dans la version de l’extension. Les fichiers HTML doivent être à la racine du ZIP, sans dossier parent. Le ZIP contient exclusivement le frontend ; aucun exécutable, module du jeu ou secret.

Passer la version en **Hosted Test**. Ajouter le compte streamer et les comptes viewers de test aux listes autorisées. Avant validation et publication Twitch, seuls les comptes de test autorisés voient l’extension.

## 4. Associer le PC

1. Le streamer installe et active l’extension dans le slot Overlay de sa chaîne.
2. Il ouvre la configuration de l’extension ; la connexion au service SPAM est automatique.
3. Il clique sur « Générer mon code ».
4. Dans le compagnon, il colle ce code et clique sur « Associer ». Aucune adresse de serveur n’est demandée. Le nom du PC est facultatif.
5. Le code, valable cinq minutes et utilisable une seule fois, est échangé contre une clé de publication propre à cette chaîne.
6. Le jeu tourne avec son module chargé ; le compagnon affiche « Transmission active ».

Une nouvelle association remplace la clé précédente de la chaîne. L’application Windows ne reçoit jamais le secret global de l’extension.

Si la fenêtre de configuration reste vide, essayer la même page en navigation privée avec le compte streamer connecté. Sur le poste de développement, SPAM et Streamlabs restaient tous deux vides dans le profil Chrome habituel ; la configuration SPAM et l’association ont fonctionné en navigation privée. Ce résultat indique un problème propre au profil, sans identifier précisément le réglage ou l’extension responsable.

## 5. Vérifier le live

- Vérifier d’abord la collection, puis un combat avec plusieurs cartes, un changement de PV, un changement de capacités, un écran vide et une fin de partie.
- Vérifier que les cartes retournées, masquées et enfumées n’ont pas de fiche révélant leur contenu.
- Survoler les cartes avec un compte viewer autorisé ; tester le plein écran, le mode cinéma et le redimensionnement.
- Si le jeu n’occupe pas toute l’image, régler les coordonnées et les dimensions de sa zone dans la configuration Twitch. Elles représentent la zone réellement diffusée après recadrage OBS.
- Régler le recadrage en pourcentage de l’image source du jeu si OBS rogne ses bords.
- Pour tester la synchronisation, provoquer une modification visuelle nette. Ajuster le retard supplémentaire si les fiches changent trop tôt ou trop tard.
- Interrompre le compagnon : les anciennes zones doivent disparaître après le délai de la vidéo et le seuil de déconnexion.
- Tester l’arrivée d’un nouveau viewer au milieu de la partie et un retour après masquage de l’extension.

Le survol est local à chaque viewer. Le curseur du streamer n’est pas utilisé pour déclencher les fiches.

## 6. Publication

La mise à disposition de tous les viewers passe par la revue Twitch. Le dossier local `publication/` contient les premiers visuels, le guide de revue et les brouillons des pages d’installation, de conditions d’utilisation et de confidentialité. Son `README.md` précise les points restant à confirmer avant déploiement et soumission. La présence de ces fichiers ne signifie pas qu’une revue Twitch ou une validation juridique a eu lieu.

Références officielles :

- https://dev.twitch.tv/docs/extensions/
- https://dev.twitch.tv/docs/extensions/life-cycle/
- https://dev.twitch.tv/docs/extensions/reference/
- https://dev.twitch.tv/docs/api/reference/#send-extension-pubsub-message

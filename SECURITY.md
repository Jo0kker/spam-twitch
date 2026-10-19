# Sécurité

Signaler une vulnérabilité à benjamin@codible.net, sans publier de secrets dans les issues. Ne jamais envoyer une clé Twitch ou le fichier `.runtime/companion.json`.

Les publications officielles proviennent de https://github.com/Jo0kker/spam-twitch/releases. Les mises à jour du compagnon installé sont vérifiées par une clé publique Ed25519 embarquée ; sa clé privée est un secret GitHub Actions, uniquement utilisé pour les tags de publication. La clé publique n’est pas un certificat Windows.

Les contributions externes ne doivent pas accéder aux secrets de publication. Vérifier les changements des workflows et des outils de build avant de fusionner. Ne jamais utiliser `pull_request_target` pour exécuter du code proposé par un contributeur.

En cas de compromission de la clé de publication ou du compte GitHub, suspendre les publications. Une nouvelle racine de confiance nécessite une réinstallation obtenue par un canal vérifié : une simple modification de clé sur le serveur n’est pas acceptée par les clients existants.

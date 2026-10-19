Le compagnon dispose d’une fenêtre Windows, d’un installateur par utilisateur et d’une fermeture qui arrête la transmission.

Cette version ajoute les mises à jour automatiques depuis les publications officielles de Jo0kker/spam-twitch : recherche au démarrage et toutes les quatre heures, téléchargement vérifié par un manifeste signé Ed25519, installation à la fermeture, sans relancer l’application. L’association Twitch et le dossier d’installation sont conservés. Le menu Application affiche l’état et permet une recherche manuelle. La version portable ne s’installe pas automatiquement.

Le connecteur est compilé lors de sa première installation avec les références de votre propre jeu. Aucune DLL propriétaire de SPAM n’est distribuée.

Les fichiers sont construits sur GitHub Actions, accompagnés de SHA256 et d’attestations de provenance. L’installateur n’a pas encore de signature Authenticode reconnue par Windows. Un manifeste signé de mise à jour et une attestation GitHub ne remplacent pas cette signature.

L’extension Twitch 0.1.0 reste en cours d’examen ; publier le compagnon ne vaut pas approbation de l’extension.

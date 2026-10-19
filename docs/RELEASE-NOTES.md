Le compagnon affiche maintenant une association persistante avec le PC, la chaîne Twitch, le serveur, la date d’association et le dernier contact confirmé. La connexion du PC est vérifiée même lorsque SPAM n’est pas ouvert ; elle est distincte de la transmission active des cartes.

Le bouton « Révoquer l’accès de ce PC » retire réellement son autorisation sur le serveur et sa clé locale, après confirmation. Si le serveur est inaccessible, l’application indique que la révocation n’est pas confirmée et conserve l’association pour réessayer. Un accès remplacé ou révoqué à distance est signalé explicitement. Les anciennes associations restent utilisables sans nouveau code.

Un seul PC est autorisé par chaîne. Le nouveau panneau de configuration Twitch préparé affiche le PC connecté ou hors ligne, le dernier envoi et le suivi du code (en attente, compte à rebours, utilisé, annulé). Il permet la révocation distante et l’annulation d’un code en attente. Ce panneau nécessite sa propre mise à jour Twitch : la version 0.1.0 actuellement en cours d’examen n’a pas été modifiée.

Cette publication met à jour le compagnon ; elle ne vaut ni approbation Twitch ni obtention d’un certificat Windows. Les fichiers sont construits par GitHub Actions, avec manifeste de mise à jour signé et attestations de provenance. La signature Authenticode du projet reste non configurée.

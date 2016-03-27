# Projet AWS Boomb à O

Tous les fichiers necessaire à l'execution sont dans :  bomber


## Base de donnée
#### Tout d'abords on doit lancé phpmyadmin et creer la base de donnée
qui se trouve dans le fichier bdd.txt .
        phpmyadmin-ctl install
         
en suite on install les dependences 

        npm install
et on lance le serveur mysql  

        mysql-ctl start 
et en fin le seveur de notre appli 
## app.js
#### Ce fichier est le serveur de l'application.

le serveur(node.js{nodedemon})doit etre lancé à partir de app.js  pour arreter apache.

## Le lien 
Le lien de depart de l'application est generé apres le lancement du serveur 

## Creation de compte 
une inscription est necessaire avant de pouvoir accéedé au jeu.

## Authentification 
Le couple Email/MDP sera utilisé pour authentifier le joueur.

## i eme compte 
Pour pouvoir testé pleinement le jeux, 2 compte au minimaume et 4 au maximaum peuvent etre necessaire.

## Apres authentification

Le joueur est dirigé dans une Room, où la liste des joueurs connecté l'attend.

Un AllCHat à été implementé pour la communication entre les joueurs avant d'aller en Game.

Un classement de tous les joueurs inscrit est aussi disponible.

## Comment jouer ? 

Un joueur desirant lancer une partie chosie entre 1 et 3 joueurs en cochant leur case, puis envoie l'invitation.

Les joueurs invités recoivent une invitation et ont la possibilité d'accepté ou de refuser le defi.

## In game
Une Map aléatoir est generé et charge les joueurs.
Une partie n'est finie que l'orsqu'il n y a qu'un seul survivant.

## Fin 
La page de fin de partie donne la possibilité aux joueurs de se logout, ou de revenir dans la room pour rejoué.


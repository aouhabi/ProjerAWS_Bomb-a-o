
 // declaration des variable 
var express = require('express');
var bodyP = require('body-parser');
var cookieP = require('cookie-parser');
var querystring = require('querystring');
var mysql = require('mysql');
var Regex = require("regex");
var passwordHash = require('password-hash');
var app = express();
var twig = require("twig");
var session = require('express-session');
var md5 = require('md5');
var escapee=require("html-escape");


app.set('views', '.');

// Configuration des middlewares
app
    .use(bodyP.urlencoded({ extended: false }))
    .use(cookieP())
    .use(express.static('.'))
  .use(session({secret: 'codesecret'}));
    ;
  
/********************* initialisation des socketd*************************/  
var server = app.listen(process.env.PORT );
var io = require('socket.io').listen(server);
var joueur_connecte=[] ;// tableau pour les joueur connecter
var sockets  ={}; 
var nbr_defi_lancer =[];


/*********************connexion a la BD*********************/
var db    = mysql.createConnection({
    host     : process.env.IP,   // pas touche à ça: spécifique pour C9!
    user     : process.env.C9_USER.substr(0,16),  // laissez comme ça, ou mettez
                                                    // votre login à la place
    password : '',
    database : 'c9'  // mettez ici le nom de la base de données
});
db.connect();


//Les parties.

var listeParties = [];
var nbParties = 0;


        /*******
        * page d'authentification
        **********/
                     
var  sess =null;           // creatioonn de laa sessioonn

app.all('/', function(req, res) {     //Page d'accueil et traitement sur l'authentification 
   
   
    //en cas de requet get il renvois ver la page d'authentification
    if (req.method == "GET") {
        if(!req.session.nom_joueur || sess==null)
        {
            res.render("view/index.twig");
            
        }else {
            
                res.render('view/menu.twig',{'id' :  req.session.id_joueur ,         // si le mot de passe est correct il le renvoi vers le menu
                                 'joueur': req.session.nom_joueur ,
                                  'etat'  : 'false'   } 
                            );     
        }
        
    }else{
    
    //en cas de requete post on traite les info pour authentification
        var r = req.body;          //on recupere la requete post
        var   _query="select * from user where email=?";  // requete pour selectionner l'utilisateur
        var regexEmail =/[a-zA-Z]*.[a-zA-Z]*@[a-zA-Z]*[a-zA-Z].[a-zA-Z]*[a-zA-Z]/; // regex pour l'email
        var regexPass = /[a-zA-Z0-9]{6,16}/ ;    // regex pour le mot de pass
       
    
        //virefication des champ saisis
      
        if (! regexEmail.test(r.email) ){
            res.render('view/index.twig', { 'email_incorect' : 'cette email :'+r.email+' est incorrect'  });
          
        }else if (! regexPass.test(r.pass)){
            res.render('view/index.twig', { 'email_incorect' : 'cette email :'+r.email+' est incorrect'  });
        }

        //envoyer la requete a la BDD
           
        db.query(_query,[r.email],function select(error , results,fields){  
    
            if(error){
    
            }else if(results.length>0){
                var tuple = results[0]; // on recupere les donner du tuple dans la BDD
          
                if(passwordHash.verify(r.pass, tuple['pass'] ))
                {  
                    //creation de la session
                    req.session.id_joueur=tuple['id'] ;                // initialisation  de l'identifiant du joueur dan la session
                    req.session.nom_joueur=tuple['nom']+'_'+tuple['prenom'];
                    req.session.etat  = true ;
                    req.session.partie_jouer= tuple['partie_jouer'];
                    req.session.partie_gagner =tuple['partie_gagner'] ;
                    sess=req.session ;
                    res.render('view/menu.twig',{'id' :  req.session.id_joueur ,         // si le mot de pass est correct il le renvoi ver le menu
                                     'joueur': req.session.nom_joueur ,
                                      'etat'  : req.session.etat  ,
                                      'partie_jouer' :  req.session.partie_jouer ,
                                      'partie_gagner': req.session.partie_gagner
                    } 
                    );     
                    }else{
                    res.render('view/index.twig',{'email_pass_incrct' : 'true',
                                            'id_joueur': r.id
                   });   
                }
                }else {         //  pas authentifié
                    res.render('view/index.twig',{'email_non_exst' : 'true'}); 
                }
        });
    }
});
    
app.post('/menu',function(req,res){
     if(req.body.etat){
   
             res.render('view/menu.twig',{'id' :  req.session.id_joueur ,         // si le mot de pass est correct il le renvoi ver le menu
                                     'joueur': req.session.nom_joueur ,
                                     'etat'  : req.session.etat ,
                                     'partie_jouer' :  req.session.partie_jouer ,
                                      'partie_gagner': req.session.partie_gagner
                 
             } 
                                     
                    );     
        }else{
             
            res.render("view/index.twig");
            
        }
    
});      
     
     
        /*********** inscription d'un joueur  ******************/
  
    
app.all('/inscription',function(req, res){      //methode de renvoie vers le formulaire d'inscription 
    if(req.method=='GET'){ 
        res.render('view/inscription.twig');
    }else { 
            var r =req.body ;    //recupere le resultat de la requete post 
             //on verifie les champ du formulaire
            var nomPrenom = /[a-zA-Z]*[a-zA-Z]/;
            var regEmail =/[a-zA-Z]*.[a-zA-Z]*@[a-zA-Z]*[a-zA-Z].[a-zA-Z]*[a-zA-Z]/;
            var regPass = /[a-zA-Z0-9]{6,16}/ ; 
     
       if (! nomPrenom.test(r.nom)){
            res.render('view/inscription.twig' ,{ 'nom' : 'true' });
            
       }else if (! nomPrenom.test(r.prenom)){
            res.render('view/inscription.twig' ,{ 'prenom':'true' })
             
       }else if (! regEmail.test(r.email)){
            res.render('view/inscription.twig' , {'email':'true'} )
              
       }else if (! regPass.test(r.pass)){
            res.render('view/inscription.twig' ,{ 'pass':'true' })
            
       }else if ((! regPass.test(r.conf_pass)) || (r.pass != r.conf_pass)){
            res.render('view/inscription.twig' ,{ 'conf_pass':'true' })
            
       }else {
            //verifier l'unicité de l'email 
            var requete_email = "SELECT id from user where email=? ";
            db.query( requete_email ,[r.email],  function(err, rows, fields) {
                if (err){
                    res.render('view/inscription.twig');
                }
                if (rows.length > 0){
                    res.render('view/inscription.twig',{'email_exst' :'true' });
                }else{
                    
                    //on insert le tuple 
                    r.pass = passwordHash.generate(r.pass);  //  hachage du mot de passe 
                    var q = db.query('insert into user(nom , prenom , email , pass) values (  ? , ? , ? , ? ) ; ' ,[r.nom , r.prenom , r.email ,r.pass], //insertion dans la table      
                        function(err, rows, fields) {
                
                            if (err){                                      
                                res.render('view/inscription.twig');
                            }
                            else{
                                res.redirect('/');// en cas d'inscription on le renvoi vers son compte
                            }
                        }
                    );
                }
            });
        }
    } 
    
}); 

app.get('/stats',function(req,res){     // recuperation des statistique depuis la BD 
  if(req.session.nom_joueur){  
     db.query("SELECT * FROM user order by partie_gagner desc, partie_jouer desc", function (err, rows) {
        if (err) {
            console.log(err);
            res.status(500).send('SQL Error');
        } else {
            res.render('view/stats.twig', { 'joueurs' : rows,
                                            'id_src'  : req.session.id_joueur,
                                            'nom'     : req.session.nom_joueur,
                                          });
        }
   
    });
    
       }
     else{
          res.render("view/index.twig");
            
    }    
});


app.get('/logout',function(req,res){ // gention de la déconnexion de la session 
    sess=null ;
    req.session.destroy(function(err){ // destruction de la session 
        if(err){
            console.log(err);
        } 
        else
        {
            res.redirect('/'); // redirection vers la page d'accueil 
        }
    });
});

app.post('/FinPartie',function(req, res) { // redirection vers la page de fin de partie 
     res.render("view/FinPartie.twig", { vainqueur : req.body.vainqueur, joueur1 : req.body.joueur1, joueur2 : req.body.joueur2, joueur3 : req.body.joueur3, etat : true});
});




/**************les sockets  ********************/


// Active sockets by session

var joueur_connecte ={};  // liste des utililisateurs connecter dans la socket 

io.sockets.on('connection', function(client) {    // ouverture socket global 
 var me={};   // variable utilisé pour recupéré les données de socket 
 var tab_jouer_connecter=[]; 

    if (client.handshake.query.mode == 0){ //S'il ouvre la socket depuis menu.twig
       
        for (var i in joueur_connecte){                 // parcour liste des utilisateur conecter 
            client.emit('joueur_connecte' , { user : joueur_connecte[i] }); // emission des utulisateurs connecter a tous 
        }
    
    
        client.on('joueur_c',function(joueur_c){     //  ouverture socket propre a chaque jouer a la connexion 
           
             me= joueur_c;       // recuperation du jouer connecter           
             me.nom=joueur_c.nom;  // recup de nom
             me.id=joueur_c.id;   // recup de id 
             me.partie_jouer=joueur_c.partie_jouer;
             me.partie_gagner=joueur_c.partie_gagner;
           if (joueur_connecte[me.id] === undefined ){
                joueur_connecte[me.id]=me;   // ajout dans le tableau des jouer connecter referencé pas son Id dans la table 
                sockets[me.id]=client ;    // stockage de la socket 
                nbr_defi_lancer[me.id]=true ;    // le joueur connecter a le droit d'invité des a present les autres
                client.broadcast.emit('joueur_connecte',{    // Emission du joueur connecter a tout les autres 
                    user :me 
                }); 
            }
        });
        
        client.on('disconnect' , function(){    // fermeture de la connexion et suppression de l'user de la liste 
        
            delete joueur_connecte[me.id];   // suppression du jouer de la liste des jouer connecter 
            io.sockets.emit('disuser',{ user :me});     // emission a tout les autres de la deconnexion 
        
            sess=null;
            
        });
          
        /******* quand un joueur lance un defi  ****/
         
        client.on('defi_lancer',function(defi){   
          var monNumPartie = 0; //boucle pour trouvé une place libre dans le tableau des parties ou en ajouté une.
           
            while (monNumPartie < nbParties && listeParties[monNumPartie] !== undefined) {
                    monNumPartie++;
            }
            listeParties[monNumPartie] = new creerPartie(monNumPartie,defi.joueurs.length + 1);//les défiés plus le defieur.
            if (monNumPartie >= nbParties)
            {
                nbParties++;
            }
            if  ( nbr_defi_lancer[defi.defieur]){
               
                for (var i = 0; i < defi.joueurs.length; i++){
                    //envoie du défi aux joueurs défiés et des données relative au defi.
                    sockets[defi.joueurs[i]].emit('defi_recu',{
                        defieur : defi.defieur,
                        num : monNumPartie,
                        monId : defi.joueurs[i],
                        listeInvite : defi.joueurs
                    }) ;
                }
                //envoie de la confirmation de défi et des données relative au defi.
                sockets[defi.defieur].emit('defi_lancer',{
                        defieur : defi.defieur,
                        num : monNumPartie,
                        monId : defi.joueurs[i],
                        listeInvite : defi.joueurs
                    }) ;
                
            }
            
          
        });
        
         /****  quand le defi est refuser  *****/
            
          client.on('refu_defi',function(ref_defi){ // defi refusé 
         
                nbr_defi_lancer[ref_defi.refu_joueur]= true ; // la variable d'invitation redevien true 
                for (var i = 0; i < ref_defi.joueurs.length; i++){ // les joueur invité qui ont repondu non peuvent maintenant invité 
                    nbr_defi_lancer[ref_defi.joueurs[i]]= true ;
                }
               
                client.emit('btn_reaparu');
          });
        
            /**** quand le defi est Accepter  *****/
            
             client.on('accept_defi',function(acc_defi){
            var idPartie = acc_defi.num;  // id partie 
            
            if (listeParties[idPartie].listId.length == 0) 
            {
                listeParties[idPartie].listId.push(acc_defi.id);// on ajoute le joueur qui a demandé la création de la partie.
                listeParties[idPartie].joueurPret++;
            }
            else {
                for (var i=0; i < listeParties[idPartie].listId.length;i++ )
                {
                    if (listeParties[idPartie].listId[i] == acc_defi.id )
                    {
                        //return; //Empeche un joueur d'accepter 2 fois ou plus
                    }
                    else 
                    {
                        listeParties[idPartie].listId.push(acc_defi.id);// le joueur a accepté le defi.
                        listeParties[idPartie].joueurPret++;
                        break;
                    }
                }
            }
            if (listeParties[idPartie].joueurPret == listeParties[idPartie].maxJoueur)
            {
                listeParties[idPartie].joueurPret=0;
                 for (var i =0; i < listeParties[idPartie].listId.length;i++ )
                {
                    //on envoie les joueurs dans la partie.
                    sockets[listeParties[idPartie].listId[i]].emit('debut',{partie : '/jeu/'+idPartie});
                    tab_jouer_connecter[listeParties[idPartie].listId[i]]=listeParties[idPartie].listId[i];
                }
            }
            app.get('/jeu/:idPartie',function(req, res) {
                //on récupère le numero de la partie pour son unicité.
                var idP = req.params.idPartie;
                db.query('UPDATE user SET partie_jouer =partie_jouer+1  WHERE id = ?', [ req.session.id_joueur]) ; // on incrémente le nombre de partie jouer.
                res.render(__dirname + '/view/jeu.twig', { idPartie : idP, idJoueur : req.session.id_joueur, login : req.session.nom_joueur } );// On envoit la page avec les données nécessaire à la connection à la partie.

            });
           
        });
            /**** CHAT *****/
        
                client.on('chat message', function(msg){  // serveur recois  un message et le diffuse 
               msg=escapee(msg); // échapement des caracteres avant de les envoyers au tout les autres 
                if(  msg!==""  ){
                io.emit('chat_message',{ msg :msg , nom : me.nom});   // emission du message aux autres 
               client.broadcast.emit('chat_son',{varr:true});

              }
                                   });
                 
        
    }
    if (client.handshake.query.mode == 1)//Si il ouvre la socket depuis jeu.twig
    {
        var idP;
        var nJ;
        client.on('partie', function(data){//connection à la partie.
            idP = data.idPartie;
            if (idP !== undefined && listeParties[idP] !== undefined){
                if (listeParties[idP].socketJoueurs.length < listeParties[idP].maxJoueur){ //Si la partie n'es pas pleine (double verif).
                    listeParties[idP].socketJoueurs[listeParties[idP].socketJoueurs.length] = client;//On ajoute ça socket à la partie.
                    nJ = listeParties[idP].socketJoueurs.length -1;// le numero du joueur et la place de la socket dans le tableau doivent correspondre.
                  
                    client.emit('joueur_connecte',{ num : nJ });// on informe le joueur de son numero.
                    if (listeParties[idP].socketJoueurs.length == listeParties[idP].maxJoueur){
                        client.emit('go');// le dernier joueur confirme le début de la partie.
                    }
                 }
            }
        });
    
        client.on('pret', function(data) {
            if (idP !== undefined && listeParties[idP] !== undefined){
                for (var i = 0; i < listeParties[idP].socketJoueurs.length; i++) {
                    //envoie du signal prêt pour que les joueurs charge les images et répondent si ils sont prêts (automatique).
                    listeParties[idP].socketJoueurs[i].emit('pret');
                }
            }
        });
    
        client.on('ok', function(data)
        {
            if (idP !== undefined && nJ !== undefined && listeParties[idP] !== undefined){
                if(listeParties[idP].etatMaj[nJ] == 0){// on s'assure que chaque joueur ne se connecte qu'une seule fois et on l'enregistre.
                    listeParties[idP].joueurs[nJ].login = data.nom;
                    listeParties[idP].joueurs[nJ].id = data.id;
                    listeParties[idP].joueurPret++;
                    listeParties[idP].etatMaj[nJ] = 1;
                }
                if (listeParties[idP].joueurPret >= listeParties[idP].socketJoueurs.length){
                    for (var i = 0; i < listeParties[idP].maxJoueur; i++)
                    {
                        listeParties[idP].etatMaj[i] = 0;
                    }
                    for (var i = 0; i < listeParties[idP].socketJoueurs.length; i++) {
                        //on envoie aux joueurs les détails de début de partie.
                        listeParties[idP].socketJoueurs[i].emit('debut',{joueurs : listeParties[idP].joueurs, map : listeParties[idP].murs, height : listeParties[idP].mapHeight});
                    }
                    //Lance la boucle de fonctionnement du jeu 20 fois par seconde (changer le 20 pour changer le nombre de boucle par seconde).
                    listeParties[idP].timer = setTimeout(send(idP), 1000 / 20);
                    listeParties[idP].lastTime = Date.now();
                }
            }
        });
        
        client.on('maj', function(data) {
            if (idP !== undefined && nJ !== undefined && listeParties[idP] !== undefined){
                if(listeParties[idP].etatMaj[nJ] == 0){// si on a pas encore reçu la mise à jour du joueur.
                    listeParties[idP].joueurs[nJ].inputList = data.input;// on enregistre son tableau d'entrée.
                    listeParties[idP].etatMaj[nJ] = 1;// on le note comme mis à jour.
                    listeParties[idP].cptMaj++;
                }
                if(listeParties[idP].cptMaj == listeParties[idP].joueurPret){
                    listeParties[idP].dt = 1000/15/(Date.now() - listeParties[idP].lastTime);//1000/15 onconsidere que toute les reponses doivent arriver en 66ms 
                    if (listeParties[idP].dt > 2) listeParties[idP].dt = 2;// on limite la variation.
                    if (listeParties[idP].dt < 0.50) listeParties[idP].dt = 0.50;
                    for (var j = 0 ; j < listeParties[idP].joueurPret; j++)
                    {
                        update(idP, j);
                    }
                    var nbMort = 0;//le nombre de mort.
                    var vainqueur = -1;// le vainqueur de la partie.
                    var mort = [];// la liste des morts.
                    var fin = false;// si la partie est finie.
                    for (var m = 0 ; m < listeParties[idP].joueurs.length; m++)
                    {
                        if (listeParties[idP].joueurs[m].vivant == false)
                        {
                            mort.push(listeParties[idP].joueurs[m].login);// si un joueur est mort on l'ajoute au tableau des morts.
                            nbMort++;
                        }
                        else
                        {
                            vainqueur = listeParties[idP].joueurs[m];// si la partie n'est pas finie cette variable est sans importance.
                        }
                    }
                    if (nbMort == listeParties[idP].joueurs.length - 1 )
                    {
                        //Si la partie est finie on enregistre le vainqueur dans la base de données et on envoie le signal de fin de partie.
                        db.query('UPDATE user SET partie_gagner =partie_gagner+1  WHERE id = ?', vainqueur.id) ;   
                        sendFin(idP, vainqueur, mort);
                        fin = true;
                         
                    }
                    if (listeParties[idP].doitEnvoyerMurs == true)
                    {
                        sendMurs(idP);// on envoie les modifications sur les murs et les bonus que si nécessaire.
                        listeParties[idP].doitEnvoyerMurs = false;
                    }
                    
                    sendJoueur(idP);// on envoie les modifications effectuées sur les joueurs.
                    listeParties[idP].cptMaj = 0;
                    for (var i = 0; i < listeParties[idP].maxJoueur; i++)
                    {
                            listeParties[idP].etatMaj[i] = 0;// remet les maj à 0.
                    }
                    if (fin == false){// si la partie n'est pas finie
                        listeParties[idP].timer = setTimeout(send(idP), 1000 / 20);// on redemandera les mise à jour dans 50ms.
                        listeParties[idP].lastTime = Date.now();// on enregistre le temps nécéssaire à toute l'opération.
                    }
                    else
                    {
                       delete (listeParties[idP]);// suppression de la partie.
                    }
                }
            }
        });
           
        client.on('disconnect',function(){
            if (idP !== undefined ){ 
                if (  listeParties[idP] !== undefined ) {// les deux tests assure que la partie n'est pas deja terminée lors de la deconection.
                    if (  listeParties[idP].maxJoueur > nJ && nJ > -1) // si le joueur est dans la partieet que la partie n'est pas fini.
                    {
                        listeParties[idP].joueurs[nJ].vivant = false;// on tue le joueur.
                        listeParties[idP].socketJoueurs[nJ] = null;// on ne lui enverra plus de message.
                        listeParties[idP].joueurPret--;// on n'attendra plus ça réponse pour les mise à jour.
                    }
                }
            }
       });
    }
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////////La logique du jeu//////////////////////////////////////////////////////////////////////////////////////////////////

//Les constantes

var width = 600; // la largeur de la carte est définie en variable globale pour des raisons de simplicité.
var mapWidth = 13; // largeur en nombre de bloc

//La taille des blocs.
var tailleBloc = Math.floor(width/mapWidth);

//La liste des entrées.
var espace = 4;
var haut = 0;
var bas = 1;
var gauche = 2;
var droite = 3;

//la taille des hitBox.
var diametreBalle = tailleBloc - 8;

//la liste des id des bonus.
var bombUp = 0;
var powerUp = 1;
var speedUp = 2;
var maxPower = 3;


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
 *Fonction d'émission du signal de mise à jour.
 * Param : 
 *  idP : l'id de la partie.
 * 
 * l'event est 'maj'.
 * demande aux joueurs de transmettre leur tableau d'entrées.
 */
function send(idP) {
    if (idP !== undefined && listeParties[idP] !== undefined){
        for (var i = 0; i < listeParties[idP].socketJoueurs.length; i++) {
             if (listeParties[idP].socketJoueurs[i] != null)
                listeParties[idP].socketJoueurs[i].emit('maj');
        }
    }
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
 *Fonction d'émission des joueurs.
 * Param : 
 *  idP : l'id de la partie.
 * 
 * l'event est 'maj joueur'.
 */
function sendJoueur(idP) {
    if (idP !== undefined && listeParties[idP] !== undefined){
        for (var i = 0; i < listeParties[idP].socketJoueurs.length; i++) {
            if (listeParties[idP].socketJoueurs[i] != null)
                listeParties[idP].socketJoueurs[i].emit('maj joueur', {j : listeParties[idP].joueurs});
        }
    }
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
 *Fonction d'émission des murs et des bonus.
 * Param : 
 *  idP : l'id de la partie.
 * 
 * l'event est 'maj murs'.
 */
function sendMurs(idP) {
    if (idP !== undefined && listeParties[idP] !== undefined){
        for (var i = 0; i < listeParties[idP].socketJoueurs.length; i++) {
            if (listeParties[idP].socketJoueurs[i] != null)
                listeParties[idP].socketJoueurs[i].emit('maj murs', {w : listeParties[idP].murs, b : listeParties[idP].listeBonus});
        }
    }
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
 *Fonction d'émission du signal de fin de partie .
 * Param : 
 *  idP : l'id de la partie.
 *  vainqueur : le joueur qui a gagné.
 *  mort : le tableau contenant les logins des autres joueurs de la partie.
 *
 * l'event est 'fin'.
 */
function sendFin(idP, vainqueur, mort){
    if (idP !== undefined && listeParties[idP] !== undefined){
        for (var i = 0; i < listeParties[idP].socketJoueurs.length; i++) {
            if (listeParties[idP].socketJoueurs[i] != null)
                listeParties[idP].socketJoueurs[i].emit('fin',{vainqueur : vainqueur.login, perdant : mort});
        }
    }
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
 *Classe partie.
 * constructeur :
 *  Param : 
 *      partieId : le numero de la partie qui est crée.
 *      nbJoueurs : le nombre de joueurs dans la partie.
 *
 * return : un objet de la classe partie.
 * la partie est à créer en première avent toute tentative de connection.
 */
function creerPartie(partieId, nbJoueurs)
{
this.id = partieId; //l'id de la partie qui correspond à ça place dans la liste de partie.
this.listId = []; //la liste des id des joueurs qui ont demandé la création de la partie.
switch (Math.floor(Math.random()*3)) { //On tire une taille au hasard parmis 3 tailles possible.
    case 0:this.mapHeight = 9;break;
    case 1:this.mapHeight = 11;break;
    case 2:this.mapHeight = 13;break;
    default:this.mapHeight = 13;break;
}
//La carte de la partie représenté par le canvas.
this.canvas = { width : width, height : this.mapHeight * tailleBloc };

this.maxJoueur = nbJoueurs; // le nombre de joueurs à accueillir.
this.joueurs = Array(nbJoueurs);
for (var i = 0; i < this.maxJoueur; i++)
{
    this.joueurs[i] = new joueur(i, this.canvas);// on génère les joueurs.
}
this.socketJoueurs = []; // les sockets des joueurs.
this.joueurPret = 0; // le nombre de joueurs actuellement connectés.
this.etatMaj = Array(this.maxJoueur); // tableau représentant si un joueur a été mis à jour ou pas.
for (var i = 0; i < this.maxJoueur; i++)
{
    this.etatMaj[i] = 0;
}
this.cptMaj = 0;
this.timer = null; // contiendra le retour de la fonction setTimeout.


this.nbBloc = Math.floor(this.mapHeight/2) * Math.floor(mapWidth/2); // le nombre de blocs de la carte.
var maxMur = this.mapHeight * mapWidth - this.nbBloc - 12; // le maximum de murs que l'on souhaite ( pas conservé ).
var minMur = maxMur / 2; // au minimum la moitié du maximum ( pas conservé ).

this.nbMur = Math.floor((Math.random() * minMur) + minMur); // le nombre de murs est tiré aléatoirement entre minMur et maMur.
this.murs = creerMurs(this.nbMur, this.nbBloc, this.mapHeight);// le tableau contenant le placement des murs.
this.doitEnvoyerMurs = false; // on envera les murs que si nécéssaire pour limiter les données à envoyer.

this.listeBonus = []; // la liste des bonus.
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
 *Fonction de génération des murs destructibles.
 * Param : 
 *  nbMur : le nombre de murs à placer.
 *  nbBloc le nombre de bloc de la carte.
 *  mapHeight : la hauteur de la carte.
 *
 * return : un tableau contenant les coordonnées des murs.
 */
function creerMurs(nbMur , nbBloc, mapHeight)
{
    var murs = Array(nbMur);
    //laisser les 3 cases de chaque coin vide pour y mettre les joueurs.
    //Attention algo bien compliqué.
    var placement = Array(nbMur + 12 + nbBloc); //nombre de mur plus les 12 cases vides plus les blocs infranchissables (nbBloc).
    for (var index = 0; index < nbMur + 12 + nbBloc; index++) //tableau de coordonnées en numero de case.
    {
    placement[index] = Array(2);
    }
    //Trois cases qui reste vide par coin.
    placement[0][0] = 0;
    placement[0][1] = 0;
    placement[1][0] = 1;
    placement[1][1] = 0;
    placement[2][0] = 0;
    placement[2][1] = 1;
    placement[3][0] = mapWidth - 1;
    placement[3][1] = 0;
    placement[4][0] = mapWidth - 2;
    placement[4][1] = 0;
    placement[5][0] = mapWidth -1;
    placement[5][1] = 1;
    placement[6][0] = 0;
    placement[6][1] = mapHeight -1;
    placement[7][0] = 1;
    placement[7][1] = mapHeight -1;
    placement[8][0] = 0;
    placement[8][1] = mapHeight -2;
    placement[9][0] = mapWidth - 1;
    placement[9][1] = mapHeight - 1;
    placement[10][0] = mapWidth - 2;
    placement[10][1] = mapHeight - 1;
    placement[11][0] = mapWidth - 1 ;
    placement[11][1] = mapHeight - 2;
    
    //Bloc infranchisable
    var cptBloc = 12;
    for (var i = 1; i < mapHeight; i += 2) {
        for (var j = 1; j < mapWidth; j += 2) {
            placement[cptBloc][0] = j;
            placement[cptBloc][1] = i;
            cptBloc++;
        }
    }
    //les 12 cases de coin + les nbBloc infranchissables premieres cases sont deja remplies par les cases ou il ne doit pa y avoir de mur.
    for (var cptPlace = nbBloc + 12 ; cptPlace < nbMur + nbBloc + 12; cptPlace++) {
        //pour s'assurer de ne pas placer un mur la ou il y a deja un element
        var xMur = Math.floor((Math.random()) * mapWidth); //numero de case entre 0 et 12
        var yMur = Math.floor((Math.random()) * mapHeight);
        for (var cptTemp = 0; cptTemp < cptPlace; cptTemp++) {
            if (placement[cptTemp][0] == xMur && placement[cptTemp][1] == yMur) // si la place est deja occupée on recommence du debut.
            {
                xMur = Math.floor((Math.random()) * mapWidth);
                yMur = Math.floor((Math.random()) * mapHeight);
                cptTemp = -1; //on repart à 0
            }
        }
        // on a enfin une place de libre.
        placement[cptPlace][0] = xMur; //pour ne pas poser 2 murs au même endroit.
        placement[cptPlace][1] = yMur;
        murs[cptPlace - nbBloc - 12] = Array(2);
        murs[cptPlace - nbBloc - 12][0] = xMur; //le tableau de murs qui sera retourné.
        murs[cptPlace - nbBloc - 12][1] = yMur;
    }
    return murs;
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
 *Classe joueur.
 * constructeur :
 *  Param : 
 *      numJoueur : le numero du joueur qui est crée.
 *      c : le canvas de la partie dans laquelle il est crée (pour les cartes de différentes taille).
 *
 * return : un objet de la classe joueur.
 */
function joueur(numJoueur, c) {

    var dBalle = tailleBloc - 8; // la taille de la hitBox du joueur mais elle n'est pas conservée ici.
    this.numJoueur = numJoueur; //son numero dans la partie.
    this.img = 0; //l'image que le client doit afficher.
    this.posX = 0; //sa position sur l'axe x.
    this.posY = 0; // sa position sur l'axe y.
    switch (numJoueur) {// on le positionne par rapport à son numero.
        case 0:// coin haut gauche.
            this.posX = 1 + dBalle / 2; 
            this.posY = 1 + dBalle / 2;
        break;
        case 1:// coin bas gauche.
            this.posX = c.width - 1 - dBalle / 2;
            this.posY = c.height - 1 - dBalle / 2;
            break;
        case 2:// coin haut droite.
            this.posX = c.width - 1 - dBalle / 2;
            this.posY = 1 + dBalle / 2;
            break;
        case 3:// coin bas gauche.
            this.posX = 1 + dBalle / 2;
            this.posY = c.height - 1 - dBalle / 2;
            break;
    }
    
    this.vivant = true;//le joueur est crée vivant.
    this.vitesse = c.width/75; //ça vitesse en fonction de la taille de la carte.
    this.inputList = [0, 0, 0, 0, 0]; //les entrées qui seront saisies par l'utilisateur.

    //ses bombes stoqués dans un tableau de taille 5 car il ne pourra pas avoir plus de 5 bombes.
    this.bombes = [
        [-999, -999],//initialisé comme étant inexistante.
        [-999, -999],
        [-999, -999],
        [-999, -999],
        [-999, -999]
    ];
   this.nbBombes = 0;//son nombre de bombes posés actuellement.
   this.maxBombes = 1;// le maximum de bombes qu'il peut poser actuellement.
   
   this.imgBombe =  [
        [0],
        [0],
        [0],
        [0],
        [0]
   ];
   
   //ses explosions stoqués dans un tableau de taille 5 car il ne pourra pas avoir plus de 5 bombes et donc pas plus de 5 explosions.
   this.exp = [
        [-999, -999],
        [-999, -999],
        [-999, -999],
        [-999, -999],
        [-999, -999]
   ];
   this.puissance = 1; // la puissance de l'explosion.
   //la puissance de l'explosion par direction pour l'affichage coté client.
   this.pExp = [
        [this.puissance, this.puissance, this.puissance, this.puissance],
        [this.puissance, this.puissance, this.puissance, this.puissance],
        [this.puissance, this.puissance, this.puissance, this.puissance],
        [this.puissance, this.puissance, this.puissance, this.puissance],
        [this.puissance, this.puissance, this.puissance, this.puissance]
   ];
   
   this.imgExp =  [
        [0],
        [0],
        [0],
        [0],
        [0]
   ];
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
 *Fonction de mise à jour des joueurs.
 * Param : 
 *  idP : l'id de la partie.
 *  numJ : le numero du joueur qui est à mettre à jour.
 *
 * met à jour la position des joueurs, l'animation, les bombes, les bonus.
 * les explosions sont gérés à part.
 */
//Met à jour les positions et états des objets non statique.
function update(idP ,numJ) {
  //Les modifications des joueurs vivant vont dans ce bloc
    if (listeParties[idP].joueurs[numJ].vivant == true) {
        var distanceX = 0; //les distance de deplacement en X et Y
        var distanceY = 0;

        if (listeParties[idP].joueurs[numJ].inputList[droite] != 0) {
        //Si on ne touche pas le bord droit par la gauche
            if (listeParties[idP].joueurs[numJ].posX + (listeParties[idP].joueurs[numJ].vitesse/ listeParties[idP].dt)/2 < width - 4 - diametreBalle / 2
                && collision(listeParties[idP].joueurs[numJ].posX, listeParties[idP].joueurs[numJ].posY, diametreBalle / 2, listeParties[idP].joueurs[numJ].vitesse/ listeParties[idP].dt, 0) != droite 
                && (collisionMur(idP, listeParties[idP].joueurs[numJ].posX, listeParties[idP].joueurs[numJ].posY, diametreBalle / 2, listeParties[idP].joueurs[numJ].vitesse/ listeParties[idP].dt, 0) != droite) 
                && (collisionBombe(idP, listeParties[idP].joueurs[numJ].posX, listeParties[idP].joueurs[numJ].posY, diametreBalle / 2, listeParties[idP].joueurs[numJ].vitesse/ listeParties[idP].dt, 0) != droite)) 
            {
             distanceX += listeParties[idP].joueurs[numJ].vitesse/ listeParties[idP].dt;
            }
        }
        if (listeParties[idP].joueurs[numJ].inputList[gauche] != 0) {
        //Si on ne touche pas le bord gauche par la droite
    
            if (listeParties[idP].joueurs[numJ].posX - (listeParties[idP].joueurs[numJ].vitesse/ listeParties[idP].dt)/2 > 4 + diametreBalle / 2
                && collision(listeParties[idP].joueurs[numJ].posX, listeParties[idP].joueurs[numJ].posY, diametreBalle / 2, -listeParties[idP].joueurs[numJ].vitesse/ listeParties[idP].dt, 0) != gauche 
                && (collisionMur(idP, listeParties[idP].joueurs[numJ].posX, listeParties[idP].joueurs[numJ].posY, diametreBalle / 2, -listeParties[idP].joueurs[numJ].vitesse/ listeParties[idP].dt, 0) != gauche) 
                && (collisionBombe(idP, listeParties[idP].joueurs[numJ].posX, listeParties[idP].joueurs[numJ].posY, diametreBalle / 2, -listeParties[idP].joueurs[numJ].vitesse/ listeParties[idP].dt, 0) != gauche)) 
            {
             distanceX -= listeParties[idP].joueurs[numJ].vitesse/ listeParties[idP].dt;
            }
        }
    
        if (listeParties[idP].joueurs[numJ].inputList[haut] != 0) {
        //Si on ne touche pas le bord du haut ou un bloc par le bas
    
            if (listeParties[idP].joueurs[numJ].posY - (listeParties[idP].joueurs[numJ].vitesse/ listeParties[idP].dt)/2 > 4 + diametreBalle / 2
                && collision(listeParties[idP].joueurs[numJ].posX, listeParties[idP].joueurs[numJ].posY, diametreBalle / 2, 0, -listeParties[idP].joueurs[numJ].vitesse/ listeParties[idP].dt) != haut 
                && (collisionMur(idP, listeParties[idP].joueurs[numJ].posX, listeParties[idP].joueurs[numJ].posY, diametreBalle / 2, 0, -listeParties[idP].joueurs[numJ].vitesse/ listeParties[idP].dt) != haut) 
                && (collisionBombe(idP, listeParties[idP].joueurs[numJ].posX, listeParties[idP].joueurs[numJ].posY, diametreBalle / 2, 0, -listeParties[idP].joueurs[numJ].vitesse/ listeParties[idP].dt) != haut))
            {
             distanceY -= listeParties[idP].joueurs[numJ].vitesse/ listeParties[idP].dt;
            }
        }
        if (listeParties[idP].joueurs[numJ].inputList[bas] != 0) {
        //Si on ne touche pas le bord du bas ou un bloc par le haut
    
            if (listeParties[idP].joueurs[numJ].posY + (listeParties[idP].joueurs[numJ].vitesse/ listeParties[idP].dt)/2 < listeParties[idP].canvas.height - 4 - diametreBalle / 2
                &&collision(listeParties[idP].joueurs[numJ].posX, listeParties[idP].joueurs[numJ].posY, diametreBalle / 2, 0, listeParties[idP].joueurs[numJ].vitesse/ listeParties[idP].dt) != bas 
                && (collisionMur(idP, listeParties[idP].joueurs[numJ].posX, listeParties[idP].joueurs[numJ].posY, diametreBalle / 2, 0, listeParties[idP].joueurs[numJ].vitesse/ listeParties[idP].dt) != bas) 
                && (collisionBombe(idP, listeParties[idP].joueurs[numJ].posX, listeParties[idP].joueurs[numJ].posY, diametreBalle / 2, 0, listeParties[idP].joueurs[numJ].vitesse/ listeParties[idP].dt) != bas)) 
            {
             distanceY += listeParties[idP].joueurs[numJ].vitesse/ listeParties[idP].dt;
            }
        }
    
        //On additionne les distance de déplacement avec les positions
        listeParties[idP].joueurs[numJ].posX += distanceX;
        listeParties[idP].joueurs[numJ].posY += distanceY;
        
        animate(listeParties[idP].joueurs[numJ], distanceX, distanceY);
       
        var aBonus = ramasseBonus(idP, listeParties[idP].joueurs[numJ].posX, listeParties[idP].joueurs[numJ].posY);
        switch (aBonus) {
            case bombUp:
                if (listeParties[idP].joueurs[numJ].maxBombes < 5){
                    listeParties[idP].joueurs[numJ].maxBombes++;
                }
                break;
            case powerUp :
                if (listeParties[idP].joueurs[numJ].puissance < 6)
                {
                    listeParties[idP].joueurs[numJ].puissance++;
                }
                break;
            case speedUp :
                if ( listeParties[idP].joueurs[numJ].vitesse < listeParties[idP].canvas.width/75 + 6)
                    listeParties[idP].joueurs[numJ].vitesse +=2;
                break;
            case maxPower :
                listeParties[idP].joueurs[numJ].puissance = 5;
        }
        
        //Si une bombe n'est pas d"ja présente sur la case ( faire concordé avec le retour de collisionBombe).
        if (listeParties[idP].joueurs[numJ].inputList[espace] != 0 && collisionBombe(idP,listeParties[idP].joueurs[numJ].posX, listeParties[idP].joueurs[numJ].posY, diametreBalle/2, 0, 0 ) != 100) {
            poserBombe(idP, numJ);
        }
    }
 }
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
 *Fonction de collision avec les blocs infranchissables.
 * Param : 
 *  xObjet : la position sur l'axe x de l'objet concercné (dans notre cas des joueurs).
 *  yObjet : la position sur l'axe y de l'objet concercné (dans notre cas des joueurs).
 *  longueur : la taille de l'objet.
 *  dX : la distance à parcourir sur l'axe x (positif = droite, negatif = gauche).
 *  dX : la distance à parcourir sur l'axe y sous forme d'entier (positif = bas, negatif = haut).
 *
 * return : la direction de la collision ou -1 si pas de collision.
 */
function collision(xObjet, yObjet, longueur, dX, dY) 
{
    //Déplacement à gauche
    if (0 > dX)
    {
        //on rammène les coordonnées de l'objet dans la canvas en coordonnée sur la carte en numero de case c'est à dire entre 0 et mapHeight et 0 et mapWidth 
        if ( Math.floor( (xObjet - longueur + dX) / tailleBloc)%2 ==  1 && Math.floor(yObjet / tailleBloc)%2 == 1 )
        {
            return gauche; //Collision à gauche
        }
        if ( Math.floor( (xObjet - longueur + dX) / tailleBloc)%2 ==  1 && Math.floor((yObjet - longueur + longueur/6) / tailleBloc)%2 == 1 )
        {
            return gauche; //Collision haut gauche
        }
        if ( Math.floor( (xObjet - longueur + dX) / tailleBloc)%2 ==  1 && Math.floor((yObjet + longueur - longueur/6) / tailleBloc)%2 == 1 )
        {
            return gauche; //Collision bas gauche
        }
    }
    //Déplacement à droite
    else if (0 < dX)
    {
        if ( Math.floor( (xObjet + longueur + dX) / tailleBloc)%2 ==  1 && Math.floor(yObjet / tailleBloc)%2 == 1 )
        {
            return droite; //Collision à droite
        }
        if ( Math.floor( (xObjet + longueur + dX) / tailleBloc)%2 ==  1 && Math.floor((yObjet - longueur + longueur/6) / tailleBloc)%2 == 1 )
        {
            return droite; //Collision haut droite
        }
        if ( Math.floor( (xObjet + longueur + dX) / tailleBloc)%2 ==  1 && Math.floor((yObjet + longueur - longueur/6) / tailleBloc)%2 == 1 )
        {
            return droite; //Collision bas droite
        }
    }
    //Déplacement vers le haut
    else if (0 > dY)
    {
        if ( Math.floor( xObjet / tailleBloc)%2 ==  1 && Math.floor( (yObjet - longueur + dY) / tailleBloc)%2 == 1 )
        {
            return haut; //Collision en haut
        }
        if ( Math.floor( (xObjet - longueur + longueur/6) / tailleBloc)%2 ==  1 && Math.floor( (yObjet - longueur + dY) / tailleBloc)%2 == 1 )
        {
            return haut; //Collision haut gauche
        } 
        if ( Math.floor( (xObjet + longueur - longueur/6) / tailleBloc)%2 ==  1 && Math.floor( (yObjet - longueur + dY) / tailleBloc)%2 == 1 )
        {
            return haut; //Collision haut droite
        } 
    }
    //Déplacement vers le bas
    else if (0 < dY)
    {
        if ( Math.floor( xObjet / tailleBloc)%2 ==  1 && Math.floor( (yObjet + longueur + dY) / tailleBloc)%2 == 1 )
        {
            return bas; //Collision en bas
        }
        if ( Math.floor( (xObjet - longueur + longueur/6) / tailleBloc)%2 ==  1 && Math.floor( (yObjet + longueur + dY) / tailleBloc)%2 == 1 )
        {
            return bas; //Collision bas gauche
        } 
        if ( Math.floor( (xObjet + longueur - longueur/6) / tailleBloc)%2 ==  1 && Math.floor( (yObjet + longueur + dY) / tailleBloc)%2 == 1 )
        {
            return bas; //Collision bas droite
        }
    }
    return -1; //Pas de collision
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
 *Fonction de collision avec les murs.
 * Param : 
 *  idP : l'id de la partie concercé.
 *  xObjet : la position sur l'axe x de l'objet concercné (dans notre cas des joueurs).
 *  yObjet : la position sur l'axe y de l'objet concercné (dans notre cas des joueurs).
 *  longueur : la taille de l'objet.
 *  dX : la distance à parcourir sur l'axe x (positif = droite, negatif = gauche).
 *  dX : la distance à parcourir sur l'axe y sous forme d'entier (positif = bas, negatif = haut).
 *
 * return : la direction de la collision ou -1 si pas de collision.
 */
function collisionMur(idP, xObjet, yObjet, longueur, dX, dY) 
{
    for(var w = 0; w < (listeParties[idP].nbMur); w++) //pour chaque murs
    {
        if(listeParties[idP].murs[w][0] < -1 && listeParties[idP].murs[w][1] < -1) //si il n'y à pas de murs.
        {
            continue;// on passe au suivant.
        }
        //Déplacement à gauche
        if (0 > dX)
        {
            if ( Math.floor( (xObjet - longueur + dX) / tailleBloc) == listeParties[idP].murs[w][0] && listeParties[idP].murs[w][1] == Math.floor(yObjet / tailleBloc) )
            {
                return gauche; //Collision à gauche
            }
        }
        //Déplacement à droite
        else if (0 < dX)
        {
            if ( Math.floor( (xObjet + longueur + dX) / tailleBloc) == listeParties[idP].murs[w][0] && listeParties[idP].murs[w][1] == Math.floor(yObjet / tailleBloc) )
            {
                return droite; //Collision à droite
            }
        }
        //Déplacement vers le haut
        else if (0 > dY)
        {
            if ( Math.floor( xObjet / tailleBloc) == listeParties[idP].murs[w][0] && listeParties[idP].murs[w][1] == Math.floor( (yObjet - longueur + dY) / tailleBloc) )
            {
                return haut; //Collision en haut
            }   
        }
        //Déplacement vers le bas
        else if (0 < dY)
        {
            if (Math.floor( xObjet / tailleBloc) == listeParties[idP].murs[w][0] && listeParties[idP].murs[w][1] == Math.floor( (yObjet + longueur + dY) / tailleBloc) )
            {
                return bas; //Collision en bas
            } 
        }
        
    }
    return -1; //Pas de collision
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
 *Fonction de collision avec les bombes.
 * Param : 
 *  idP : l'id de la partie concercé.
 *  xObjet : la position sur l'axe x de l'objet concercné (dans notre cas des joueurs).
 *  yObjet : la position sur l'axe y de l'objet concercné (dans notre cas des joueurs).
 *  longueur : la taille de l'objet.
 *  dX : la distance à parcourir sur l'axe x (positif = droite, negatif = gauche).
 *  dX : la distance à parcourir sur l'axe y sous forme d'entier (positif = bas, negatif = haut).
 *
 * return : la direction de la collision ou -1 si pas de collision.
 */
function collisionBombe(idP, xObjet, yObjet, longueur, dX, dY) 
{
    for (var i = 0; i < listeParties[idP].joueurs.length; i++) { //pour tout les joueurs
        for (var b = 0; b < listeParties[idP].joueurs[i].bombes.length; b++) { // on test sur chaque bombes de chaque joueurs.
            if(listeParties[idP].joueurs[i].bombes[b][0] < -1 && listeParties[idP].joueurs[i].bombes[b][1] < -1) //si il n'y à pas de bombe.
            {
                continue;// on passe à la suivante.
            }
            //Si on est sur la bombe (on vient de la poser) on peut bouger mais pas poser de bombe
            if ( Math.floor(xObjet / tailleBloc) == Math.floor(listeParties[idP].joueurs[i].bombes[b][0]/tailleBloc) && Math.floor(listeParties[idP].joueurs[i].bombes[b][1] / tailleBloc) == Math.floor(yObjet / tailleBloc) ) {
                return 100; //Valeur donnée à la présence d'une bombe sur la case.
            }
            //Déplacement à gauche
            if (0 > dX) {
                if ( Math.floor((xObjet - longueur + dX) / tailleBloc) == Math.floor(listeParties[idP].joueurs[i].bombes[b][0]/tailleBloc) && Math.floor(listeParties[idP].joueurs[i].bombes[b][1] / tailleBloc) == Math.floor(yObjet / tailleBloc) ) {
                    return gauche; //Collision à gauche
                }
            }
            //Déplacement à droite
            else if (0 < dX) {
                if ( Math.floor((xObjet + longueur + dX) / tailleBloc) == Math.floor(listeParties[idP].joueurs[i].bombes[b][0]/tailleBloc) && Math.floor(listeParties[idP].joueurs[i].bombes[b][1] / tailleBloc) == Math.floor(yObjet / tailleBloc) ) {
                    return droite; //Collision à droite
                }
            }
            //Déplacement vers le haut
            else if (0 > dY) {
                if ( Math.floor(xObjet / tailleBloc) == Math.floor(listeParties[idP].joueurs[i].bombes[b][0]/tailleBloc) && Math.floor(listeParties[idP].joueurs[i].bombes[b][1] / tailleBloc) == Math.floor( (yObjet - longueur + dY ) / tailleBloc) ) {
                    return haut; //Collision en haut
                }
            }
            //Déplacement vers le bas
            else if (0 < dY) {
                if ( Math.floor(xObjet / tailleBloc) == Math.floor(listeParties[idP].joueurs[i].bombes[b][0]/tailleBloc) && Math.floor(listeParties[idP].joueurs[i].bombes[b][1] / tailleBloc) == Math.floor( (yObjet + longueur + dY ) / tailleBloc) ) {
                    return bas; //Collision en bas
                }
            }
        }
    }
    return -1; //Pas de collision
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
 *Fonction de posage des bombes.
 * Param : 
 *  idP : l'id de la partie concercé.
 *  numJ : le numero du joueur qui a posé la bombe.
 */
function poserBombe(idP, numJ) {
    //Si il le nombre de bombes posées n'est pas le max.
    if (listeParties[idP].joueurs[numJ].nbBombes < listeParties[idP].joueurs[numJ].maxBombes) {
        //boucle pour trouver une place libre dans le tableau.
        var numbombe = listeParties[idP].joueurs[numJ].nbBombes;
        if (numbombe >= listeParties[idP].joueurs[numJ].bombes.length -1) numbombe = 0;
        while (listeParties[idP].joueurs[numJ].bombes[numbombe][0] > -1) {
            if (numbombe < listeParties[idP].joueurs[numJ].maxBombes && numbombe < listeParties[idP].joueurs[numJ].bombes.length -1 ) {
                numbombe++;
            }
            else {
                numbombe = 0;
            }
            if (numbombe == listeParties[idP].joueurs[numJ].nbBombes) {
                return; //Par sécurité si la boucle se déclanchait alors que le tableau est plein pour empêcher la boucle infinie.
            }
        }
        //A rajouter empêcher de poser 2 bombes sur la même case
        //on place la bombe au milieu de la case sur laquelle ce trouve le joueur.
        var bX = Math.floor(listeParties[idP].joueurs[numJ].posX / tailleBloc ) * tailleBloc + tailleBloc / 2;
        var bY = Math.floor(listeParties[idP].joueurs[numJ].posY / tailleBloc ) * tailleBloc + tailleBloc / 2;
        //positionne la bombe
        listeParties[idP].joueurs[numJ].bombes[numbombe][0] = bX;
        listeParties[idP].joueurs[numJ].bombes[numbombe][1] = bY;
        //enclencher le detonateur
        setTimeout(function() {if(idP !== undefined && listeParties[idP] !== undefined && listeParties[idP].joueurs[numJ] !== undefined){rmBombe(numbombe, idP, listeParties[idP].joueurs[numJ]);}}, 2000);
        listeParties[idP].joueurs[numJ].nbBombes++;// incrémenté le compteur de bombes joueur.
    }
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
 *Fonction de desctruction des bombes.
 * Param : 
 *  nb : le numero de la dans le tableau bombes.
 *  idP : l'id de la partie concercé.
 *  joueur : le joueur qui a posé la bombe.
 */
function rmBombe(nb, idP, joueur) {
    if (idP !== undefined && joueur !== undefined){//si la partie n'est pas finie quand la bombe explose.
        explose(nb, idP, joueur); //on provoque l'explosion.
        joueur.bombes[nb][0] = -999; //Supprime la bombe du tableau en mettant des coordonnées inprobables.
        joueur.bombes[nb][1] = -999;
        joueur.nbBombes--;// décrémente le compteur de bombes du joueurs.
    }
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
 *Fonction d'explosion des bombes.
 * Param : 
 *  ne : le numero de l'explosion dans le tableau exp, il doit correspondre à sa bombe dans bombes[]
 *  idP : l'id de la partie concercé.
 *  joueur : le joueur qui a provoqué l'explosion.
 */
function explose(ne, idP, joueur) {
  joueur.exp[ne][0] = joueur.bombes[ne][0];
  joueur.exp[ne][1] = joueur.bombes[ne][1];
  detruit(ne, idP, joueur); // La mort sera tester dans la même fonction.
  //La durée de l'explosion.
  setTimeout(function() {if (joueur !== undefined )rmExp(ne, joueur);}, 500); //On reteste la mort à la fin
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
 *Fonction de suppression des explosions.
 * Param : 
 *  ne : le numero de l'explosion à supprimer.
 *  joueur : le joueur qui a provoqué l'explosion.
 */ 
 function rmExp(ne, joueur) {
    if (joueur !== undefined){ //si la partie n'est pas finie quand l'explosion arrive.
      joueur.exp[ne][0] = -999; //on note l'explosion comme terminée.
      joueur.exp[ne][1] = -999;
    }
 }
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
 *Fonction de destruction des murs, des bonus, et des joueurs.
 * Param : 
 *  ne : le numero de l'explosion qui détruit quelque chose ( ou rien ).
 *  idP : l'id de la partie concercé.
 *  joueur : le joueur qui a provoqué l'explosion.
 * 
 * modifie les murs afin qu'ils soient considérés comme détruit.
 * modifie les joueurs pour qu'ils soient considérés comme mort.
 * modifie les bonus pour qu'ils soient considérés comme détruit.
 * modifie la puissance spécifique à chaque direction pour l'affichage coté client.
 */ 
function detruit(ne, idP, joueur) {
  //Pour ne detruire que le premier bloc toucher et ne pas toucher un joueur.
  var dGauche = (collision(joueur.exp[ne][0], joueur.exp[ne][1], 0, -tailleBloc, 0) == gauche && !(joueur.exp[ne][0] - tailleBloc / 2 < 0));
  var dDroite = (collision(joueur.exp[ne][0], joueur.exp[ne][1], 0, tailleBloc, 0) == droite && !(joueur.exp[ne][0] + tailleBloc / 2 > width));
  var dHaut = (collision(joueur.exp[ne][0], joueur.exp[ne][1], 0, 0, -tailleBloc) == haut && !(joueur.exp[ne][1] - tailleBloc / 2 < 0));
  var dBas = (collision(joueur.exp[ne][0], joueur.exp[ne][1], 0, 0, tailleBloc) == bas && !(joueur.exp[ne][1] + tailleBloc / 2 > listeParties[idP].canvas.height));
  //On test bloc par bloc.
  for (var i = 0; i < ((joueur.puissance) + 1); i++) {
       for (var w = 0; w < (listeParties[idP].nbMur); w++) { //pour chaque murs.
            // gauche
            if (dGauche == false && ((joueur.exp[ne][0] - tailleBloc / 2) / tailleBloc - i) == listeParties[idP].murs[w][0] && ((joueur.exp[ne][1] - tailleBloc / 2) / tailleBloc) == listeParties[idP].murs[w][1]) {
                 bonus(idP, listeParties[idP].murs[w][0], listeParties[idP].murs[w][1]); //On génère un bonus.
                 listeParties[idP].murs[w][0] = -999; //on note le murs comme détruit.
                 listeParties[idP].murs[w][1] = -999;
                 dGauche = true; // on empêche de toucher autre chose.
                 listeParties[idP].doitEnvoyerMurs = true; // on doit modifié l'affichage coté client pour les murs et les bonus.
            }
            //droite
            else if (dDroite == false && ((joueur.exp[ne][0] - tailleBloc / 2) / tailleBloc + i) == listeParties[idP].murs[w][0] && ((joueur.exp[ne][1] - tailleBloc / 2) / tailleBloc) == listeParties[idP].murs[w][1]) {
                 bonus(idP, listeParties[idP].murs[w][0], listeParties[idP].murs[w][1]);
                 listeParties[idP].murs[w][0] = -999;
                 listeParties[idP].murs[w][1] = -999;
                 dDroite = true;
                 listeParties[idP].doitEnvoyerMurs = true;
            }
            //haut
            else if (dHaut == false && ((joueur.exp[ne][0] - tailleBloc / 2) / tailleBloc) == listeParties[idP].murs[w][0] && ((joueur.exp[ne][1] - tailleBloc / 2) / tailleBloc - i) == listeParties[idP].murs[w][1]) {
                 bonus(idP, listeParties[idP].murs[w][0], listeParties[idP].murs[w][1]);
                 listeParties[idP].murs[w][0] = -999;
                 listeParties[idP].murs[w][1] = -999;
                 dHaut = true;
                 listeParties[idP].doitEnvoyerMurs = true;
            }
            //bas
            else if (dBas == false && ((joueur.exp[ne][0] - tailleBloc / 2) / tailleBloc) == listeParties[idP].murs[w][0] && ((joueur.exp[ne][1] - tailleBloc / 2) / tailleBloc + i) == listeParties[idP].murs[w][1]) {
                 bonus(idP, listeParties[idP].murs[w][0], listeParties[idP].murs[w][1]);
                 listeParties[idP].murs[w][0] = -999;
                 listeParties[idP].murs[w][1] = -999;
                 dBas = true;
                 listeParties[idP].doitEnvoyerMurs = true;
            }
       }
       for (var j = 0; j < listeParties[idP].joueurs.length; j++) { //pour chaque joueurs.
            if (dGauche == false && Math.floor(listeParties[idP].joueurs[j].posX / tailleBloc) == Math.floor((joueur.exp[ne][0] - i * tailleBloc)/tailleBloc) && Math.floor(listeParties[idP].joueurs[j].posY / tailleBloc) == Math.floor(joueur.exp[ne][1]/tailleBloc) ) {
                listeParties[idP].joueurs[j].vivant = false; // le joueur est mort.
            }
            else if (dDroite == false && Math.floor(listeParties[idP].joueurs[j].posX / tailleBloc) == Math.floor((joueur.exp[ne][0] + i * tailleBloc)/tailleBloc) && Math.floor(listeParties[idP].joueurs[j].posY / tailleBloc) == Math.floor(joueur.exp[ne][1]/tailleBloc) ) {
                listeParties[idP].joueurs[j].vivant = false;
            }
            else if (dHaut == false && Math.floor(listeParties[idP].joueurs[j].posX / tailleBloc) == Math.floor(joueur.exp[ne][0]/tailleBloc) && Math.floor(listeParties[idP].joueurs[j].posY / tailleBloc) == Math.floor( (joueur.exp[ne][1] - i * tailleBloc )/tailleBloc) ) {
                listeParties[idP].joueurs[j].vivant = false;
            }
            else if (dHaut == false && Math.floor(listeParties[idP].joueurs[j].posX / tailleBloc) == Math.floor(joueur.exp[ne][0]/tailleBloc) && Math.floor(listeParties[idP].joueurs[j].posY / tailleBloc) == Math.floor( (joueur.exp[ne][1] + i * tailleBloc )/tailleBloc) ) {
                listeParties[idP].joueurs[j].vivant = false;
            }
       }
       //On retient à partir de quand l'explosion c'est arrêtée.
       if (dGauche == false)
       {
           joueur.pExp[ne][gauche] = joueur.puissance ; // l'explosion continue.
       }
       else if (joueur.pExp[ne][gauche] > i)
       {
           joueur.pExp[ne][gauche] = i; // l'explosion c'est arrêtée.
       }
        if (dDroite == false)
       {
           joueur.pExp[ne][droite] = joueur.puissance ;
       }
       else if (joueur.pExp[ne][droite] > i)
       {
           joueur.pExp[ne][droite] = i;
       }
       
        if (dHaut == false)
       {
           joueur.pExp[ne][haut] = joueur.puissance ;
       }
       else if (joueur.pExp[ne][haut] > i)
       {
           joueur.pExp[ne][haut] = i;
       }
       
       if (dBas == false)
       {
           joueur.pExp[ne][bas] = joueur.puissance ;
       }
       else if (joueur.pExp[ne][bas] > i)
       {
           joueur.pExp[ne][bas] = i;
       }
       
       //pour chaque bonus.
       for(var b = 0; b < listeParties[idP].listeBonus.length; b++)
        {
           // gauche
            if (dGauche == false && ((joueur.exp[ne][0] - tailleBloc / 2) / tailleBloc - i) == listeParties[idP].listeBonus[b].posX && ((joueur.exp[ne][1] - tailleBloc / 2) / tailleBloc) == listeParties[idP].listeBonus[b].posY) {
                listeParties[idP].listeBonus[b].id = -1;// on note le bonus détruit
                listeParties[idP].doitEnvoyerMurs = true;// on doit modifié l'affichage coté client pour les murs et les bonus.
            }
            //droite
            else if (dDroite == false && ((joueur.exp[ne][0] - tailleBloc / 2) / tailleBloc + i) == listeParties[idP].listeBonus[b].posX&& ((joueur.exp[ne][1] - tailleBloc / 2) / tailleBloc) == listeParties[idP].listeBonus[b].posY) {
                listeParties[idP].listeBonus[b].id = -1;
                listeParties[idP].doitEnvoyerMurs = true;
            }
            //haut
            else if (dHaut == false && ((joueur.exp[ne][0] - tailleBloc / 2) / tailleBloc) == listeParties[idP].listeBonus[b].posX && ((joueur.exp[ne][1] - tailleBloc / 2) / tailleBloc - i) == listeParties[idP].listeBonus[b].posY) {
                listeParties[idP].listeBonus[b].id = -1;
                listeParties[idP].doitEnvoyerMurs = true;
            }
            //bas
            else if (dBas == false && ((joueur.exp[ne][0] - tailleBloc / 2) / tailleBloc) == listeParties[idP].listeBonus[b].posX && ((joueur.exp[ne][1] - tailleBloc / 2) / tailleBloc + i) == listeParties[idP].listeBonus[b].posY) {
                listeParties[idP].listeBonus[b].id = -1;
                listeParties[idP].doitEnvoyerMurs = true;
            }
        }
    }
    
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
 *Fonction de génération des bonus.
 * Param : 
 *  idP : l'id de la partie concercé.
 *  xBonus : la position sur l'axe x du mur détruit (et donc celui du bonus).
 *  yBonus : la position sur l'axe y du mur détruit (et donc celui du bonus).
 * 
 * ajoute l'id du bonus, son id correspond à ce qu'il apporte au joueur.
 * si -1 pas de bonus.
 */
function bonus(idP, xBonus, yBonus)
{
    //0 pour bomb up, 1 pour power up, 2 pour speed up, 3 pour max power.
    var chance = Math.floor((Math.random() ) * 100); //On tire un numero au hasard entre 0 et 99.
    var bonus = -1; // le bonus qui sera retourné.
    if (-1 < chance && chance < 10) bonus = bombUp; //entre 0 et 9 bombUp.
    else if ( 9 < chance && chance < 20) bonus = powerUp; //entre 10 et 19 powerUp. 
    else if ( 19 < chance && chance < 30) bonus = speedUp; // entre 20 et 29 speedUp.
    else if (chance == 99) bonus = maxPower; // 99 MaxPower.
    if (bonus != -1)
        listeParties[idP].listeBonus.push({id : bonus, posX : xBonus, posY : yBonus});//on ajoute le bonus à la liste aux coordonnées du mur détruit.
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
 *Fonction de ramassage des bonus.
 * Param : 
 *  idP : l'id de la partie concercé.
 *  xObjet : la position sur l'axe x de l'objet concercné (dans notre cas des joueurs).
 *  yObjet : la position sur l'axe y de l'objet concercné (dans notre cas des joueurs).
 * 
 * return : l'id du bonus, son id correspond à ce qu'il apporte au joueur.
 * Supprime aussi les bonus de la liste en mettant leur id à -1.
 */
function ramasseBonus(idP, xObjet, yObjet) 
{
    for(var b = 0; b < listeParties[idP].listeBonus.length; b++) //On parcourt la liste des bonus de la partie.
    {
        //Si on est sur la bonus.
        if ( Math.floor(xObjet/tailleBloc) == listeParties[idP].listeBonus[b].posX &&  Math.floor(yObjet/tailleBloc) == listeParties[idP].listeBonus[b].posY  && listeParties[idP].listeBonus[b].id != -1)
        {
            var id = listeParties[idP].listeBonus[b].id; // id temporaire.
            listeParties[idP].listeBonus[b].id = -1; //suppression du bonus.
            listeParties[idP].doitEnvoyerMurs = true; // si les murs et bonus ne devaient pas être envoyé.
            return id; // on retourne l'id et donc l'effet du bonus.
        }
    }
    return -1; //Pas de bonbon.
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
 *Fonction d'animation du joueur de ces bombes et explosions. 
 * Param : 
 *  joueur : le joueur concerné.
 *  dX : la direction sur l'axe x sous forme d'entier (positif = droite, negatif = gauche).
 *  dX : la direction sur l'axe y sous forme d'entier (positif = bas, negatif = haut).
 * 
 * modifie le numero d'image du joueur pour que le client affiche l'image correspondante.
 */
function animate(joueur,dX, dY)
{
    //Pour le numero des img ce refere aux sprites
    if (dX < 0)//gauche
    {
        //Methode pour prolonger l'animation.
            if (joueur.img == 9)
                joueur.img = 10;
            else if (joueur.img == 10)
                joueur.img = 11;
            else if (joueur.img == 11)
                joueur.img = 12;
            else if (joueur.img == 12)
                joueur.img = 13;
            else if (joueur.img == 13)
                joueur.img = 14;
            else if (joueur.img == 14)
                joueur.img = 15;
            else if (joueur.img == 15)
                joueur.img = 16;
            else if (joueur.img == 16)
                joueur.img = 17;
            else joueur.img = 9;
    }
    else if (dX > 0 ) // Droite
    {
             if (joueur.img == 18)
                joueur.img = 19;
            else if (joueur.img == 19)
                joueur.img = 20;
            else if (joueur.img == 20)
                joueur.img = 21;
            else if (joueur.img == 21)
                joueur.img = 22;
            else if (joueur.img == 22)
                joueur.img = 23;
            else if (joueur.img == 23)
                joueur.img = 24;
            else if (joueur.img == 24)
                joueur.img = 25;
            else if (joueur.img == 25)
                joueur.img = 26;
            else joueur.img = 18;
    }
    else if (dY < 0) //Haut uniquement
    {
         if (joueur.img == 27)
                joueur.img = 28;
            else if (joueur.img == 28)
                joueur.img = 29;
            else if (joueur.img == 29)
                joueur.img = 30;
            else if (joueur.img == 30)
                joueur.img = 21;
            else if (joueur.img == 31)
                joueur.img = 32;
            else if (joueur.img == 32)
                joueur.img = 33;
            else if (joueur.img == 33)
                joueur.img = 34;
            else if (joueur.img == 34)
                joueur.img = 35;
            else joueur.img = 27;
    }
    else if (dY > 0) //Bas uniquement
    {
        if (joueur.img == 0)
                joueur.img = 1;
            else if (joueur.img == 1)
                joueur.img = 2;
            else if (joueur.img == 2)
                joueur.img = 3;
            else if (joueur.img == 3)
                joueur.img = 4;
            else if (joueur.img == 4)
                joueur.img = 5;
            else if (joueur.img == 5)
                joueur.img = 6;
            else if (joueur.img == 6)
                joueur.img = 7;
            else if (joueur.img == 7)
                joueur.img = 8;
            else joueur.img = 0;
    }
    else //Immobile
    {
        if (-1 < joueur.img && joueur.img < 9 ) joueur.img = 5;
        if (8 < joueur.img && joueur.img < 18) joueur.img = 14;
        if (17 < joueur.img && joueur.img < 27) joueur.img = 23;
        if (26 < joueur.img && joueur.img < 36) joueur.img = 32;
    }
    
    for (var b = 0 ; b < joueur.bombes.length; b++)
    {
        if (joueur.bombes[b][0] > -1)
        {
            if (joueur.imgBombe[b] < 4)
            {
                joueur.imgBombe[b]++;
            }
            else if (joueur.imgBombe[b] > 8)
            {
                joueur.imgBombe[b] = 0;
            }
            else joueur.imgBombe[b]++;
        }
        else joueur.imgBombe[b] = 0;
    }
    
    for (var e = 0 ; e < joueur.exp.length; e++)
    {
        if (joueur.exp[e][0] > -1)
        {
            if (joueur.imgExp[e] < 3)
            {
                joueur.imgExp[e]++;
            }
            else if (joueur.imgExp[e] > 100)
            {
                joueur.imgExp[e] = 0;
            }
            else joueur.imgExp[e]++;
        }
        else joueur.imgExp[e] = 0;
    }
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

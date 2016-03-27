var express = require('express');
var bodyP = require('body-parser');
var cookieP = require('cookie-parser');

var app = express();

// Configuration des middlewares
app
    .use(bodyP.urlencoded({ extended: false }))
    .use(cookieP())
    .use(express.static('.'));
    
// Votre code va ici





app.listen(8080);
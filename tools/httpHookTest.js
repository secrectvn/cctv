 var express = require("express");
 var app = express();

 /* serves main page */
 app.get("/", function(req, res) {
      console.log('Home Test Success')
      res.end("Home Test Success");
 });

  app.get("/test", function(req, res) {
      console.log('Hook Test Success')
      res.end("Hook Test Success");
  });

  app.post("/post", function(req, res) {
      console.log('Post Test Success')
      res.end("Post Test Success");
  });

 var port = process.env.PORT || 5000;
 app.listen(port, function() {
   console.log("Listening on " + port);
 });
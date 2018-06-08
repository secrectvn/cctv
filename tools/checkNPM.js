var fs=require('fs');
function npmls(cb) {
  require('child_process').exec('npm ls --json', function(err, stdout, stderr) {
    if (err) return cb(err)
    cb(null, JSON.stringify(JSON.parse(stdout),null,3));
  });
}
npmls(function(yolo,stdout){
fs.writeFileSync(__dirname+'/npmls.json',stdout)
});

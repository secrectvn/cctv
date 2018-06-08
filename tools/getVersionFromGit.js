var fs = require('fs');
var branch = fs.readFileSync(__dirname+'/../.git/HEAD','utf8').replace('ref: refs/heads/','');
var version = fs.readFileSync(__dirname+'/../.git/FETCH_HEAD','utf8').split('\t')[0];
var rawLogRows = fs.readFileSync(__dirname+'/../.git/logs/HEAD','utf8').split('\t');
var prettyLog = [];

rawLogRows.forEach(function(logRow,n){
    var log = logRow.split('\n')[1].replace('\n','')
    if(log){
        var log = log.split(' ')
        prettyLog.push({
            version:log[1],
            lastVersion:log[0],
            time:log[4],
            timezone:log[5]
        })
    }
})
module.exports = {
    version:version,
    branch:branch,
    log:prettyLog,
}

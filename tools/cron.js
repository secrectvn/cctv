
var fs = require('fs');
var path = require('path');
var mysql = require('mysql');
var moment = require('moment');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var config=require(__dirname+'/../conf.json');
var sql=mysql.createConnection(config.db);

//set option defaults
s={};
if(config.cron===undefined)config.cron={};
if(config.cron.enabled===undefined)config.cron.enabled=true;
if(config.cron.deleteOld===undefined)config.cron.deleteOld=true;
if(config.cron.deleteOrphans===undefined)config.cron.deleteOrphans=false;
if(config.cron.deleteNoVideo===undefined)config.cron.deleteNoVideo=true;
if(config.cron.deleteNoVideoRecursion===undefined)config.cron.deleteNoVideoRecursion=false;
if(config.cron.deleteOverMax===undefined)config.cron.deleteOverMax=true;
if(config.cron.deleteLogs===undefined)config.cron.deleteLogs=true;
if(config.cron.deleteEvents===undefined)config.cron.deleteEvents=true;
if(config.cron.deleteFileBins===undefined)config.cron.deleteFileBins=true;
if(config.cron.interval===undefined)config.cron.interval=1;

if(!config.ip||config.ip===''||config.ip.indexOf('0.0.0.0')>-1)config.ip='localhost';
if(!config.videosDir)config.videosDir=__dirname+'/videos/';
if(!config.binDir){config.binDir=__dirname+'/fileBin/'}
if(!config.addStorage){config.addStorage=[]}
//containers
cronOverlapLock={};
cronAlreadyDeletedRowsWithNoVideosOnStart={};
//functions
module.exports.checkCorrectPathEnding=function(x){
    var length=x.length
    if(x.charAt(length-1)!=='/'){
        x=x+'/'
    }
    return x.replace('__DIR__',__dirname)
}
module.exports.dir={
    videos:module.exports.checkCorrectPathEnding(config.videosDir),
    fileBin:module.exports.checkCorrectPathEnding(config.binDir),
    addStorage:config.addStorage,
};
module.exports.moment=function(e,x){
    if(!e){e=new Date};if(!x){x='YYYY-MM-DDTHH-mm-ss'};
    return moment(e).format(x);
}
module.exports.nameToTime=function(x){x=x.replace('.webm','').replace('.mp4','').split('T'),x[1]=x[1].replace(/-/g,':');x=x.join(' ');return x;}
io = require('socket.io-client')('ws://'+config.ip+':'+config.port);//connect to master
module.exports.cx=function(x){x.cronKey=config.cron.key;return io.emit('cron',x)}
//emulate master socket emitter
module.exports.tx=function(x,y){module.exports.cx({f:'module.exports.tx',data:x,to:y})}
module.exports.video=function(x,y){module.exports.cx({f:'module.exports.video',data:x,file:y})}
//Cron Job
module.exports.cx({f:'init',time:moment()})
module.exports.getVideoDirectory=function(e){
    if(e.mid&&!e.id){e.id=e.mid};
    if(e.details&&(e.details instanceof Object)===false){
        try{e.details=JSON.parse(e.details)}catch(err){}
    }
    if(e.details.dir&&e.details.dir!==''){
        return module.exports.checkCorrectPathEnding(e.details.dir)+e.ke+'/'+e.id+'/'
    }else{
        return module.exports.dir.videos+e.ke+'/'+e.id+'/';
    }
}
module.exports.getFileBinDirectory=function(e){
    if(e.mid&&!e.id){e.id=e.mid};
    return module.exports.dir.fileBin+e.ke+'/'+e.id+'/';
}
//filters set by the user in their dashboard
//deleting old videos is part of the filter - config.cron.deleteOld
module.exports.cronCheckFilterRules=function(v,callback){
    //filters
    if(!v.d.filters||v.d.filters==''){
        v.d.filters={};
    }
    //delete old videos with filter
    if(config.cron.deleteOld===true){
        v.d.filters.deleteOldByCron={
            "id":"deleteOldByCron",
            "name":"deleteOldByCron",
            "sort_by":"time",
            "sort_by_direction":"ASC",
            "limit":"",
            "enabled":"1",
            "archive":"0",
            "email":"0",
            "delete":"1",
            "execute":"",
            "where":[{
                "p1":"end",
                "p2":"<",
                "p3":"NOW() - INTERVAL "+(v.maxVideoDays[v.mid]*24)+" HOUR",
                "p3_type":"function",
            }]
        };
    }
    var keys = Object.keys(v.d.filters)
    if(keys.length>0){
        keys.forEach(function(m,current){
            var b=v.d.filters[m];
            if(b.enabled==="1"){
                b.ar=[v.ke];
                b.sql=[];
                b.where.forEach(function(j,k){
                    if(j.p1==='ke'){j.p3=v.ke}
                    switch(j.p3_type){
                        case'function':
                            b.sql.push(j.p1+' '+j.p2+' '+j.p3)
                        break;
                        default:
                            b.sql.push(j.p1+' '+j.p2+' ?')
                            b.ar.push(j.p3)
                        break;
                    }
                })
                b.sql='WHERE ke=? AND status != 0 AND details NOT LIKE \'%"archived":"1"%\' AND ('+b.sql.join(' AND ')+')';
                if(b.sort_by&&b.sort_by!==''){
                    b.sql+=' ORDER BY `'+b.sort_by+'` '+b.sort_by_direction
                }
                if(b.limit&&b.limit!==''){
                    b.sql+=' LIMIT '+b.limit
                }
                sql.query('SELECT * FROM Videos '+b.sql,b.ar,function(err,r){
                     if(r&&r[0]){
                        b.cx={
                            f:'filters',
                            name:b.name,
                            videos:r,
                            time:moment(),
                            ke:v.ke,
                            id:b.id
                        };
                        if(b.archive==="1"){
                            module.exports.cx({f:'filters',ff:'archive',videos:r,time:moment(),ke:v.ke,id:b.id});
                        }else{
                            if(b.delete==="1"){
                                module.exports.cx({f:'filters',ff:'delete',videos:r,time:moment(),ke:v.ke,id:b.id});
                            }
                        }
                        if(b.email==="1"){
                            b.cx.ff='email';
                            b.cx.delete=b.delete;
                            b.cx.mail=v.mail;
                            b.cx.execute=b.execute;
                            b.cx.query=b.sql;
                            module.exports.cx(b.cx);
                        }
                        if(b.execute&&b.execute!==""){
                            module.exports.cx({f:'filters',ff:'execute',execute:b.execute,time:moment()});
                        }
                    }
                })

            }
            if(current===keys.length-1){
                //last filter
                callback()
            }
        })
    }else{
        //no filters
        callback()
    }
}
//database rows with no videos in the filesystem
module.exports.cronDeleteRowsWithNoVideo=function(v,callback){
    if(
        config.cron.deleteNoVideo===true&&(
            config.cron.deleteNoVideoRecursion===true||
            (config.cron.deleteNoVideoRecursion===false&&!cronAlreadyDeletedRowsWithNoVideosOnStart[v.ke])
        )
    ){
        cronAlreadyDeletedRowsWithNoVideosOnStart[v.ke]=true;
        es={};
        sql.query('SELECT * FROM Videos WHERE ke = ? AND status != 0 AND details NOT LIKE \'%"archived":"1"%\' AND time < (NOW() - INTERVAL 10 MINUTE)',[v.ke],function(err,evs){
            if(evs&&evs[0]){
                es.del=[];es.ar=[v.ke];
                evs.forEach(function(ev){
                    ev.dir=module.exports.getVideoDirectory(ev)+module.exports.moment(ev.time)+'.'+ev.ext;
                    if(fs.existsSync(ev.dir)!==true){
                        module.exports.video('delete',ev)
                        es.del.push('(mid=? AND time=?)');
                        es.ar.push(ev.mid),es.ar.push(ev.time);
                        module.exports.tx({f:'video_delete',filename:module.exports.moment(ev.time)+'.'+ev.ext,mid:ev.mid,ke:ev.ke,time:ev.time,end:module.exports.moment(new Date,'YYYY-MM-DD HH:mm:ss')},'GRP_'+ev.ke);
                    }
                });
                if(es.del.length>0){
                    module.exports.cx({f:'deleteNoVideo',msg:es.del.length+' SQL rows with no file deleted',ke:v.ke,time:moment()})
                }
            }
            setTimeout(function(){
                callback()
            },3000)
        })
    }else{
        callback()
    }
}
//info about what the application is doing
module.exports.cronDeleteOldLogs=function(v,callback){
    if(!v.d.log_days||v.d.log_days==''){v.d.log_days=10}else{v.d.log_days=parseFloat(v.d.log_days)};
    if(config.cron.deleteLogs===true&&v.d.log_days!==0){
        sql.query("DELETE FROM Logs WHERE ke=? AND `time` < DATE_SUB(NOW(), INTERVAL ? DAY)",[v.ke,v.d.log_days],function(err,rrr){
            callback()
            if(err)return console.error(err);
            if(rrr.affectedRows.length>0){
                module.exports.cx({f:'deleteLogs',msg:rrr.affectedRows+' SQL rows older than '+v.d.log_days+' days deleted',ke:v.ke,time:moment()})
            }
        })
    }else{
        callback()
    }
}
//events - motion, object, etc. detections
module.exports.cronDeleteOldEvents=function(v,callback){
    if(!v.d.event_days||v.d.event_days==''){v.d.event_days=10}else{v.d.event_days=parseFloat(v.d.event_days)};
    if(config.cron.deleteEvents===true&&v.d.event_days!==0){
        sql.query("DELETE FROM Events WHERE ke=? AND `time` < DATE_SUB(NOW(), INTERVAL ? DAY)",[v.ke,v.d.event_days],function(err,rrr){
            callback()
            if(err)return console.error(err);
            if(rrr.affectedRows.length>0){
                module.exports.cx({f:'deleteEvents',msg:rrr.affectedRows+' SQL rows older than '+v.d.event_days+' days deleted',ke:v.ke,time:moment()})
            }
        })
    }else{
        callback()
    }
}
//check for temporary files (special archive)
cronDeleteOldFileBins=function(v,callback){
    if(!v.d.fileBin_days||v.d.fileBin_days==''){v.d.fileBin_days=10}else{v.d.fileBin_days=parseFloat(v.d.fileBin_days)};
    if(config.cron.deleteFileBins===true&&v.d.fileBin_days!==0){
        var fileBinQuery = ' FROM Files WHERE ke=? AND `date` < DATE_SUB(NOW(), INTERVAL ? DAY)';
        sql.query("SELECT *"+fileBinQuery,[v.ke,v.d.fileBin_days],function(err,files){
            if(files&&files[0]){
                //delete the files
                files.forEach(function(file){
                    fs.unlink(module.exports.getFileBinDirectory(file)+file.name,function(err){
//                        if(err)console.error(err)
                    })
                })
                //delete the database rows
                sql.query("DELETE"+fileBinQuery,[v.ke,v.d.fileBin_days],function(err,rrr){
                    callback()
                    if(err)return console.error(err);
                    if(rrr.affectedRows.length>0){
                        module.exports.cx({f:'deleteFileBins',msg:rrr.affectedRows+' files older than '+v.d.fileBin_days+' days deleted',ke:v.ke,time:moment()})
                    }
                })
            }else{
                callback()
            }
        })
    }else{
        callback()
    }
}
//check for files with no database row
cronCheckForOrphanedFiles=function(v,callback){
    if(config.cron.deleteOrphans===true){
        var finish=function(count){
            if(count>0){
                module.exports.cx({f:'deleteOrphanedFiles',msg:count+' SQL rows with no database row deleted',ke:v.ke,time:moment()})
            }
            callback()
        }
        e={};
        var numberOfItems = 0;
        sql.query('SELECT * FROM Monitors WHERE ke=?',[v.ke],function(arr,b) {
            if(b&&b[0]){
                b.forEach(function(mon,m){
                    fs.readdir(module.exports.getVideoDirectory(mon), function(err, items) {
                        e.query=[];
                        e.filesFound=[mon.ke,mon.mid];
                        numberOfItems+=items.length;
                        if(items&&items.length>0){
                            items.forEach(function(v,n){
                                e.query.push('time=?')
                                e.filesFound.push(module.exports.nameToTime(v))
                            })
                            sql.query('SELECT * FROM Videos WHERE ke=? AND mid=? AND ('+e.query.join(' OR ')+')',e.filesFound,function(arr,r) {
                                if(!r){r=[]};
                                e.foundSQLrows=[];
                                r.forEach(function(v,n){
                                    v.index=e.filesFound.indexOf(module.exports.moment(v.time,'YYYY-MM-DD HH:mm:ss'));
                                    if(v.index>-1){
                                        delete(items[v.index-2]);
                                    }
                                });
                                items.forEach(function(v,n){
                                    if(v&&v!==null){
                                        exec('rm '+module.exports.getVideoDirectory(mon)+v);
                                    }
                                    if(m===b.length-1&&n===items.length-1){
                                        finish(numberOfItems)
                                    }
                                })
                            })
                        }else{
                            if(m===b.length-1){
                                finish(numberOfItems)
                            }
                        }
                    })
                });
            }else{
                finish(numberOfItems)
            }
        });
    }else{
        callback()
    }
}
//user processing function
cronProcessUser = function(number,rows){
    console.log('processUser')
    var v = rows[number];
    if(!v){
        //no user object given
        return
    }
    if(!cronAlreadyDeletedRowsWithNoVideosOnStart[v.ke]){
        cronAlreadyDeletedRowsWithNoVideosOnStart[v.ke]=false;
    }
    if(!cronOverlapLock[v.ke]){
        // set overlap lock
        cronOverlapLock[v.ke]=true;
        //set permissions
        v.d=JSON.parse(v.details);
        //size
        if(!v.d.size||v.d.size==''){v.d.size=10000}else{v.d.size=parseFloat(v.d.size)};
        //days to keep videos
        v.maxVideoDays={}
        if(!v.d.days||v.d.days==''){v.d.days=5}else{v.d.days=parseFloat(v.d.days)};
        sql.query('SELECT * FROM Monitors WHERE ke=?', [v.ke], function(err,rr) {
            rr.forEach(function(b,m){
                b.details=JSON.parse(b.details);
                if(b.details.max_keep_days&&b.details.max_keep_days!==''){
                    v.maxVideoDays[b.mid]=parseFloat(b.details.max_keep_days)
                }else{
                    v.maxVideoDays[b.mid]=v.d.days
                };
            })
            cronDeleteOldLogs(v,function(){
                cronDeleteOldFileBins(v,function(){
                    cronDeleteOldEvents(v,function(){
                        cronCheckFilterRules(v,function(){
                            cronDeleteRowsWithNoVideo(v,function(){
                                cronCheckForOrphanedFiles(v,function(){
                                    //done user, unlock current, and do next
                                    cronOverlapLock[v.ke]=false;
                                    cronProcessUser(number+1,rows)
                                })
                            })
                        })
                    })
                })
            })
        })
    }
}
//recursive function
var cronTimeout;
cronStart = function(){
    clearTimeout(cronTimeout);
    x={};
    module.exports.cx({f:'start',time:moment()})
    sql.query('SELECT ke,uid,details,mail FROM Users WHERE details NOT LIKE \'%"sub"%\'', function(err,rows) {
        if(err){
            console.error(err)
        }
        if(rows&&rows[0]){
            cronProcessUser(0,rows)
        }
    })
    cronTimeout=setTimeout(function(){
        cronStart();
    },parseFloat(config.cron.interval)*60000*60)
}
cronStop = function(){
    clearTimeout(cronTimeout);
}
//socket commander
io.on('f',function(d){
    switch(d.f){
        case'start':case'restart':
            cronStart();
        break;
        case'stop':
            cronStop();
        break;
    }
})
console.log('Shinobi : cron.js loaded')
module.exports = {
    begin:cronStart,
    start:cronStart,
    restart:cronStart,
    stop:cronStop,
    end:cronStop,
    kill:cronStop
}
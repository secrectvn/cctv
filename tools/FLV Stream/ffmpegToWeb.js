// Shinobi (http://shinobi.video) - FFMPEG FLV over HTTP Test
// How to Use
// 1. Navigate to directory where this file is.
// 2. Run `npm install express moment`
// 3. Start with `node ffmpegToWeb.js`
// 4. Get the IP address of the computer where you did step 1. Example : 127.0.0.1
// 5. Open `http://127.0.0.1:8001/` in your browser.

var child = require('child_process');
var events = require('events');
var moment = require('moment');
var express = require('express')
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var spawn = child.spawn;
var exec = child.exec;
var Emitters = {}
var firstChunks = {}
var config = {
    port:8001,
    //ffmpegDir:'ffmpeg',//mac, linux
//    ffmpegInput:'-rtsp_transport tcp -i rtsp://112.162.205.151:554/axis-media/media.3gp',
    ffmpegInput:'-hwaccel cuvid -f dshow -i video=screen-capture-recorder',//windows screen
    ffmpegDir:'D:/Program Files/ffmpeg/ffmpeg.exe',//windows (shortcutted ffmpeg to the same directory as this file)
}
var initEmitter = function(feed){
    if(!Emitters[feed]){
        Emitters[feed] = new events.EventEmitter().setMaxListeners(0)
    }
    return Emitters[feed]
}
//hold first chunk of FLV video
var initFirstChunk = function(feed,firstBuffer){
    if(!firstChunks[feed]){
        firstChunks[feed] = firstBuffer
    }
    return firstChunks[feed]
}
console.log('Starting Express Web Server on Port '+config.port)
//start webserver
server.listen(config.port);

//make libraries static
app.use('/libs',express.static(__dirname + '/../../web/libs'));
app.use('/',express.static(__dirname + '/'));

//homepage with video element.
//static file send of index.html
app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
})

//// FLV over HTTP, this URL goes in the flv.js javascript player
// see ./index.html


io.on('connection', function (socket) {
    var emitter = initEmitter(1)
    var contentWriter;
    
    socket.emit('data',initFirstChunk('1'))
    
    emitter.on('data',contentWriter=function(buffer){
         socket.emit('flvData',buffer)
    })
    socket.on('disconnect', function (socket) {
        emitter.removeListener('data',contentWriter)
    })
});

//ffmpeg
console.log('Starting FFMPEG')
//var ffmpegString = config.ffmpegInput+' -r 15 -tune zerolatency -c:v libx264 -b:v 200k -crf 1 -an -f mpegts pipe:1'
var ffmpegString = config.ffmpegInput+' -an -c:v h264_nvenc -r 1 -f hls -tune zerolatency -g 1 -hls_time 0.1 -hls_list_size 2 -start_number 0 -live_start_index -3 -hls_allow_cache 0 -hls_flags +delete_segments+omit_endlist '+__dirname+'s.m3u8'
//var ffmpegString = config.ffmpegInput+' -r 15 -tune zerolatency -c:v h264_nvenc -crf 1 -vprofile baseline -preset ultrafast -pix_fmt yuv420p -b:v 400k -r 30 -threads 4 -fflags nobuffer -an -f mpegts pipe:1'
//+'-c:v h264_nvenc -an '+moment(new Date()).format('YYYY-MM-DDTHH-mm-ss')+'.mp4'
//var ffmpegString = '-i '+config.url+' -c:v libx264 -preset superfast -tune zerolatency -c:a aac -ar 44100 -f flv pipe:4'
//ffmpegString += ' -f mpegts -c:v mpeg1video -an http://localhost:'+config.port+'/streamIn/2'
if(ffmpegString.indexOf('rtsp://')>-1){
    ffmpegString='-rtsp_transport tcp '+ffmpegString
}
console.log('Executing : '+config.ffmpegDir+' '+ffmpegString)
var ffmpeg = spawn(config.ffmpegDir,ffmpegString.split(' '),{stdio:['pipe','pipe','pipe','pipe','pipe']});
ffmpeg.on('close', function (buffer) {
    console.log('ffmpeg died')
})
//// FFMPEG Error Logs
ffmpeg.stderr.on('data', function (buffer) {
    console.log(buffer.toString())
});
//data from pipe:1 output of ffmpeg

var onFFmpegData = function (buffer) {
    initFirstChunk('1',buffer)
    onFFmpegData = function (buffer) {
        initEmitter('1').emit('data',buffer)
    }
    onFFmpegData(buffer)
}

ffmpeg.stdio[1].on('data', onFFmpegData);
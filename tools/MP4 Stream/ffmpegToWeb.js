// Shinobi (http://shinobi.video) - FFMPEG MP4 over HTTP Test
// How to Use
// 1. Navigate to directory where this file is.
// 2. Run `npm install express`
// 3. Start with `node ffmpegToWeb.js`
// 4. Get the IP address of the computer where you did step 1. Example : 127.0.0.1
// 5. Open `http://127.0.0.1:8001/` in your browser.

var child = require('child_process');
var events = require('events');
var express = require('express')
var app = express();
var server = require('http').Server(app);
var spawn = child.spawn;
var exec = child.exec;
var Emitters = {}
var firstChunks = {}
var config = {
    port:8001,
    url:'rtsp://131.95.3.162/axis-media/media.3gp'
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

//// MP4 Stream over HTTP, this URL goes in the flv.js javascript player
// see ./index.html
app.get('/s.mp4', function (req, res) {
    //default to first feed
    if(!req.params.feed){req.params.feed='1'}
    //get emitter
    req.Emitter = initEmitter(req.params.feed)
    //variable name of contentWriter
    var contentWriter
    //set headers
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Access-Control-Allow-Origin','*');
    //write first frame on stream
    res.write(initFirstChunk(1))
    //write new frames as they happen
    req.Emitter.on('data',contentWriter=function(buffer){
        console.log(buffer)
        res.write(buffer)
    })
    //remove contentWriter when client leaves
    res.on('close', function () {
        req.Emitter.removeListener('data',contentWriter)
    })
});

//ffmpeg
console.log('Starting FFMPEG')
var ffmpegString = '-reorder_queue_size 5 -i '+config.url+' -c:v copy -an -movflags +frag_keyframe+empty_moov+default_base_moof -f mp4 pipe:1'
//var ffmpegString = '-i '+config.url+' -c:v libx264 -preset superfast -tune zerolatency -c:a aac -ar 44100 -f flv pipe:4'
//ffmpegString += ' -f mpegts -c:v mpeg1video -an http://localhost:'+config.port+'/streamIn/2'
if(ffmpegString.indexOf('rtsp://')>-1){
    ffmpegString='-rtsp_transport tcp '+ffmpegString
}
console.log('Executing : ffmpeg '+ffmpegString)
var ffmpeg = spawn('ffmpeg',ffmpegString.split(' '),{stdio:['pipe','pipe','pipe','pipe','pipe']});
ffmpeg.on('close', function (buffer) {
    console.log('ffmpeg died')
})
//// FFMPEG Error Logs
//ffmpeg.stderr.on('data', function (buffer) {
//    console.log(buffer.toString())
//});
//data from pipe:1 output of ffmpeg
ffmpeg.stdio[1].on('data', function (buffer) {
    initFirstChunk(1,buffer)
    initEmitter(1).emit('data',buffer)
});
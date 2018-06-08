// Shinobi (http://shinobi.video) - FFMPEG H.264 over HTTP Test
// How to Use raw H.264 (Simulated RTSP)
// 1. Start with `node ffmpegToWeb.js`
// 2. Get the IP address of the computer where you did step 1. Example : 127.0.0.1
// 3. Open VLC and "Open Network Stream".
// 4. Input the following without quotes : `http://127.0.0.1:8001/h264` and start.

var child = require('child_process');
var io = require('socket.io');
var Splitter = require('stream-split')
var events = require('events');
var express = require('express')
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var spawn = child.spawn;
var exec = child.exec;
var Emitters = {}
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
var NALseparator = new Buffer([0,0,0,1]);
//web app
console.log('Starting Express Web Server on Port '+config.port)

server.listen(config.port);

app.use('/libs',express.static(__dirname + '/../../web/libs'));
app.use('/Player',express.static(__dirname + '/Player'));

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
})

//ffmpeg pushed stream in here to make a pipe
app.all('/streamIn/:feed', function (req, res) {
    req.Emitter = initEmitter(req.params.feed)
    //req.params.feed = Feed Number (Pipe NWebGLumber)
	res.connection.setTimeout(0);

    var Split = new Splitter(NALseparator)
    var cn = io.to('STREAM_'+req.params.feed)
	req.on('data', function(buffer){
		req.Emitter.emit('data',buffer)
	});
    
    req.pipe(Split).on('data',function(buffer){
        cn.emit('h264_'+req.params.feed,Buffer.concat([NALseparator,buffer]))
    })
    
	req.on('end',function(){
        delete(Split)
		console.log('close');
	});
})

//socket.io client commands
io.on('connection', function (cn) {
    cn.on('f',function (data) {
        switch(data.function){
            case'getStream':
                console.log(data)
                cn.join('STREAM_'+data.feed)
            break;
        }
    })
});

//simulate RTSP over HTTP
app.get(['/h264','/h264/:feed'], function (req, res) {
    if(!req.params.feed){req.params.feed='1'}
    req.Emitter = initEmitter(req.params.feed)
    var contentWriter
    var date = new Date();
    res.writeHead(200, {
        'Date': date.toUTCString(),
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Content-Type': 'video/mp4',
        'Server': 'Shinobi H.264 Test Stream',
    });
    req.Emitter.on('data',contentWriter=function(buffer){
        res.write(buffer)
    })
    res.on('close', function () {
        req.Emitter.removeListener('data',contentWriter)
    })
});

//ffmpeg
console.log('Starting FFMPEG')
var ffmpegString = '-i '+config.url+''
ffmpegString += ' -f mpegts -c:v mpeg1video -an http://localhost:'+config.port+'/streamIn/1'
ffmpegString += ' -pix_fmt yuv420p -b:v 600k -f rawvideo -c:v libx264 -vprofile baseline -tune zerolatency http://localhost:'+config.port+'/streamIn/2'
//ffmpegString += ' -f mpegts -c:v mpeg1video -an http://localhost:'+config.port+'/streamIn/2'
if(ffmpegString.indexOf('rtsp://')>-1){
    ffmpegString='-rtsp_transport tcp '+ffmpegString
}
console.log('Executing : ffmpeg '+ffmpegString)
var ffmpeg = spawn('ffmpeg',ffmpegString.split(' '));
ffmpeg.on('close', function (buffer) {
    console.log('ffmpeg died')
})
//ffmpeg.stderr.on('data', function (buffer) {
//    console.log(buffer.toString())
//});
//ffmpeg.stdout.on('data', function (buffer) {
//    Emitter.emit('data',buffer)
//});
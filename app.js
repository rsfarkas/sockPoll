// Credit: Gabriel Gianordoli
//Credit Umi Syam
/*---------- BASIC SETUP ----------*/
var express =  require('express');
var bodyParser = require('body-parser');
var app = express();
var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;
var PORT = 4000;

var db;

// Body Parser
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Express server
app.use(function(req, res, next) {
  // https://en.wikipedia.org/wiki/Cross-origin_resource_sharing
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  console.log('incoming request from ---> ' + ip);
  var url = req.originalUrl;
  console.log('### requesting ---> ' + url);
  next();
});

app.use('/', express.static(__dirname + '/public'));

  /*-------------- MONGODB --------------*/
var uri = 'mongodb://admin:admin@ds127428.mlab.com:27428/sockpoll';

MongoClient.connect(uri, function(err, database){
  if (err) return console.log(err);
  db = database;
  console.log("Database connection ready");

  var surveys = db.collection('surveys');

  /*-------------- SOCKET.IO + SERVER SETUP --------------*/
  var server = require('http').Server(app);
  var io = require('socket.io')(server);

  server.listen(PORT, function(){
    console.log('Express server is running at ' + PORT);
  });

  var polls = {};

  /*-------------- CUSTOM JS SETUP --------------*/
  var localArray = [];
  function createArr(key, value, index) {
    localArray[index] = {
      key: key,
      value: value
    };
  };

  function updateVote(index) {
    localArray[index]['value'] += 1;

  };

  /*-------------- INITIATE SOCKET CONNECTION --------------*/
  io.on('connection', function(socket) {

    console.log('A new user has connected: ' + socket.id);

    // Listeners
    socket.on('lobby', function() {

      leaveAllPolls(socket);

      socket.emit('poll-list', {
        polls: polls
      });
    });

    // Creating a new poll
    socket.on('create-poll', function(data) {

      var id = createId(7);

      polls[id] = {
        name: data.pollName,
        choiceOne: data.choiceOne,
        choiceTwo: data.choiceTwo,
        choiceThree: data.choiceThree,
        members: 0
      };

      createArr(data.choiceOne, 0, 0);
      createArr(data.choiceTwo, 0, 1);
      createArr(data.choiceThree, 0, 2);

      console.log('New poll id: ' + id + ', name: ' + polls[id].name);

      socket.emit('poll-list', {
        polls: polls
      });
    });

    // Joining a poll
    socket.on('poll', function(pollId){
      console.log('User ' + socket.id + ' is joining poll ' + pollId);
      socket.join(pollId);
      polls[pollId].members ++;
      socket.emit('joined-poll', { poll: polls[pollId] });
    });

    // Sending msgs over socket connection
    socket.on('msg-to-server', function(msg) {
      var array_keys = new Array();
      var array_values = new Array();

      for (var key in socket.rooms){
        array_keys.push(key);
        array_values.push(socket.rooms[key]);
      }
      console.log("keys " + array_keys);
      console.log("vals " + array_values[1]);

      var pollId = array_values[1];
      updateVote(msg - 1);
      surveys.save({'_id': pollId, localArray:localArray, writeConcern: {w:1 } }, function(err, result){
        if (err) return console.log(err);
        console.log('saved to database');
      });
      surveys.find({ _id: pollId }).toArray(function(err, result){
      if (err) return console.log(err);
        console.log('******* located in database');
        console.log(result)
        io.to(pollId).emit('msg-to-clients', {
          msg: msg,
          pollId: pollId,
          blob: result
        });
      });
    });

    // Disconnecting
    socket.on('disconnect', function() {
      leaveAllPolls(socket);
    });
  });

  function leaveAllPolls(socket){;
    console.log('Called leaveAllPolls.');

    var array_keys = new Array();
    var array_values = new Array();

    for (var key in socket.rooms){
      array_keys.push(key);
      array_values.push(socket.rooms[key]);
    }
    console.log("keys " + array_keys);
    console.log("vals " + array_values[1]);

    for(var i = 1; i < array_values.length; i++){
      var pollId = array_values[i];
      console.log("poll id is  ** "  + pollId);
      socket.leave(pollId);
      polls[pollId].members --;
      console.log('Leaving ' + pollId + '. Members: ' + polls[pollId].members);
    }
  };

  // https://gist.github.com/gordonbrander/2230317
  function createId(n) {
    return Math.random().toString(36).substr(2, n);
  }
});

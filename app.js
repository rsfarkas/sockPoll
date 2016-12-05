// Credit: Gabriel Gianordoli
/*---------- BASIC SETUP ----------*/
var express =  require('express');
var bodyParser = require('body-parser'); // helper for parsing HTTP requests
var app = express(); // our Express app
var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;
var PORT = 4000;

var db;

// Body Parser
app.use(bodyParser.urlencoded({ extended: false }));// parse application/x-www-form-urlencoded
app.use(bodyParser.json()); // parse application/json

// Express server
app.use(function(req, res, next) {
  // Setup a Cross Origin Resource sharing
  // See CORS at https://en.wikipedia.org/wiki/Cross-origin_resource_sharing
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  console.log('incoming request from ---> ' + ip);
  var url = req.originalUrl;
  console.log('### requesting ---> ' + url); // Show the URL user just hit by user
  next();
});

app.use('/', express.static(__dirname + '/public'));



// MONGO SETUP
var uri = 'mongodb://gmr-db-user:hkFBsb9IbN@ds053156.mlab.com:53156/dinnertime';

MongoClient.connect(uri, function(err, database){
  if (err) return console.log(err);
  db = database;
  console.log("Database connection ready");

  var polls = db.collection('chart');

  // -----> Socket.io setup
  var server = require('http').Server(app);
  var io = require('socket.io')(server);




  server.listen(PORT, function(){
    console.log('Express server is running at ' + PORT);
  });

  var rooms = {};

  /*-------------- APP --------------*/



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

  io.on('connection', function(socket) {
    /*––––––––––– SOCKET.IO starts here –––––––––––––––*/

    console.log('A new user has connected: ' + socket.id);

    // Listeners
    socket.on('lobby', function() {

      // Let's make sure we leave any possible rooms
      leaveAllRooms(socket);

      // Emit to all clients
      socket.emit('room-list', {
        rooms: rooms
      });
    });



    // Creating a new room
    socket.on('create-room', function(data) {

      var id = createId(7); // Create a random ID

      // new room Object
      rooms[id] = {         // Add to list of rooms
        name: data.roomName,   // The name sent by the user
        choiceOne: data.choiceOne,   // The name sent by the user
        choiceTwo: data.choiceTwo,   // The name sent by the user
        choiceThree: data.choiceThree,   // The name sent by the user
        members: 0        // Number of members in each room
      };

      createArr(data.choiceOne, 0, 0);
      createArr(data.choiceTwo, 0, 1);
      createArr(data.choiceThree, 0, 2);

      console.log('New room id: ' + id + ', name: ' + rooms[id].name);

      // Send to the user who created
      socket.emit('room-list', {
        rooms: rooms
      });
    });

    // Joining a room
    socket.on('room', function(roomId){
      console.log('User ' + socket.id + ' is joining room ' + roomId);
      socket.join(roomId);
      rooms[roomId].members ++;
      socket.emit('joined-room', { room: rooms[roomId] });
    });

    // Sending messages
    socket.on('msg-to-server', function(msg) {
      var array_keys = new Array();
      var array_values = new Array();

      for (var key in socket.rooms){
        array_keys.push(key);
        array_values.push(socket.rooms[key]);
      }
      console.log("keys " + array_keys);
      console.log("vals " + array_values[1]);

      var roomId = array_values[1];
      updateVote(msg - 1);
      polls.save({'_id': roomId, localArray:localArray, writeConcern: {w:1 } }, function(err, result){
        if (err) return console.log(err);
        console.log('saved to database');
      });
      polls.find({ _id: roomId }).toArray(function(err, result){
      if (err) return console.log(err);
        console.log('******* located in database');
        console.log(result)
        io.to(roomId).emit('msg-to-clients', {
          msg: msg,
          roomId: roomId,
          blob: result
        });
      });
    });


    // Disconnecting
    socket.on('disconnect', function() {
      leaveAllRooms(socket);
      io.sockets.emit('bye', 'See you, ' + socket.id + '!');
    });
  });

  function leaveAllRooms(socket){;
    console.log('Called leaveAllRooms.');

    var array_keys = new Array();
    var array_values = new Array();

    for (var key in socket.rooms){
      array_keys.push(key);
      array_values.push(socket.rooms[key]);
    }
    console.log("keys " + array_keys);
    console.log("vals " + array_values[1]);

    for(var i = 1; i < array_values.length; i++){
      var roomId = array_values[i];
      console.log("room id is  ** "  + roomId);
      socket.leave(roomId);
      rooms[roomId].members --;
      console.log('Leaving ' + roomId + '. Members: ' + rooms[roomId].members);
    }
  };

  // https://gist.github.com/gordonbrander/2230317
  function createId(n) {
    // Math.random should be unique because of its seeding algorithm.
    // Convert it to base 36 (numbers + letters), and grab the first 7 characters
    // after the decimal.
    return Math.random().toString(36).substr(2, n);
  }
});

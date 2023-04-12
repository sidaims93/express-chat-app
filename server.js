require("dotenv").config();
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session');

const PORT = 3000;

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var apiRouter = require('./routes/api');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'pages'));
//setting view engine to ejs
app.set("view engine", "ejs");

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret : 'somethingverylargeastringthatcannotbeguessed',
  resave : true,
  cookie: {
    maxAge: 36000000,
    httpOnly: false, // <- set httpOnly to false
    secure: false
  },
  saveUninitialized : true
}));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api', apiRouter);


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.json({'error': err.message});
});

const server = require('http').createServer(app)

const io = require('socket.io')(server, {
  cors: { origin: "http://localhost:3000" } 
});

io.on('connection', (socket) => {
  
  app.set('WebSocket', socket)
  console.log('Socket IO connected!');
  
  socket.on('disconnect', (obj) => {
    console.log('socket disconnected!');
    socket.broadcast.emit('disconnected_'+obj.id, obj);
  })
  
  socket.on('ReceiveMessage', (obj) => {
    console.log('receivemessage emitted');
    socket.broadcast.emit('receiveMessage_'+obj.recipient_id, obj)
  })

  socket.on('Login', (obj) => {
    console.log('Login event received');
    socket.broadcast.emit('Login', obj);
  })
})

server.listen(PORT, function () {
  console.log("Server is running on port "+PORT);
});

module.exports = app;

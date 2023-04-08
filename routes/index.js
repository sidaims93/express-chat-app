var express = require('express');
var router = express.Router();
var pagesPrefix = '../pages/';

const database = require('../database');

//Middlewares
function checkAuth(req, res, next) {
  var user_id = req.session.user_id || undefined;
  if(user_id != undefined) {
    next();
  } else {
    console.log({
      'status': false,
      'message': 'Unauthenticated'
    });
    res.redirect('/login');
  }
}

function checkNoAuth(req, res, next) {
  var user_id = req.session.user_id || undefined;
  if(user_id != undefined) {
    res.redirect('/');
  } else {
    next();
  }
}

async function getUserAccount(user_id) {
  return await new Promise((resolve, reject) => {
    const sqlQuery = `SELECT * from users where id = ?`;
    const params = [user_id];
    database.query(sqlQuery, params, (err, response) => {
      if (err) {
        return reject(err)
      }
      return resolve(response[0]);
    });
  });
}

async function getUserChatHistory(user_id) {
  return await new Promise((resolve, reject) => {
    const sqlQuery = `SELECT * FROM chats WHERE user_id = ? OR recipient_id = ? LIMIT 100;`;
    const params = [user_id, user_id];
    database.query(sqlQuery, params, (err, response) => {
      if (err) {
        return reject(err)
      }
      return resolve(response);
    });
  });
}

/* GET home page. */
router.get('/', checkAuth, async function(req, res) {
  var result = new Array();
  var usersArr = new Array();
  var userAccount = null;
  var userId = req.session.user_id;
  var chatHistory = null;
  var lastChatHistory = null;
  var lastUser;
    
  try {
    result = await new Promise((resolve, reject) => {
      const sidebarQuery = `select distinct(recipient_id), u.email, u.id, u.name, u.avatar from chats c join users u on c.recipient_id = u.id where (c.user_id = ? or c.recipient_id = ?)`;
      const params = [userId, userId];
      database.query(sidebarQuery, params, (err, response) => {
        if (err) {
          return reject(err)
        }
        return resolve(response)
      })
    });

    userAccount = await getUserAccount(userId);
    chatHistory = await getUserChatHistory(userId);

    usersArr = await new Promise((resolve, reject) => {
      const userQuery = `select * from users where id != ?`;
      const params = [userId];
      database.query(userQuery, params, (err, response) => {
        if (err) {
          return reject(err)
        }
        return resolve(response)
      });
    });

    if(chatHistory !== null && chatHistory[0]) {
      console.log('in if ');
      lastUser = await getUserAccount(chatHistory[0].recipient_id);
      lastChatHistory = await new Promise((resolve, reject) => {
        const userQuery = `select * from chats where user_id = ? or recipient_id = ?`;
        const params = [userId, userId];
        database.query(userQuery, params, (err, response) => {
          if (err) {
            return reject(err)
          }
          return resolve(response)
        });
      });
    } else {
      console.log('iN else ');
      lastChatHistory = await new Promise((resolve, reject) => {
        const userQuery = `select * from chats where recipient_id = ? order by id desc limit 1`;
        const params = [userId];
        database.query(userQuery, params, (err, response) => {
          if (err) {
            return reject(err)
          }
          return resolve(response)
        });
      });   
      
      lastUser = await getUserAccount(lastChatHistory[0].user_id); 
    }
  } catch(err) {
    result = new Array();
    usersArr = new Array();
    chatHistory = null;
    console.log('error here');
    console.trace();
    console.log(err.message);
  }

  console.log('here in lastchatHistory');
  console.log(lastChatHistory);

  const viewPayload = {
    'sidebar': result || null, 
    'usersArr': usersArr || null, 
    'userAccount': userAccount || null,
    'chatHistory': chatHistory || null,
    'lastUser': lastUser || null,
    'lastChatHistory': lastChatHistory || null,
  }
  res.render(pagesPrefix + 'chat', viewPayload);
});

router.get('/start_chat/:id', checkAuth, async function (req, res) {
  var user_id = req.session.user_id;
  var recipient_id = req.params.id;
  var result = await new Promise((resolve, reject) => {
    const sqlQuery = `insert into chats (user_id, recipient_id, message) VALUES (${user_id}, ${recipient_id}, '');`;
    const params = [req.session.user_id, recipient_id];
    database.query(sqlQuery, params, (err, response) => {
      if (err) {
        return reject(err)
      }
      return resolve(response)
    });
  });
  res.redirect('/');
});

router.post('/post/message', checkAuth, async(req, res) => {
  try {
    var returnResp
    var params = req.query
    var body = req.body;
    if(body.user_id && body.message) {
      var socket = req.app.get('WebSocket');
      var user_id = req.session.user_id;
      var recipient_id = body.recipient_id;
      var obj = [user_id, recipient_id, body.message];
      await new Promise((resolve, reject) => {
        const saveMessageQuery = `insert into chats (user_id, recipient_id, message) VALUES (?,?,?);`;
        const saveParams = obj;
        database.query(saveMessageQuery, saveParams, (err, response) => {
          if (err) {
            return reject(err)
          }
          return resolve(response)
        });
      });
      socket.broadcast.emit('ReceiveMessage', obj);
      returnResp = {'status': true, 'message': 'Broadcast success'}
    } else {
      returnResp = {'status': false, 'message': 'Invalid Request'}
    }
    return res.json(returnResp).status(200)  
  } catch (error) {
    console.trace(error);
    console.log(error.message);  
  }
});



router.get('/login', checkNoAuth, function (req, res) {
  res.render(pagesPrefix + 'login');
});

router.post('/login', checkNoAuth, function(req, res) {
  var email = req.body.email;
  var password = req.body.password;
  if(email && password) { 
    query = `SELECT * FROM users WHERE email = "${email}"`;
    database.query(query, function(error, data){
      if(data !== null && data != undefined && data.length > 0) {
        for(var count = 0; count < data.length; count++) {
          if(data[count].password == password) {
            req.session.user_id = data[count].id;
            req.session.save();
            res.redirect("/");
          } else {
            res.send('Incorrect Password');
          }
        }
      } else {
        res.send('Incorrect Email Address');
      }
      res.end();
    });
  } else {
    res.send('Please Enter Email Address and Password Details');
    res.end();
  }
});

router.get('/logout', checkAuth, function(request, response){
  request.session.destroy();
  response.redirect("/");
});

module.exports = router;

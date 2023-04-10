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

async function getSidebarUsers(userId) {
  
  var returnVal = new Array();

  var users = await new Promise((resolve, reject) => {
    const userQuery = `select * from users where id != ?`;
    const params = [userId];
    database.query(userQuery, params, (err, response) => {
      if (err) {
        return reject(err)
      }
      return resolve(response)
    });
  });

  for(var i in users) {
    returnVal[users[i].id] = users[i];
  }

  return returnVal;
}

async function getRecipientsForUser(userId) {
  var uniqueRecipients = await new Promise((resolve, reject) => {
    const query = `	
      SELECT DISTINCT user_id, recipient_id FROM chats
      WHERE chats.user_id = ? OR chats.recipient_id = ? 
    `;
    const params = [userId, userId];
    database.query(query, params, (err, response) => {
      if (err) {
        return reject(err)
      }
      return resolve(response)
    });
  });

  var userIds = new Array();
  if(uniqueRecipients !== null && uniqueRecipients) {
    for(var i in uniqueRecipients) {
      if(uniqueRecipients[i].user_id !== userId)
        userIds.push(uniqueRecipients[i].user_id);
      if(uniqueRecipients[i].recipient_id !== userId)
        userIds.push(uniqueRecipients[i].recipient_id);
    }
  }

  return await new Promise((resolve, reject) => {
    const query = 'SELECT * from users where id <> '+userId+' AND id in ('+userIds+')';
    const params = [];
    database.query(query, params, (err, response) => {
      if(err) reject(err);
      return resolve(response);
    })
  });
}

async function getUserAccount(userId) {
  return await new Promise((resolve, reject) => {
    const userQuery = `select * from users where id = ? limit 1`;
    const params = [userId];
    database.query(userQuery, params, (err, response) => {
      if (err) {
        return reject(err)
      }
      return resolve(response[0])
    });
  });
}

async function getChatHistory(userId, recipientId) {
  return await new Promise((resolve, reject) => {
    const userQuery = `select * from chats where (user_id = ${userId} and recipient_id = ${recipientId}) OR (user_id = ${recipientId} and recipient_id = ${userId})`;
    const params = [];
    database.query(userQuery, params, (err, response) => {
      if (err) {
        return reject(err)
      }
      return resolve(response)
    });
  });
}

/* GET home page. */
router.get('/', checkAuth, async function(req, res) {
  var sidebar = new Array();
  var account = null;
  var recipientAccount = null;
  var chatHistory = null;
  const userId = req.session.user_id;
    
  try {
    account = await getUserAccount(userId);
    chatHistory = await getChatHistory(account.id, account.last_message);
    sidebar = chatHistory !== null && chatHistory.length > 0 ? await getRecipientsForUser(userId) : await getSidebarUsers(userId);
    recipientAccount = await getUserAccount(account.last_message);
  } catch(err) {
    sidebar = new Array();
    console.log(err.message);
  }

  const payload = {
    'sidebar': sidebar,
    'chatHistory': chatHistory,
    'recipientAccount': recipientAccount,
    'userAccount': account
  }

  //console.log(payload);

  res.render(pagesPrefix + 'chat', payload);
});

async function updateUsersTableForMessage(user_id, recipient_id) {
  const query = 'UPDATE users SET last_message = ? where id = ?';
    
  await new Promise((resolve, reject) => {
    const params = [recipient_id, user_id];
    database.query(query, params, (err, response) => {
      if(err) return reject(err);
      return resolve(response);
    });
  })

  await new Promise((resolve, reject) => {
    const params = [user_id, recipient_id];
    database.query(query, params, (err, response) => {
      if(err) return reject(err);
      return resolve(response);
    });
  });

  return true;
}

router.post('/post/message', checkAuth, async(req, res) => {
  try {
    var returnResp
    var body = req.body;
    if(body.message) {
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
      await updateUsersTableForMessage(user_id, recipient_id);
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
  var updateResult = await new Promise((resolve, reject) => {
    const sqlQuery = `update users set last_message = ? where id = ?`;
    const params = [recipient_id, user_id];
    database.query(sqlQuery, params, (err, response) => {
      if (err) {
        return reject(err)
      }
      return resolve(response)
    });
  })
  res.redirect('/');
});

router.get('/login', checkNoAuth, function (req, res) {
  res.render(pagesPrefix + 'login');
});

router.post('/login', checkNoAuth, async function(req, res) {
  var email = req.body.email;
  var password = req.body.password;
  var loginResponse = null;
  if(email && password) { 
    const result = await new Promise((resolve, reject) => {
      const query = `SELECT * FROM users WHERE email = ?`;
      const params = [email];
      database.query(query, params, (err, response) => {
        if(err) return reject(err);
        if(response !== null && response.length) {
          if(response[0].password == password) {
            loginResponse = {
              "status": true,
              "message": "loggedIn",
              "userRecord": response[0]
            }
          } else {
            loginResponse = {
              "status": false,
              "message": "wrong password"
            }
          }
        } else {
          loginResponse = {
            "status": false,
            "message": "invalid creds"
          }
        }
        return resolve(loginResponse);
      });
    })


    if(result.status && result.status !== false) {
      await new Promise((resolve, reject) => {
        const query = "UPDATE users set last_login = ? where id = ?";
        const params = [new Date(), result.userRecord.id];
        database.query(query, params, (err, response) => {
          if(err) return reject(err);
          return resolve(response);
        })
      });

      req.session.user_id = result.userRecord.id;
      req.session.save();
      return res.redirect("/");
    } else {
      return res.json(result);
    }
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

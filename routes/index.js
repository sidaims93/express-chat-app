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
  var recipients = new Array();
  var uniqueRecipients = await new Promise((resolve, reject) => {
    const query = `
    SELECT 
      r.id AS "recipient_id", 
      r.avatar as "avatar", 
      r.name AS "recipient_name", 
      u.id AS "sender_id", 
      u.name AS "sender_name",
      r.last_login as "last_login",
      r.last_logout as "last_logout"
    FROM chats                                                                                          
    JOIN users u ON u.id = chats.user_id                                                     
    JOIN users r ON r.id = chats.recipient_id                                                
    WHERE chats.user_id = ? OR chats.recipient_id = ?	                                         
    GROUP BY chats.user_id, chats.recipient_id, chats.created_at ORDER BY chats.created_at desc;`;
    
    const params = [userId, userId];
    database.query(query, params, (err, response) => {
      if (err) {
        return reject(err)
      }
      return resolve(response)
    });
  });

  if(uniqueRecipients !== null && uniqueRecipients) {
    for(var i in uniqueRecipients) {
      recipients.push({
        "id": uniqueRecipients[i].recipient_id,
        "name": uniqueRecipients[i].recipient_name,
        "avatar": uniqueRecipients[i].avatar,
        "last_login": uniqueRecipients[i].last_login,
        "last_logout": uniqueRecipients[i].last_logout
      });
    }
  }
  return recipients;
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

  res.render(pagesPrefix + 'chat', payload);
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

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

/* GET home page. */
router.get('/', checkAuth, async function(req, res) {
  var result = new Array();
  var usersArr = new Array();
    
  try {
    result = await new Promise((resolve, reject) => {
      const sidebarQuery = `select distinct(recipient_id), u.email, u.id, u.name, u.avatar from chats c join users u on c.recipient_id = u.id where c.user_id = ?`;
      const params = [req.session.user_id];
      database.query(sidebarQuery, params, (err, response) => {
        if (err) {
          return reject(err)
        }
        return resolve(response)
      })
    });

    usersArr = await new Promise((resolve, reject) => {
      const userQuery = `select * from users where id != ?`;
      const params = [req.session.user_id];
      database.query(userQuery, params, (err, response) => {
        if (err) {
          return reject(err)
        }
        return resolve(response)
      });
    });
  
  } catch(err) {
    result = new Array();
    usersArr = new Array();
    console.log(err.message);
  }
  res.render(pagesPrefix + 'chat', {'sidebar': result, 'usersArr': usersArr});
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

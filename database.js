const mysql = require('mysql');

const connection = mysql.createConnection({
	host : 'localhost',
	database : 'chat_app',
	user : 'root',
	password : ''
});

connection.connect(function(error){
	if(error) {
		throw error;
	} else {
		console.log('MySQL Database is connected');
	}
});

module.exports = connection;
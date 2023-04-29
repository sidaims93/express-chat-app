const mysql = require('mysql2');

const connection = mysql.createConnection({
	host : 'localhost',
	database : 'chat_app',
	user : 'root',
	password : 'root'
});

connection.connect(function(error){
	if(error) {
		throw error;
	} else {
		console.log('MySQL Database is connected');
	}
});

module.exports = connection;
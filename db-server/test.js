// test.js
const Database = require('better-sqlite3');
const db = new Database(':memory:');
console.log('✅ better-sqlite3 工作正常！');
db.close();
const { DatabaseSync } = require('node:sqlite');

function openDatabase(filePath) {
  const db = new DatabaseSync(filePath);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');
  return db;
}

function createQuery(db, maxStatements = 200) {
  const statements = new Map();
  return function query(sql, params = []) {
    let statement = statements.get(sql);
    if (!statement) {
      statement = db.prepare(sql);
      if (statements.size >= maxStatements) statements.delete(statements.keys().next().value);
      statements.set(sql, statement);
    }
    const trimmed = sql.trim().toUpperCase();
    // RETURNING 需要返回行；INSERT/UPDATE/DELETE + RETURNING 不能用 run()
    if (
      trimmed.startsWith('SELECT') ||
      trimmed.startsWith('WITH') ||
      trimmed.startsWith('PRAGMA') ||
      /\bRETURNING\b/.test(trimmed)
    ) {
      return statement.all(...params);
    }
    return { changes: statement.run(...params).changes };
  };
}

module.exports = { openDatabase, createQuery };

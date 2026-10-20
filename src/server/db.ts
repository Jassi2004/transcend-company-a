import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
export function openDatabase(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS services(id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL,duration INTEGER NOT NULL,capacity INTEGER NOT NULL,price INTEGER NOT NULL,color TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS bookings(id TEXT PRIMARY KEY,serviceId TEXT NOT NULL REFERENCES services(id),name TEXT NOT NULL,email TEXT NOT NULL,date TEXT NOT NULL,time TEXT NOT NULL,seats INTEGER NOT NULL CHECK(seats>0),status TEXT NOT NULL CHECK(status IN ('confirmed','cancelled')),createdAt TEXT NOT NULL,idempotencyKey TEXT NOT NULL UNIQUE,payload TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS booking_slot ON bookings(serviceId,date,time,status);
    CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT,type TEXT NOT NULL,message TEXT NOT NULL,createdAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
  `);
  const insert = db.prepare(
    "INSERT OR IGNORE INTO services VALUES(?,?,?,?,?,?,?)",
  );
  insert.run(
    "consultation",
    "Product consultation",
    "A focused session to untangle your next big idea.",
    30,
    4,
    4500,
    "violet",
  );
  insert.run(
    "workshop",
    "Team workshop",
    "Make room for a little collective brilliance.",
    60,
    8,
    12000,
    "amber",
  );
  insert.run(
    "onboarding",
    "Personal onboarding",
    "A thoughtful introduction, built around you.",
    45,
    2,
    7500,
    "teal",
  );
  db.prepare("INSERT OR IGNORE INTO settings VALUES('fault','none')").run();
  db.prepare("INSERT OR IGNORE INTO settings VALUES('faultId','')").run();
  return db;
}
export type DB = ReturnType<typeof openDatabase>;
export function recordEvent(db: DB, type: string, message: string) {
  db.prepare("INSERT INTO events(type,message,createdAt) VALUES(?,?,?)").run(
    type,
    message,
    new Date().toISOString(),
  );
}

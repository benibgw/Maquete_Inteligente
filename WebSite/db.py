import json
import os
import sqlite3
import threading
import time

DB_PATH = os.getenv("DB_PATH", os.path.join(os.path.dirname(os.path.abspath(__file__)), "data.db"))
HISTORY_RETENTION_DAYS = float(os.getenv("HISTORY_RETENTION_DAYS", 7))

_lock = threading.Lock()
_conn = None
_last_prune = 0.0


def _init_schema(conn):
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS state (
            topic TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated REAL NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topic TEXT NOT NULL,
            value REAL NOT NULL,
            ts REAL NOT NULL
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_readings_topic_ts ON readings (topic, ts)")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts REAL NOT NULL,
            kind TEXT NOT NULL,
            topic TEXT NOT NULL,
            value TEXT NOT NULL
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_events_ts ON events (ts)")
    conn.commit()


def get_conn():
    global _conn
    if _conn is None:
        with _lock:
            if _conn is None:
                _conn = sqlite3.connect(DB_PATH, check_same_thread=False)
                _conn.execute("PRAGMA journal_mode=WAL")
                _init_schema(_conn)
    return _conn


def save_state(topic, value):
    try:
        conn = get_conn()
        with _lock:
            conn.execute(
                "INSERT INTO state (topic, value, updated) VALUES (?, ?, ?) "
                "ON CONFLICT(topic) DO UPDATE SET value = excluded.value, updated = excluded.updated",
                (topic, json.dumps(value), time.time()),
            )
            conn.commit()
    except sqlite3.Error as error:
        print(f"Erro ao salvar estado: {error}")


def load_state():
    result = {}
    try:
        conn = get_conn()
        with _lock:
            rows = conn.execute("SELECT topic, value FROM state").fetchall()
        for topic, encoded in rows:
            try:
                result[topic] = json.loads(encoded)
            except (json.JSONDecodeError, TypeError):
                continue
    except sqlite3.Error as error:
        print(f"Erro ao carregar estado: {error}")
    return result


def record_reading(topic, value):
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return
    try:
        conn = get_conn()
        with _lock:
            conn.execute(
                "INSERT INTO readings (topic, value, ts) VALUES (?, ?, ?)",
                (topic, float(value), time.time()),
            )
            conn.commit()
    except sqlite3.Error as error:
        print(f"Erro ao registrar leitura: {error}")


def record_event(topic, value, kind):
    try:
        conn = get_conn()
        with _lock:
            conn.execute(
                "INSERT INTO events (ts, kind, topic, value) VALUES (?, ?, ?, ?)",
                (time.time(), kind, topic, json.dumps(value)),
            )
            conn.commit()
    except sqlite3.Error as error:
        print(f"Erro ao registrar evento: {error}")


def get_events(limit=50, since=0.0):
    try:
        conn = get_conn()
        with _lock:
            if since > 0:
                rows = conn.execute(
                    "SELECT ts, kind, topic, value FROM events WHERE ts >= ? "
                    "ORDER BY ts DESC, id DESC LIMIT ?",
                    (since, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT ts, kind, topic, value FROM events ORDER BY ts DESC, id DESC LIMIT ?",
                    (limit,),
                ).fetchall()
        events = []
        for ts, kind, topic, encoded in rows:
            try:
                value = json.loads(encoded)
            except (json.JSONDecodeError, TypeError):
                value = encoded
            events.append({"ts": ts, "kind": kind, "topic": topic, "value": value})
        return events
    except sqlite3.Error as error:
        print(f"Erro ao ler eventos: {error}")
        return []


def prune_old_data(now=None):
    global _last_prune
    now = now if now is not None else time.time()
    if now - _last_prune < 3600:
        return
    _last_prune = now
    try:
        conn = get_conn()
        with _lock:
            conn.execute(
                "DELETE FROM readings WHERE ts < ?",
                (now - HISTORY_RETENTION_DAYS * 86400,),
            )
            conn.execute(
                "DELETE FROM events WHERE ts < ?",
                (now - HISTORY_RETENTION_DAYS * 86400,),
            )
            conn.commit()
    except sqlite3.Error as error:
        print(f"Erro ao podar histórico: {error}")


def get_history(topic, limit=120, since=0.0):
    try:
        conn = get_conn()
        with _lock:
            if since > 0:
                rows = conn.execute(
                    "SELECT ts, value FROM readings WHERE topic = ? AND ts >= ? "
                    "ORDER BY ts DESC LIMIT ?",
                    (topic, since, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT ts, value FROM readings WHERE topic = ? ORDER BY ts DESC LIMIT ?",
                    (topic, limit),
                ).fetchall()
        rows.reverse()
        return [{"ts": ts, "value": value} for ts, value in rows]
    except sqlite3.Error as error:
        print(f"Erro ao ler histórico: {error}")
        return []
import json
import os
import sqlite3
import threading
import time

DB_PATH = os.getenv("DB_PATH", os.path.join(os.path.dirname(os.path.abspath(__file__)), "data.db"))
HISTORY_RETENTION_DAYS = float(os.getenv("HISTORY_RETENTION_DAYS", 7))
PRUNE_INTERVAL = float(os.getenv("PRUNE_INTERVAL", 3600))

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
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS schedules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            label TEXT NOT NULL,
            time TEXT NOT NULL,
            topic TEXT NOT NULL,
            value INTEGER NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            last_run_date TEXT
        )
        """
    )
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


def start_prune_thread():
    def worker():
        while True:
            time.sleep(PRUNE_INTERVAL)
            prune_old_data()

    threading.Thread(target=worker, daemon=True).start()


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


def add_schedule(label, time_str, topic, value):
    try:
        conn = get_conn()
        with _lock:
            cursor = conn.execute(
                "INSERT INTO schedules (label, time, topic, value) VALUES (?, ?, ?, ?)",
                (label, time_str, topic, int(bool(value))),
            )
            conn.commit()
            return cursor.lastrowid
    except sqlite3.Error as error:
        print(f"Erro ao adicionar agendamento: {error}")
        return None


def list_schedules():
    try:
        conn = get_conn()
        with _lock:
            rows = conn.execute(
                "SELECT id, label, time, topic, value, enabled, last_run_date "
                "FROM schedules ORDER BY time"
            ).fetchall()
        return [
            {
                "id": row[0],
                "label": row[1],
                "time": row[2],
                "topic": row[3],
                "value": bool(row[4]),
                "enabled": bool(row[5]),
                "last_run_date": row[6],
            }
            for row in rows
        ]
    except sqlite3.Error as error:
        print(f"Erro ao listar agendamentos: {error}")
        return []


def update_schedule(schedule_id, **fields):
    allowed = {
        "label": "label",
        "time": "time",
        "topic": "topic",
        "value": "value",
        "enabled": "enabled",
        "last_run_date": "last_run_date",
    }
    sets = []
    values = []
    for key, column in allowed.items():
        if key in fields:
            sets.append(f"{column} = ?")
            values.append(fields[key])
    if not sets:
        return False
    values.append(schedule_id)
    try:
        conn = get_conn()
        with _lock:
            conn.execute(f"UPDATE schedules SET {', '.join(sets)} WHERE id = ?", values)
            conn.commit()
            return True
    except sqlite3.Error as error:
        print(f"Erro ao atualizar agendamento: {error}")
        return False


def delete_schedule(schedule_id):
    try:
        conn = get_conn()
        with _lock:
            conn.execute("DELETE FROM schedules WHERE id = ?", (schedule_id,))
            conn.commit()
            return True
    except sqlite3.Error as error:
        print(f"Erro ao excluir agendamento: {error}")
        return False


def get_daily_summary():
    now = time.localtime()
    day_start = time.mktime((now.tm_year, now.tm_mon, now.tm_mday, 0, 0, 0, 0, 0, -1))
    result = {"day_start": day_start, "sensors": {}, "events": {}}
    try:
        conn = get_conn()
        with _lock:
            rows = conn.execute(
                "SELECT topic, COUNT(*), MIN(value), MAX(value), "
                "AVG(value) FROM readings WHERE ts >= ? GROUP BY topic",
                (day_start,),
            ).fetchall()
            event_rows = conn.execute(
                "SELECT kind, topic, COUNT(*) FROM events WHERE ts >= ? GROUP BY kind, topic",
                (day_start,),
            ).fetchall()
        for topic, count, minv, maxv, avgv in rows:
            result["sensors"][topic] = {
                "count": count,
                "min": minv,
                "max": maxv,
                "avg": avgv,
            }
        for kind, topic, count in event_rows:
            result["events"][f"{kind}:{topic}"] = count
            if kind == "state" and (
                topic.endswith("/alarme/triggered") or "/fumaca/state" in topic
            ):
                alert_key = f"alert:{topic}"
                result["events"][alert_key] = result["events"].get(alert_key, 0) + count
    except sqlite3.Error as error:
        print(f"Erro ao gerar resumo diário: {error}")
    return result
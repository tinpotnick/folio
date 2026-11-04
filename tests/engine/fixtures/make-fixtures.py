#!/usr/bin/env python3
"""Regenerate the binary SQLite fixtures in this directory.

    python3 tests/engine/fixtures/make-fixtures.py

Each file is a small, realistic database written with journal_mode=DELETE
so the one file is complete (a cleanly closed WAL database also reads
fine - see wal.db). Sizes stay small enough to commit.
"""
import calendar
import os
import random
import sqlite3
import time

HERE = os.path.dirname(os.path.abspath(__file__))
DEMO = os.path.join(HERE, "..", "..", "..", "demo", "data")

random.seed(20260304)

CDR_DDL = """
CREATE TABLE cdr (
  uuid TEXT PRIMARY KEY,
  bleg_uuid TEXT NOT NULL DEFAULT '',
  caller_id_name TEXT,
  caller_id_number TEXT,
  destination_number TEXT,
  start_at INTEGER NOT NULL,
  answer_at INTEGER DEFAULT 0,
  end_at INTEGER DEFAULT 0,
  duration INTEGER,
  bill_seconds INTEGER,
  hangup_cause TEXT,
  total_billed REAL DEFAULT 0,
  recorded INTEGER DEFAULT 0,
  transcription TEXT
);
CREATE INDEX idx_cdr_start_at ON cdr(start_at);
CREATE INDEX idx_cdr_bleg_uuid ON cdr(bleg_uuid);
"""

QUALITY_DDL = """
CREATE TABLE call_quality (
  uuid TEXT PRIMARY KEY,
  rating INTEGER,
  comment TEXT
);
"""

TOTALS_DDL = """
CREATE TABLE monthly_totals (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  total_billed REAL DEFAULT 0,
  row_count INTEGER DEFAULT 0
);
"""


def epoch(y, m, d, hh=0, mm=0, ss=0):
    return calendar.timegm((y, m, d, hh, mm, ss))


CALLERS = ["+441632960123", "01632960123", "+15551234567", "00441632960123"]
DESTS = ["+442071234567", "+15559876543", "999", "+4930901234567"]


def make_cdr_rows(year, month, count):
    """Realistic-looking CDR rows for one month. 01632960123 keeps its
    leading zero - it is TEXT in the schema. A few rows are second
    legs: their bleg_uuid links back to a primary leg's uuid."""
    rows = []
    days = [d for d in range(1, 32) if _valid(year, month, d)]
    total = 0.0
    uuids = [f"call-{year}{month:02d}-{i:04d}" for i in range(count)]
    for i in range(count):
        day = random.choice(days)
        start = epoch(year, month, day, random.randint(6, 21), random.randint(0, 59), random.randint(0, 59))
        answered = random.random() > 0.18
        answer_at = start + random.randint(2, 9) if answered else 0
        dur = random.randint(0, 1800) if answered else 0
        end_at = answer_at + dur if answered else start + random.randint(20, 40)
        bill = max(0, (dur + 29) // 30) * random.choice([0, 0, 1, 2, 5]) if answered else 0
        cents = round(bill * random.uniform(0.4, 1.6), 2)
        total += cents
        # ~1 in 6 rows is a second leg of an earlier primary call.
        bleg = uuids[random.randrange(i)] if i > 0 and random.random() < 1 / 6 else ""
        rows.append(
            (
                uuids[i],
                bleg,
                random.choice(["Alice", "Bob", "Carol", "", None]),
                random.choice(CALLERS),
                random.choice(DESTS),
                start,
                answer_at,
                end_at,
                dur,
                bill,
                "NORMAL_CLEARING" if answered else "NO_ANSWER",
                cents,
                1 if random.random() < 0.3 else 0,
                None,
            )
        )
    return rows, total


def _valid(y, m, d):
    try:
        import datetime

        datetime.date(y, m, d)
        return True
    except ValueError:
        return False


# Litestream's bookkeeping tables, present in any file it replicated
# while live (folio hides them from the table picker; babble strips
# them from the snapshot it ships).
LITESTREAM_DDL = """
CREATE TABLE _litestream_seq (id INTEGER PRIMARY KEY, seq INTEGER NOT NULL);
INSERT INTO _litestream_seq (id, seq) VALUES (1, 42);
CREATE TABLE _litestream_lock (id INTEGER PRIMARY KEY CHECK (id = 1));
INSERT INTO _litestream_lock (id) VALUES (1);
"""


def fill_month(db_path, year, month, count, long_transcription=False, litestream=False):
    if os.path.exists(db_path):
        os.remove(db_path)
    db = sqlite3.connect(db_path)
    db.execute("PRAGMA journal_mode=DELETE")
    db.executescript(CDR_DDL + QUALITY_DDL + TOTALS_DDL)
    if litestream:
        db.executescript(LITESTREAM_DDL)
    rows, total = make_cdr_rows(year, month, count)
    db.executemany(
        "INSERT INTO cdr VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)", rows
    )
    if long_transcription:
        # Long enough to spill onto overflow pages.
        db.execute(
            "UPDATE cdr SET transcription=? WHERE uuid=?",
            ("word " * 3000, rows[0][0]),
        )
    db.executemany(
        "INSERT INTO call_quality VALUES (?,?,?)",
        [(r[0], random.randint(1, 5), random.choice(["clear", "echo", None])) for r in rows[:: max(1, count // 5)]],
    )
    db.execute(
        "INSERT INTO monthly_totals (id, total_billed, row_count) VALUES (1, ?, ?)",
        (round(total, 2), len(rows)),
    )
    db.commit()
    db.close()


def main():
    os.makedirs(DEMO, exist_ok=True)

    # The demo pair: two monthly CDR files, March and April 2026.
    # March still carries litestream's bookkeeping tables (it was
    # live-replicated); April was stripped at close time.
    fill_month(
        os.path.join(DEMO, "calls-2026-03.db"), 2026, 3, 36,
        long_transcription=True, litestream=True,
    )
    fill_month(os.path.join(DEMO, "calls-2026-04.db"), 2026, 4, 48)

    # The same March file as the S3 archive stores it (gzipped), for
    # trying a direct archive download.
    import gzip

    with open(os.path.join(DEMO, "calls-2026-03.db"), "rb") as src, gzip.open(
        os.path.join(DEMO, "calls-2026-03.db.gz"), "wb", compresslevel=6
    ) as dst:
        dst.write(src.read())

    # Engine fixtures.
    fill_month(
        os.path.join(HERE, "cdr-like.db"), 2026, 3, 40,
        long_transcription=True, litestream=True,
    )

    # Enough rows to need interior b-tree pages.
    big = os.path.join(HERE, "big.db")
    if os.path.exists(big):
        os.remove(big)
    db = sqlite3.connect(big)
    db.execute("PRAGMA journal_mode=DELETE")
    db.execute("CREATE TABLE events (id INTEGER PRIMARY KEY, at INTEGER, label TEXT, amount REAL)")
    db.executemany(
        "INSERT INTO events VALUES (?,?,?,?)",
        [(i, epoch(2026, 1, 1) + i * 60, f"event-{i}", round(random.uniform(0, 100), 2)) for i in range(1, 2001)],
    )
    db.commit()
    db.close()

    # A UTF-16 encoded database.
    u16 = os.path.join(HERE, "utf16.db")
    if os.path.exists(u16):
        os.remove(u16)
    db = sqlite3.connect(u16)
    db.execute("PRAGMA encoding='UTF-16le'")
    db.execute("CREATE TABLE places (name TEXT, city TEXT, visits INTEGER)")
    db.executemany(
        "INSERT INTO places VALUES (?,?,?)",
        [("Ada", "Zürich", 3), ("Grace", "Москва", 1), ("Linus", "Helsinki", 7)],
    )
    db.commit()
    db.close()

    # A WAL-mode database, closed cleanly (checkpointed into the file).
    wal = os.path.join(HERE, "wal.db")
    for suffix in ("", "-wal", "-shm"):
        if os.path.exists(wal + suffix):
            os.remove(wal + suffix)
    db = sqlite3.connect(wal)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("CREATE TABLE readings (at INTEGER, temp REAL)")
    db.executemany(
        "INSERT INTO readings VALUES (?,?)",
        [(epoch(2026, 5, 1) + i * 3600, round(18 + random.uniform(-2, 2), 1)) for i in range(24)],
    )
    db.commit()
    db.close()

    # No tables at all.
    empty = os.path.join(HERE, "empty.db")
    if os.path.exists(empty):
        os.remove(empty)
    db = sqlite3.connect(empty)
    db.execute("PRAGMA journal_mode=DELETE")
    db.execute("CREATE TABLE t (x)")
    db.execute("DROP TABLE t")
    db.commit()
    db.close()

    # A WITHOUT ROWID table (unsupported: index b-tree storage).
    wor = os.path.join(HERE, "withoutrowid.db")
    if os.path.exists(wor):
        os.remove(wor)
    db = sqlite3.connect(wor)
    db.execute("PRAGMA journal_mode=DELETE")
    db.execute("CREATE TABLE kv (k TEXT PRIMARY KEY, v TEXT) WITHOUT ROWID")
    db.execute("INSERT INTO kv VALUES ('a','1')")
    db.commit()
    db.close()

    # Not a database at all.
    with open(os.path.join(HERE, "notdb.bin"), "wb") as fh:
        fh.write(b"this is just a text file, not a sqlite database\n" * 10)

    # A table with AUTOINCREMENT (creates sqlite_sequence, which the
    # reader must skip when listing tables).
    seq = os.path.join(HERE, "with-sequence.db")
    if os.path.exists(seq):
        os.remove(seq)
    db = sqlite3.connect(seq)
    db.execute("PRAGMA journal_mode=DELETE")
    db.execute("CREATE TABLE notes (id INTEGER PRIMARY KEY AUTOINCREMENT, note TEXT)")
    db.execute("CREATE TABLE plain (v TEXT)")
    db.executemany("INSERT INTO notes (note) VALUES (?)", [("one",), ("two",)])
    db.execute("INSERT INTO plain VALUES ('x')")
    db.commit()
    db.close()

    for name in sorted(os.listdir(HERE)):
        if name.endswith((".db", ".bin")):
            print(name, os.path.getsize(os.path.join(HERE, name)))
    for name in ("calls-2026-03.db", "calls-2026-04.db"):
        print(os.path.join("demo/data", name), os.path.getsize(os.path.join(DEMO, name)))


if __name__ == "__main__":
    main()

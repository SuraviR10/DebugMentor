import sqlite3
import os
import json

DB_FILE = 'tutor.db'

def get_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    c = conn.cursor()
    
    # Table to track user progression
    c.execute('''
        CREATE TABLE IF NOT EXISTS usage_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT,
            error_type TEXT,
            concept TEXT,
            code TEXT
        )
    ''')
    conn.commit()
    conn.close()

def log_compilation(status, error_type=None, concept=None, code=None):
    try:
        conn = get_connection()
        c = conn.cursor()
        c.execute('INSERT INTO usage_stats (status, error_type, concept, code) VALUES (?, ?, ?, ?)',
                  (status, error_type, concept, code))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error logging to DB: {e}")

def get_dashboard_stats():
    conn = get_connection()
    c = conn.cursor()
    
    c.execute('SELECT COUNT(*) as total_attempts FROM usage_stats')
    total_attempts = c.fetchone()['total_attempts']
    
    c.execute('SELECT COUNT(*) as successful_attempts FROM usage_stats WHERE status = "success"')
    success_attempts = c.fetchone()['successful_attempts']
    
    c.execute('''
        SELECT concept, COUNT(*) as count 
        FROM usage_stats 
        WHERE status = "error" AND concept IS NOT NULL 
        GROUP BY concept 
        ORDER BY count DESC
    ''')
    weak_concepts = [{'concept': row['concept'], 'count': row['count']} for row in c.fetchall()]
    
    conn.close()
    
    return {
        'total_attempts': total_attempts,
        'successful_attempts': success_attempts,
        'error_attempts': total_attempts - success_attempts,
        'weak_concepts': weak_concepts
    }

# Initialize database on module import
init_db()

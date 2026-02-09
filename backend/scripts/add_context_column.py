import sqlite3
import os

# Database path
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'transcriber.db')

def migrate():
    print(f"Migrating database at {DB_PATH}")
    
    if not os.path.exists(DB_PATH):
        print("Database not found!")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(conversations)")
        columns = [info[1] for info in cursor.fetchall()]
        
        if 'background_context' in columns:
            print("Column 'background_context' already exists.")
        else:
            print("Adding 'background_context' column...")
            cursor.execute("ALTER TABLE conversations ADD COLUMN background_context TEXT")
            conn.commit()
            print("Migration successful!")
            
    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()

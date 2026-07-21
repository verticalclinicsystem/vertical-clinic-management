import psycopg2

def run_migration():
    conn = psycopg2.connect("postgresql://clinic_user:1234@localhost:5432/clinic_db")
    cur = conn.cursor()
    try:
        print("Starting migration...")
        
        # Check if user_id column already exists
        cur.execute("""
            SELECT EXISTS (
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_name='availability_change_requests' AND column_name='user_id'
            );
        """)
        exists = cur.fetchone()[0]
        
        # Alter doctor_id to be nullable
        cur.execute("ALTER TABLE availability_change_requests ALTER COLUMN doctor_id DROP NOT NULL;")
        print("doctor_id column altered to nullable.")
        
        if not exists:
            # Add user_id column
            cur.execute("""
                ALTER TABLE availability_change_requests 
                ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
            """)
            print("user_id column added to availability_change_requests.")
        else:
            print("user_id column already exists.")
            
        conn.commit()
        print("Migration completed successfully!")
    except Exception as e:
        conn.rollback()
        print(f"Error executing migration: {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    run_migration()

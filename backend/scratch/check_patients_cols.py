import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect('postgresql://postgres:postgresuser@localhost:5432/clinic_db')
    rows = await conn.fetch("SELECT column_name FROM information_schema.columns WHERE table_name='patients'")
    cols = [r['column_name'] for r in rows]
    print("PATIENTS TABLE COLUMNS:", sorted(cols))
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())

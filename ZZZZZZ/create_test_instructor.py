from supabase import create_client, Client
import bcrypt
import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

username = "Admin"
password = "Admin123"
email = "jobertsalvador22@gmail.com"
full_name = "Admin"
role = "Admin"

hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

response = supabase.table("users").insert({
    "username": username,
    "password": hashed_pw,
    "email": email,
    "full_name": full_name,
    "role": role
}).execute()

print("Inserted:", response.data)
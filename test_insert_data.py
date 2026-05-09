#!/usr/bin/env python3
"""
Insert test learner data into Supabase for testing DSS
"""
import os
import sys
from datetime import datetime

# Configure environment
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import Supabase
from supabase import create_client, Client

# Supabase credentials (same as in ALS.py)
SUPABASE_URL = "https://goyaqojldxblrjomnuvi.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdveWFxb2psZHhibGxyam9tbnV2aSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzI3Njc0MzIyLCJleHAiOjE4ODU0NDAzMjJ9.w_U2F0HqeLLKq3xKnpSt5hPRnBj4OZhfVkqKRQhIpFY"

# Create Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Test data for Gatid barangay
test_data = [
    {
        "first_name": "Maria",
        "middle_name": "Santos",
        "last_name": "Rodriguez",
        "age": 22,
        "sex": "Female",
        "barangay": "Gatid",
        "status": "active",
        "at_risk": False,
        "grade_level": 85,
        "performance_score": 80,
        "enrollment_date": "2025-08-15"
    },
    {
        "first_name": "Juan",
        "middle_name": "Cruz",
        "last_name": "Gonzales",
        "age": 25,
        "sex": "Male",
        "barangay": "Gatid",
        "status": "active",
        "at_risk": False,
        "grade_level": 78,
        "performance_score": 75,
        "enrollment_date": "2025-09-01"
    },
    {
        "first_name": "Anna",
        "middle_name": "Marie",
        "last_name": "De La Cruz",
        "age": 20,
        "sex": "Female",
        "barangay": "Gatid",
        "status": "active",
        "at_risk": True,
        "grade_level": 65,
        "performance_score": 62,
        "enrollment_date": "2025-10-15"
    },
    {
        "first_name": "Pedro",
        "middle_name": "Jose",
        "last_name": "Reyes",
        "age": 23,
        "sex": "Male",
        "barangay": "Gatid",
        "status": "active",
        "at_risk": False,
        "grade_level": 88,
        "performance_score": 85,
        "enrollment_date": "2025-08-20"
    },
]

print(f"📍 Inserting {len(test_data)} test learners for Gatid barangay...")

try:
    for learner in test_data:
        response = supabase.table("als_enrollments").insert(learner).execute()
        name = f"{learner['first_name']} {learner['last_name']}"
        status_text = "✅ At-Risk" if learner['at_risk'] else "✅ Normal"
        print(f"  {status_text}: {name} (Grade: {learner['grade_level']})")
    
    print(f"\n✅ SUCCESS! Inserted {len(test_data)} learners for Gatid")
    print("\nNow test the DSS by:")
    print("1. Opening http://localhost:8000/instructor_mapping")
    print("2. Click the DSS button (bottom right)")
    print("3. Click on Gatid marker on the map")
    print("4. Check DSS analysis in the right panel")
    
except Exception as e:
    print(f"❌ Error inserting data: {str(e)}")
    sys.exit(1)

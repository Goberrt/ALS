#!/usr/bin/env python3
"""Check which barangays have data in als_af1 table"""
import os
from supabase import create_client

SUPABASE_URL = "https://goyaqojldxblrjomnuvi.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdveWFxb2psZHhibGxyam9tbnV2aSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzI3Njc0MzIyLCJleHAiOjE4ODU0NDAzMjJ9.w_U2F0HqeLLKq3xKnpSt5hPRnBj4OZhfVkqKRQhIpFY"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print("📊 CHECKING BARANGAY DATA IN als_af1\n")

# Get all barangays
barangays = [
    "Alipit", "Bagumbayan", "Barangay I (Poblacion)", "Barangay II (Poblacion)",
    "Barangay III (Poblacion)", "Barangay IV (Poblacion)", "Barangay V (Poblacion)",
    "Bubukal", "Calios", "Duhat", "Gatid", "Jasaan", "Labuin", "Malinao",
    "Oogong", "Pagsawitan", "Palasan", "Patimbao", "San Jose", "San Juan",
    "San Pablo Norte", "San Pablo Sur", "Santisima Cruz", "Santo Angel Central",
    "Santo Angel Norte", "Santo Angel Sur"
]

barangay_counts = {}

for barangay in barangays:
    response = supabase.table("als_af1").select("id", count="exact").eq("barangay", barangay).eq("archived", False).execute()
    count = response.count if hasattr(response, 'count') else len(response.data)
    barangay_counts[barangay] = count

# Sort by count descending
sorted_barangays = sorted(barangay_counts.items(), key=lambda x: x[1], reverse=True)

print(f"{'Barangay':<30} {'Learners':<10}")
print("-" * 40)
for barangay, count in sorted_barangays:
    if count > 0:
        print(f"{barangay:<30} {count:<10} ✅")
    else:
        print(f"{barangay:<30} {count:<10}")

total = sum(barangay_counts.values())
with_data = sum(1 for c in barangay_counts.values() if c > 0)

print("-" * 40)
print(f"Total Learners: {total}")
print(f"Barangays with data: {with_data}/26")

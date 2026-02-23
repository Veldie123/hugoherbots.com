#!/bin/bash

# Debug signup route
echo "🧪 Testing signup route..."

curl -X POST \
  https://pckctmojjrrgzuufsqoo.supabase.co/functions/v1/make-server-b9a572ea/auth/signup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -d '{
    "email": "debug@hugoherbots.test",
    "password": "DebugPassword123!",
    "firstName": "Debug",
    "lastName": "User"
  }' \
  -v

echo "\n\n✅ Check Supabase Edge Function logs for detailed error"

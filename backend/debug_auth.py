from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

response = client.post(
    "/api/auth/register",
    json={"phone_number": "test_user_3", "password": "abc", "name": "test"}
)

print(response.status_code)
print(response.text)

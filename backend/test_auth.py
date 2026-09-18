import urllib.request
import json
import urllib.error

req = urllib.request.Request(
    'http://127.0.0.1:8000/api/auth/register',
    data=json.dumps({'phone_number': '123', 'password': 'abc', 'name': 'test'}).encode(),
    headers={'Content-Type': 'application/json'},
    method='POST'
)

try:
    print(urllib.request.urlopen(req).read().decode())
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code)
    print(e.read().decode())

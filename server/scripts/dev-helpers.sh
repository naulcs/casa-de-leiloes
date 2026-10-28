# Atalhos para testar a API na mao. 
API=${API:-http://localhost:3000}
JSON='Content-Type: application/json'

token() { sed 's/.*"token":"\([^"]*\)".*/\1/'; }

login() {
  curl -s -X POST "$API/api/auth/login" -H "$JSON" \
    -d "{\"email\":\"$1\",\"password\":\"123456\"}" | token
}

reg() {
  local t
  t=$(curl -s -X POST "$API/api/auth/register" -H "$JSON" \
    -d "{\"name\":\"$1\",\"email\":\"$2\",\"password\":\"123456\",\"role\":\"$3\"}" | token)
  case "$t" in ey*) echo "$t" ;; *) login "$2" ;; esac
}

dep() {
  curl -s -X POST "$API/api/wallet/deposit" -H "$JSON" -H "Authorization: Bearer $1" \
    -d "{\"amount_cents\":$2}"; echo
}

lance() {
  curl -s -X POST "$API/api/lots/$1/bids" -H "$JSON" -H "Authorization: Bearer $2" \
    -d "{\"amount_cents\":$3}"; echo
}

criar_lote() {
  curl -s -X POST "$API/api/lots" -H "$JSON" -H "Authorization: Bearer $1" \
    -d "{\"external_id\":\"$2\",\"starting_bid_cents\":$3,\"min_increment_cents\":$4,\"ends_at\":\"$(date -u -d "+$5 minutes" +%Y-%m-%dT%H:%M:%SZ)\"}"; echo
}
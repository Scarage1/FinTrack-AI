const fs = require('fs');
let env = fs.readFileSync('/Users/shivamkumar/Documents/expense tracker/backend/.env', 'utf8');
env = env.replace('ML_BASE_URL=http://localhost:8000', 'ML_BASE_URL=http://localhost:8001');
fs.writeFileSync('/Users/shivamkumar/Documents/expense tracker/backend/.env', env);

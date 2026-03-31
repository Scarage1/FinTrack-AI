const fs = require('fs');
let reqs = fs.readFileSync('/Users/shivamkumar/Documents/expense tracker/ml-service/requirements.txt', 'utf8');
reqs = reqs.replace('numpy==2.3.2', 'numpy');
reqs = reqs.replace('scikit-learn==1.6.1', 'scikit-learn');
fs.writeFileSync('/Users/shivamkumar/Documents/expense tracker/ml-service/requirements.txt', reqs);

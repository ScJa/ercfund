require('babel-register');
require('babel-polyfill');

module.exports = {
   networks: {
   development: {
   host: "localhost",
   port: 8545,
   gas: 6712388,
   gasPrice: 65000000000,
   network_id: "*" // Match any network id
  }
 }
};


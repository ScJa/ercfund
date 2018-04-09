#!/usr/bin/env bash

SOLIDITY_COVERAGE=true scripts/test.sh
cat coverage/lcov.info | node_modules/coveralls/bin/coveralls.js

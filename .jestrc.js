const path = require('path')

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: path.resolve(__dirname, './coverage'),
  rootDir: 'src',
}

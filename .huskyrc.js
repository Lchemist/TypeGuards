module.exports = {
  hooks: {
    'pre-commit': 'lint-staged --verbose',
    'commit-msg': 'commitlint -E HUSKY_GIT_PARAMS',
  },
}

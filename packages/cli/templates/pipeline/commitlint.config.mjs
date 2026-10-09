export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Grouped dependency updates name their group in the title and run past 100.
    'header-max-length': [2, 'always', 140],
    'subject-case': [0],
  },
};

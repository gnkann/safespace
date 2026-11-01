/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  collectCoverageFrom: ['src/**/*.ts', '!src/server.ts'],
  coverageReporters: ['text', 'text-summary', 'lcov', 'json-summary'],
  // Поріг покриття (лаб. 6): CI падає, якщо покриття опускається нижче.
  coverageThreshold: { global: { statements: 85, branches: 70, functions: 85, lines: 85 } },
};

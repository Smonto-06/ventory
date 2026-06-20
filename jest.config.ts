import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  coverageProvider: 'v8',
  collectCoverageFrom: ['app/**/*.ts', 'app/**/*.tsx', 'lib/**/*.ts', '!**/*.d.ts'],
}

export default createJestConfig(config)

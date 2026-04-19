/**
 * Windows / macOS / Linux 에서 android/gradlew 를 동일하게 실행합니다.
 * 사용: node scripts/run-android-gradle.mjs bundleRelease
 */
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = join(__dirname, '..')
const androidDir = join(projectRoot, 'android')
const gradlew = process.platform === 'win32' ? 'gradlew.bat' : 'gradlew'
const task = process.argv[2] || 'bundleRelease'
const gradlewPath = join(androidDir, gradlew)

const result = spawnSync(gradlewPath, [task], {
  cwd: androidDir,
  stdio: 'inherit',
  shell: false,
})

process.exit(result.status === null ? 1 : result.status)

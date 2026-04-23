import { isStrongPassword } from './security'

function readEnvValue(key: string) {
  return process.env[key]?.trim() || ''
}

function requireStrongPasswordEnv(key: string, label: string) {
  const value = readEnvValue(key)
  if (!value) {
    throw new Error(`缺少环境变量 ${key}（${label}）`)
  }

  if (!isStrongPassword(value)) {
    throw new Error(`${key}（${label}）不符合密码策略：至少10位，且包含大小写字母和数字`)
  }

  return value
}

export function getStudentDefaultPassword() {
  return requireStrongPasswordEnv('SIS_DEFAULT_STUDENT_PASSWORD', '学生默认密码')
}

export function getAdminDefaultPassword() {
  return requireStrongPasswordEnv('SIS_DEFAULT_ADMIN_PASSWORD', '管理员默认密码')
}

export function getBootstrapSuperAdminPassword() {
  return requireStrongPasswordEnv('SIS_BOOTSTRAP_SUPERADMIN_PASSWORD', '初始超级管理员密码')
}

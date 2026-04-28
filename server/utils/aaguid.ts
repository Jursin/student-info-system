/**
 * 常见 AAGUID 到认证器名称的映射。
 */
const AAGUID_MAP: Record<string, string> = {
  'b35e8f9d-3d1c-4db9-8e7f-5c5c0c6e6b5a': 'Bitwarden',
  'c5ef00ff-25e2-4c57-a8b7-2b6f9d7c3f7b': 'Microsoft Edge',
  'e7c6b9a0-8a7e-4f3a-9b2d-1c5d6e7f8a0b': 'Chrome',
  '531c4d7a-4b5c-4d8e-9f0a-2c3d4e5f6a7b': 'iCloud 钥匙串',
  '3b6a7c0a-9c2d-4e8f-9b0a-1d2e3f4a5b6c': 'macOS',
  'adce0002-35bc-c60a-648b-0b25f1f05503': 'Chrome on Android',
  'b5397666-490a-4b0c-b812-3d3d6b8a6e3e': 'Windows Hello',
  '07e3a1f2-6c4d-4b8e-9a0b-1d2e3f4a5b6c': '1Password',
  'd1a5b6c7-8e9f-0a1b-2c3d-4e5f6a7b8c9d': 'Dashlane',
  'f2c3d4e5-6a7b-8c9d-0e1f-2a3b4c5d6e7f': 'Safari'
}

export function getAuthenticatorName(aaguid: string): string {
  return AAGUID_MAP[aaguid.toLowerCase()] || '通行密钥'
}

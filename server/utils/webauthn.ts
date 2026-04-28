/**
 * WebAuthn 挑战值存储。
 * 使用内存 Map，多实例或无服务器部署时应替换为数据库存储。
 */
export interface StoredChallenge {
  challenge: string
  userId?: string
  type: 'registration' | 'authentication'
  expiresAt: number
}

const challenges = new Map<string, StoredChallenge>()

const CHALLENGE_TTL_MS = 5 * 60 * 1000

// 定期清理过期挑战
setInterval(() => {
  const now = Date.now()
  for (const [key, val] of challenges) {
    if (val.expiresAt <= now) challenges.delete(key)
  }
}, 60_000)

export function storeChallenge(userId: string | undefined, challenge: string, type: 'registration' | 'authentication'): string {
  const id = challenge
  challenges.set(id, {
    challenge,
    userId,
    type,
    expiresAt: Date.now() + CHALLENGE_TTL_MS
  })
  return id
}

export function getAndDeleteChallenge(id: string, type: 'registration' | 'authentication'): StoredChallenge | null {
  const stored = challenges.get(id)
  if (!stored) return null
  challenges.delete(id)
  if (stored.expiresAt <= Date.now()) return null
  if (stored.type !== type) return null
  return stored
}

export function isTelegramUserAllowed(userId: string, allowedUsers: Set<string>) {
  return allowedUsers.has(userId);
}

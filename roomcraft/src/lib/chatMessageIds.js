export function nextChatMessageIdBase(messages = [], fallback = 10) {
  return messages.reduce((maxId, message) => {
    const id = Number(message?.id);
    return Number.isFinite(id) ? Math.max(maxId, id) : maxId;
  }, fallback);
}

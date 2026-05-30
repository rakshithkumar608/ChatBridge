export async function compressSession(session) {
    const msgs = session.messages;

    if (msg.length <= 10) return session; // No need to compress
    const head = msgs.slice(0, 3);
    const tail = msgs.slice(-5);
    const middle = msgs.slice(3, -5);


    const middleSummary = middle.map((m, i) => `[${m.role.toUpperCase()} ${i + 1}]: ${m.content.slice(0, 200)}${m.content.length > 200 ? '...' : ''}`).join('\n');

    const summaryMessage = {
        role: 'system',
        content: `[CONTEXT SUMMARY — ${middle.length} messages compressed]\n${middleSummary}`,
        isCompressed: true
    };

    return {
        ...session,
        messages: [...head, summaryMessage, ...tail],
        originalMessageCount: msgs.length,
        compressed: true
    };
}
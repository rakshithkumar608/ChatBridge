// context-compressor.js — Advanced Semantic-Hierarchical Version
// Replaces the naive head+tail+summarize approach with:
//   1. Semantic episode detection (topic boundary splitting)
//   2. Importance scoring (recency + decisions + code density)
//   3. Token-budget-aware per-episode compression
//   4. Progressive multi-pass compression for truly massive sessions

// ─── Context window limits per provider ────────────────────────────────────
const CONTEXT_LIMITS = {
    claude:     150000,
    chatgpt:    90000,
    gemini:     700000,
    groq:       24000,   // most restrictive
    deepseek:   55000,
    perplexity: 90000,
    mistral:    24000,
    grok:       90000,
    cohere:     90000,
    meta:       90000,
    copilot:    24000,
    poe:        24000
};

// ─── Token estimator (4 chars ≈ 1 token) ───────────────────────────────────
function estimateTokens(text) {
    return Math.ceil((text || '').length / 4);
}

// ─── Measure information density of a single message ───────────────────────
function informationDensity(text) {
    const hasCode      = (text.match(/```/g) || []).length / 2;          // code blocks
    const hasNumbers   = (text.match(/\d+/g) || []).length;              // numeric data
    const hasKeyTerms  = (text.match(
        /\b(error|fix|solution|result|output|returns|throws|important|note|warning|decided|conclusion|final|agreed|confirmed)\b/gi
    ) || []).length;
    const lengthScore  = Math.min(text.length / 500, 1);                 // normalized length

    return hasCode * 3 + hasNumbers * 0.5 + hasKeyTerms * 2 + lengthScore;
}

// ─── Split conversation into semantic episodes ──────────────────────────────
function detectEpisodes(msgs) {
    const episodes = [];
    let current = [];

    msgs.forEach((msg, i) => {
        current.push(msg);

        const isTopicShift = (
            /^(now let['']?s|next|moving on|let['']?s switch|different topic|another question)/i
                .test(msg.content) ||
            /^(by the way|also|separately|unrelated to|one more thing)/i
                .test(msg.content)
        );

        const isEpisodeBoundary = (
            isTopicShift ||
            current.length >= 12 ||
            i === msgs.length - 1
        );

        if (isEpisodeBoundary) {
            episodes.push([...current]);
            current = [];
        }
    });

    // Flush any remaining messages
    if (current.length) episodes.push(current);

    return episodes;
}

// ─── Score episodes by importance ──────────────────────────────────────────
function scoreEpisodes(episodes) {
    return episodes.map((episode, index) => {
        const recencyScore = episodes.length > 1
            ? index / (episodes.length - 1)  // 0 = oldest, 1 = newest
            : 1;

        const decisionScore = episode.filter(m =>
            /\b(decided|conclusion|final|agreed|confirmed|result|solution|answer)\b/i
                .test(m.content)
        ).length / episode.length;

        const codeScore = episode.filter(m =>
            m.content.includes('```')
        ).length / episode.length;

        const importanceScore = (
            recencyScore   * 0.5 +
            decisionScore  * 0.3 +
            codeScore      * 0.2
        );

        return { episode, importanceScore, index };
    });
}

// ─── Allocate token budget proportionally across episodes ──────────────────
function buildTokenBudget(scoredEpisodes, totalLimit) {
    const usableLimit  = Math.floor(totalLimit * 0.65); // reserve 35% for the live prompt
    const totalScore   = scoredEpisodes.reduce((s, e) => s + e.importanceScore, 0) || 1;

    return scoredEpisodes.map(({ episode, importanceScore, index }) => ({
        episode,
        index,
        tokenAllocation: Math.floor(
            (importanceScore / totalScore) * usableLimit
        )
    }));
}

// ─── Select high-value messages to fit a token budget ──────────────────────
function extractKeyMessages(episode, tokenBudget) {
    if (episode.length <= 2) return episode;

    const head   = episode[0];
    const tail   = episode[episode.length - 1];
    const middle = episode.slice(1, -1);

    // Score middle messages by information density
    const scored = middle
        .map(msg => ({ msg, score: informationDensity(msg.content) }))
        .sort((a, b) => b.score - a.score);

    // Greedily fill the budget
    let used = estimateTokens(head.content) + estimateTokens(tail.content);
    const selected = [head];

    for (const { msg } of scored) {
        const t = estimateTokens(msg.content);
        if (used + t <= tokenBudget) {
            selected.push(msg);
            used += t;
        }
    }

    selected.push(tail);

    // Restore original order
    return selected.sort(
        (a, b) => episode.indexOf(a) - episode.indexOf(b)
    );
}

// ─── Compress a single episode to fit its allocated token budget ────────────
function compressEpisode(episode, tokenBudget) {
    const totalText    = episode.map(m => m.content).join(' ');
    const currentTokens = estimateTokens(totalText);

    if (currentTokens <= tokenBudget) return episode; // already fits

    return extractKeyMessages(episode, tokenBudget);
}

// ─── Main: Advanced semantic-hierarchical compression ──────────────────────
export async function advancedCompress(session, targetProvider = 'groq') {
    const msgs  = session.messages;
    const limit = CONTEXT_LIMITS[targetProvider] || 24000;

    // Step 1 — detect semantic episodes
    const episodes   = detectEpisodes(msgs);

    // Step 2 — score each episode
    const scored     = scoreEpisodes(episodes);

    // Step 3 — allocate token budgets
    const budgeted   = buildTokenBudget(scored, limit);

    // Step 4 — compress each episode within its budget
    const compressed = budgeted.map(({ episode, tokenAllocation }) =>
        compressEpisode(episode, tokenAllocation)
    );

    return {
        ...session,
        messages: compressed.flat(),
        compressionMetadata: {
            originalCount:  msgs.length,
            compressedCount: compressed.flat().length,
            episodeCount:   episodes.length,
            strategy:       'semantic-hierarchical',
            targetProvider
        },
        compressed: true,
        originalMessageCount: msgs.length
    };
}

// ─── Progressive multi-pass compression (for 100+ message conversations) ───
export async function progressiveSummarize(session, targetProvider = 'groq') {
    const limit      = CONTEXT_LIMITS[targetProvider] || 24000;
    let   current    = session;
    let   passes     = 0;
    const MAX_PASSES = 3;

    const totalTokens = () =>
        estimateTokens(current.messages.map(m => m.content).join(' '));

    while (totalTokens() > limit && passes < MAX_PASSES) {
        current = await advancedCompress(current, targetProvider);
        passes++;
        console.log(
            `ChatBridge [compressor]: pass ${passes} — ` +
            `${current.messages.length} messages, ~${totalTokens()} tokens`
        );
    }

    return current;
}

// ─── Backwards-compatible entry point (used by service-worker.js) ──────────
// Falls back to semantic compression even when no provider is known.
export async function compressSession(session, targetProvider) {
    const provider = targetProvider || 'groq'; // groq = most restrictive = safest default
    return progressiveSummarize(session, provider);
}
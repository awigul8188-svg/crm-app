const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { authenticate } = require('../middleware/auth');
const { buildSystemPrompt } = require('../assistantHelp');

// Haiku 4.5 — fast + cheap, ideal for a how-to help bot (owner's choice).
// Override via ANTHROPIC_MODEL (e.g. claude-opus-4-8) for higher-quality answers.
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';
const MAX_TURNS = 12;        // keep the last N messages — a help chat doesn't need deep history
const MAX_CHARS = 4000;      // per-message guard

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  return client;
}

// GET /api/assistant/status — lets the UI hide the launcher until a key is configured.
router.get('/status', authenticate, (req, res) => {
  res.json({ configured: !!getClient() });
});

// POST /api/assistant/ask  { messages: [{role:'user'|'assistant', content}] }
router.post('/ask', authenticate, async (req, res) => {
  const c = getClient();
  if (!c) return res.status(503).json({ error: 'The AI help assistant isn’t set up yet. Ask an admin to add an ANTHROPIC_API_KEY.' });

  try {
    const raw = Array.isArray(req.body?.messages) ? req.body.messages : [];
    // Sanitize: only user/assistant text turns, trimmed, length-capped, last MAX_TURNS.
    const messages = raw
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .slice(-MAX_TURNS)
      .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
    if (!messages.length || messages[messages.length - 1].role !== 'user') {
      return res.status(400).json({ error: 'A question is required.' });
    }

    const resp = await c.messages.create({
      model: MODEL,
      max_tokens: 1024,
      // Cache the (large, stable) help prompt so repeat questions are cheaper.
      system: [{ type: 'text', text: buildSystemPrompt(req.user.role), cache_control: { type: 'ephemeral' } }],
      messages,
    });

    const answer = (resp.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    res.json({ answer: answer || 'Sorry, I couldn’t come up with an answer for that.' });
  } catch (e) {
    console.error('assistant/ask error:', e.message);
    res.status(500).json({ error: 'The assistant ran into a problem. Please try again.' });
  }
});

module.exports = router;

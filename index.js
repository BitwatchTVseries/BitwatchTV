// index.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/* -----------------------
   Knowledge base (updated)
   ----------------------- */
const knowledge = {
  "ways to earn": `🔥 WAYS TO EARN (BitWatchTV)
1) Level 1 — 2 USDT
2) Level 2–5 — 1 USDT each
3) Rank Bonuses (BM/CB/MV)
4) BTW Token rewards & watching incentives
Type which area you want details for (eg. "packages" or "ranks").`,
  "packages": `🟦 STARTER MINER (SM) — 20 USDT
Includes: 25 codes (Potential value: 25 × ₱100 = ₱2,500).
Activates Level 1–5 earning.`,
  "starter miner": `🟦 STARTER MINER (SM) — 20 USDT
• 25 codes
• Value: 25 × ₱100 = ₱2,500
• Unlocks Level 1–5`,
  "ranks": `🏆 RANKS & REQUIREMENTS
SM — Starter Miner (buy)
BM — Block Miner (Req: 30 direct SM) — +1 USDT per Starter (infinity)
CB — Chain Builder (Req: 25 direct BM) — +2 USDT per Starter (infinity)
MV — Master Validator (Req: 20 direct CB) — +3 USDT per Starter (infinity)
GV — Genesis Validator (Investor) — Min 200 USDT, up to 5% monthly bonus, 300 codes`,
  "block miner": `🟩 BLOCK MINER (BM): Requirement — 30 direct Starter (SM). Earnings: +1 USDT per Starter (infinity).`,
  "chain builder": `🟧 CHAIN BUILDER (CB): Requirement — 25 direct Block Miner (BM). Earnings: +2 USDT per Starter (infinity).`,
  "master validator": `🟥 MASTER VALIDATOR (MV): Requirement — 20 direct Chain Builder (CB). Earnings: +3 USDT per Starter (infinity).`,
  "genesis validator": `👑 GENESIS VALIDATOR (GV): Investor Rank.
Benefits: Up to 5% monthly bonus, 300 codes (₱30,000 value), Minimum capital share: 200 USDT.`,
  "token": `🪙 BTW TOKEN (utility token)
Used for rewards, staking, ecosystem perks, unlocking premium content, and special promos.`,
  "investor program": `👑 INVESTOR / GENESIS VALIDATOR
Minimum Capital: 200 USDT
Monthly Bonus: Up to 5%
Includes 300 codes and premium access.`,
  "how to register": `📝 HOW TO REGISTER
1) Get referral link
2) Create account
3) Activate Starter (20 USDT)
4) Receive 25 codes
5) Start watching & earning`,
  "withdrawal": `💸 WITHDRAWAL
Withdrawals are in USDT or token conversions. Minimum depends on system; usually processed quickly (minutes to hours depending on network).`,
  "default": `Pasensya, hindi ko pa naintindihan nang buo. Pwede mong subukan: "ways to earn", "packages", "ranks", "BTW token", "how to register", o "investor program".`
};

/* -----------------------
   Utility: Send API call
   ----------------------- */
async function callSendAPI(senderPsid, response) {
  try {
    await axios.post(`https://graph.facebook.com/v16.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      recipient: { id: senderPsid },
      message: response
    });
  } catch (err) {
    console.error('Error sending message:', err.response ? err.response.data : err.message);
  }
}

/* -----------------------
   Helper: send typing_on and off
   ----------------------- */
async function sendTyping(senderPsid, on = true) {
  try {
    await axios.post(`https://graph.facebook.com/v16.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      recipient: { id: senderPsid },
      sender_action: on ? "typing_on" : "typing_off"
    });
  } catch (err) {
    console.error('Typing error:', err.response ? err.response.data : err.message);
  }
}

/* -----------------------
   Send structured messages
   ----------------------- */
async function sendMainMenu(senderPsid) {
  const response = {
    attachment: {
      type: "template",
      payload: {
        template_type: "button",
        text: "Welcome to BitWatchTV! Pumili ng option:",
        buttons: [
          { type: "postback", title: "🎁 Ways to Earn", payload: "MENU_WAYS" },
          { type: "postback", title: "🧱 Ranks", payload: "MENU_RANKS" },
          { type: "postback", title: "🎟 Packages", payload: "MENU_PACKAGES" }
        ]
      }
    }
  };
  await callSendAPI(senderPsid, response);
}

/* -----------------------
   Webhook verification
   ----------------------- */
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      return res.status(200).send(challenge);
    } else {
      return res.sendStatus(403);
    }
  }
  res.sendStatus(400);
});

/* -----------------------
   Webhook receiver (messages & postbacks)
   ----------------------- */
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'page') {
    for (const entry of body.entry) {
      const webhookEvent = entry.messaging[0];
      const senderPsid = webhookEvent.sender.id;

      // messages
      if (webhookEvent.message) {
        if (webhookEvent.message.quick_reply) {
          // handle quick replies
          await handlePostback(senderPsid, webhookEvent.message.quick_reply.payload);
        } else if (webhookEvent.message.text) {
          await handleMessage(senderPsid, webhookEvent.message.text);
        } else {
          // attachments or others
          await callSendAPI(senderPsid, { text: "Thanks — natanggap ko ang message. Paki-type ang tanong mo tungkol sa BitWatchTV." });
        }
      } else if (webhookEvent.postback) {
        await handlePostback(senderPsid, webhookEvent.postback.payload);
      }
    }

    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

/* -----------------------
   Core message handler
   ----------------------- */
async function handleMessage(senderPsid, receivedText) {
  // show typing
  await sendTyping(senderPsid, true);

  // generate reply using knowledge matching (simple semantic)
  const reply = generateAIResponse(receivedText);

  // small delay to feel natural
  await new Promise(r => setTimeout(r, 700));
  await sendTyping(senderPsid, false);

  // send plain text reply
  await callSendAPI(senderPsid, { text: reply });

  // after reply, show quick menu
  const quick = {
    text: "Puwede ka ring pumili:",
    quick_replies: [
      { content_type: "text", title: "Ways to Earn", payload: "MENU_WAYS" },
      { content_type: "text", title: "Packages", payload: "MENU_PACKAGES" },
      { content_type: "text", title: "BTW Token", payload: "MENU_TOKEN" }
    ]
  };
  await callSendAPI(senderPsid, quick);
}

/* -----------------------
   Postback / Menu handler
   ----------------------- */
async function handlePostback(senderPsid, payload) {
  await sendTyping(senderPsid, true);
  await new Promise(r => setTimeout(r, 500));
  await sendTyping(senderPsid, false);

  switch (payload) {
    case 'GET_STARTED':
      await callSendAPI(senderPsid, { text: "Hello! Welcome to BitWatchTV. I can help with Ways to Earn, Ranks, Packages, BTW Token, Investor program, and registration. Type any question or choose a menu." });
      await sendMainMenu(senderPsid);
      break;

    case 'MENU_WAYS':
      await callSendAPI(senderPsid, { text: knowledge['ways to earn'] });
      break;

    case 'MENU_PACKAGES':
      await callSendAPI(senderPsid, { text: knowledge['packages'] });
      break;

    case 'MENU_RANKS':
      await callSendAPI(senderPsid, { text: knowledge['ranks'] });
      break;

    case 'MENU_TOKEN':
      await callSendAPI(senderPsid, { text: knowledge['token'] });
      break;

    case 'MENU_INVESTOR':
      await callSendAPI(senderPsid, { text: knowledge['investor program'] });
      break;

    default:
      // if payload matches a knowledge key
      const key = payload.toLowerCase();
      if (knowledge[key]) {
        await callSendAPI(senderPsid, { text: knowledge[key] });
      } else {
        await callSendAPI(senderPsid, { text: knowledge['default'] });
        await sendMainMenu(senderPsid);
      }
  }
}

/* -----------------------
   Simple AI response: match keywords to knowledge
   ----------------------- */
function generateAIResponse(text) {
  const q = text.toLowerCase();

  // direct keyword mapping
  const keys = Object.keys(knowledge);
  for (const k of keys) {
    if (q.includes(k)) return knowledge[k];
  }

  // some fuzzy rules
  if (q.includes('how to') || q.includes('paano')) {
    if (q.includes('register') || q.includes('join')) return knowledge['how to register'];
    if (q.includes('withdraw')) return knowledge['withdrawal'];
  }
  if (q.includes('invest') || q.includes('investor') || q.includes('gv')) return knowledge['investor program'];
  if (q.includes('token') || q.includes('btw')) return knowledge['token'];

  // default fallback
  return knowledge['default'];
}

/* -----------------------
   Start server
   ----------------------- */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

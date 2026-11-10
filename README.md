# AI GIF Maker n8n workflow: text to GIF from a form

Turn text into animated GIFs with AI GIF Maker. Native GIF generation — no video conversion. Type what you want and download your GIF in about a minute.

This repository holds a ready-to-import [n8n](https://n8n.io) workflow for [AI GIF Maker](https://aigifmaker.ai/?utm_source=n8n&utm_medium=workflow): someone types a prompt into an n8n form, the workflow asks AI GIF Maker for the GIF, waits for it, and opens the finished `.gif` in the same browser tab.

```
Form (prompt) → Start GIF → Accepted? → Wait 10s → Check status → ready:  open the GIF
                               │                       ↑     │      failed: explain why
                               └→ explain refusal      └─────┘ still making: wait again
```

## Import

1. In n8n: **Workflows → Import from file**, pick [`aigifmaker-text-to-gif-form.json`](aigifmaker-text-to-gif-form.json).
2. Create an API key at https://aigifmaker.ai/settings/apikeys.
3. Add a **Header Auth** credential: name `Authorization`, value `Bearer sk-...`. Select it in **Start GIF** and **Check status**.
4. Activate the workflow and open the form URL from the trigger node.

## What each step does

| Node | Call |
|---|---|
| Start GIF | `POST https://aigifmaker.ai/api/ai/generate` with `{"provider":"openlux","mediaType":"image","model":"gif-maker-v1","scene":"text-to-image","prompt":"…","options":{"output_format":"gif"}}` |
| Check status | `POST https://aigifmaker.ai/api/ai/query` with `{"taskId":"<id from Start GIF>"}`, every 10 seconds |
| Route by status | `success` → the GIF URL is `data.images[0]`; `failed` / `canceled` → message; anything else waits again |

The API always answers HTTP 200; the JSON `code` says whether it worked (`0` = ok). The workflow turns refusals into a plain message on the form: a missing or wrong key, an empty balance, or a prompt the content filter refused.

## Cost

Each GIF costs 1 credit on your AI GIF Maker account, the same as on the website. New accounts get one free GIF (it carries a small aigifmaker.ai badge). Credit packs are on the [pricing](https://aigifmaker.ai/pricing?utm_source=n8n&utm_medium=workflow) page. A failed generation refunds its credit.

## Change it

- Swap the form trigger for Telegram, Slack or Discord triggers and post `data.images[0]` back as the reply.
- Add an HTTP Request node after **Route by status → ready** with response format *File* to download the GIF bytes.

`test/expressions.test.mjs` checks the workflow's expressions against the API's response shapes (`node --test test/`).

Questions: support@aigifmaker.ai. MIT licensed.

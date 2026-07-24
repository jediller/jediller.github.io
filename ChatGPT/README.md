# ChatGPT Daily Browser

This directory is the ChatGPT-managed counterpart to `gemini/`.

The public reader is:

`https://jediller.github.io/ChatGPT/web/DailyBrowser.html`

## Directory contract

- `query/` contains the source prompts for scheduled ChatGPT tasks.
- `result/` contains the current generated reports.
- `history/<weekday>/` contains the seven rotating historical copies.
- `web/` contains the static Daily Browser application.

The first version copies the existing Gemini report and history files as
bootstrap data. Those reports retain their original Gemini attribution.
Scheduled ChatGPT tasks can replace files in `result/` and rotate prior results
through `history/`; no Gemini command-line binaries are included here.

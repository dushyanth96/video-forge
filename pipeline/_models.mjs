// _models.mjs — the single list of Gemini models used by the whole pipeline, in preference order.
// It lives apart because Google retires and renames models often: when one dies it answers 404 and the
// scripts fall to the next on the list. Change the model in one place instead of 20 files.
export const TEXT_MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.5-flash-lite", "gemini-2.5-pro"];

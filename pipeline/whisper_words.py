#!/usr/bin/env python3
# whisper_words.py — saca the timestamp EXACTO of cada palabra of the audio (for the karaoke).
# Uses faster-whisper (CPU, free). Output: JSON [{word,start,end}].
# Uso: python pipeline/whisper_words.py <audio.mp3> <words.json>
import json
import sys

audio, out = sys.argv[1], sys.argv[2]

from faster_whisper import WhisperModel

# "base" = buen balance for voice TTS clara; int8 = fast in CPU.
model = WhisperModel("base", device="cpu", compute_type="int8")
segments, info = model.transcribe(audio, language="en", word_timestamps=True)

words = []
for seg in segments:
    for w in (seg.words or []):
        t = (w.word or "").strip()
        if not t:
            continue
        words.append({"word": t, "start": round(float(w.start), 3), "end": round(float(w.end), 3)})

json.dump(words, open(out, "w", encoding="utf-8"))
print(f"whisper: {len(words)} palabras con timestamp")

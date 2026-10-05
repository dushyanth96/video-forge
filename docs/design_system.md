# SkillGrox — HyperFrames Video Design System

**Version:** 1.0  
**Platform:** SkillGrox  
**Primary use:** Automated short-form educational videos, Instagram Reels, YouTube Shorts, TikTok  
**Canvas:** 1080 × 1920 px  
**Aspect Ratio:** 9:16  
**Design Direction:** Bold, intelligent, modern, high-retention, minimal, editorial

---

## 1. Design Philosophy

SkillGrox videos should feel:

- Bold
- Fast
- Intelligent
- Modern
- Premium
- Human
- Easy to read on mobile
- Optimized for short-form attention

The design must prioritize **clarity and retention over decoration**.

Do not overload the screen with:

- Multiple font styles
- Excessive colors
- Decorative graphics
- Complex backgrounds
- Long paragraphs
- Unnecessary animations
- More than one primary visual focus

Every frame should have an obvious visual hierarchy.

### Core principle

> **One frame = one idea.**

The viewer should understand the purpose of the frame within approximately 0.5 seconds.

---

# 2. Brand Typography

SkillGrox uses exactly three primary fonts.

## Font 1 — League Spartan ExtraBold

**Primary role:** Attention and emphasis.

Use for:

- Hooks
- Big statements
- Numbers
- Strong claims
- Main headlines
- Section transitions
- Important conclusions
- High-impact keywords when they need maximum visual weight

### Characteristics

- Heavy
- Geometric
- Strong
- Highly readable
- Designed to stop scrolling

### Default styling

```text
Font: League Spartan ExtraBold
Weight: 800
Case: Sentence Case or UPPERCASE
Color: SkillGrox Orange
```

Avoid using League Spartan ExtraBold for:

- Long sentences
- Paragraphs
- Captions
- Explanations
- Secondary information

---

# 3. Font 2 — Alex Brush

**Primary role:** Human/emotional emphasis.

Use for:

- Important keyword highlights
- Emotional words
- Memorable phrases
- Concept emphasis
- Static title cards
- CTA cards
- Signature-style words

Alex Brush should feel like a **visual highlight**, not the primary reading font.

### Timing rule

Any Alex Brush keyword must remain visible for:

**Minimum: 1.2 seconds**

Preferred duration:

**1.2–2.5 seconds**

Do not flash Alex Brush words for less than 1.2 seconds.

### Default styling

```text
Font: Alex Brush
Weight: Regular
Size: Large
Color: High-contrast white or orange
```

Use Alex Brush sparingly.

### Important rule

Never use Alex Brush for:

- Full paragraphs
- Captions
- Long sentences
- Rapid subtitles
- Dense information

---

# 4. Font 3 — Inter Regular

**Primary role:** Information and readability.

Use for:

- Captions
- Subtitles
- Explanations
- Supporting text
- Context
- Small labels
- UI-like information
- Secondary statements
- Fast-read text

### Default styling

```text
Font: Inter
Weight: 400
Color: White
```

Inter is the default font whenever another font has not been explicitly specified.

---

# 5. Typography Hierarchy

The visual hierarchy should follow:

```text
LEVEL 1
League Spartan ExtraBold
BIGGEST
Hook / Main statement

        ↓

LEVEL 2
Alex Brush
Large
Keyword / emotional emphasis

        ↓

LEVEL 3
Inter Regular
Medium
Supporting explanation

        ↓

LEVEL 4
Inter Regular
Small
Metadata / secondary information
```

Never allow Level 3 or Level 4 text to visually compete with Level 1.

---

# 6. Font Size System

Canvas:

```text
1080 × 1920
```

Recommended sizes:

### Hook

```text
League Spartan ExtraBold
84–120 px
```

Default:

```text
100 px
```

### Big statement

```text
League Spartan ExtraBold
72–108 px
```

Default:

```text
88 px
```

### Alex Brush keyword

```text
Alex Brush
90–135 px
```

Default:

```text
110 px
```

### Captions

```text
Inter Regular
42–56 px
```

Default:

```text
48 px
```

### Supporting text

```text
Inter Regular
34–44 px
```

Default:

```text
40 px
```

### Metadata

```text
Inter Regular
28–34 px
```

Default:

```text
30 px
```

Avoid text smaller than:

```text
28 px
```

unless absolutely necessary.

---

# 7. Brand Colors

## Primary Orange

```text
#FF6B00
```

Use for:

- Hooks
- Important words
- Numbers
- Key statements
- Progress indicators
- Accent elements

---

## Primary Background

```text
#0B0B0B
```

Use as the default background.

---

## Secondary Background

```text
#111111
```

Use for:

- Cards
- Panels
- Secondary scenes
- CTA backgrounds

---

## Primary White

```text
#FFFFFF
```

Use for:

- Captions
- Supporting text
- Main information
- High-contrast keywords

---

## Secondary Text

```text
#B8B8B8
```

Use for:

- Secondary information
- Metadata
- Supporting labels

---

## Muted Text

```text
#777777
```

Use sparingly.

Never use muted text for important information.

---

# 8. Color Rules

Default color hierarchy:

```text
IMPORTANT
→ Orange

PRIMARY INFORMATION
→ White

SECONDARY INFORMATION
→ Light Gray

LOW PRIORITY
→ Muted Gray
```

### Orange usage

Orange should represent **importance**.

Do not make entire screens orange.

Do not use orange for:

- Every caption
- Every word
- Entire paragraphs
- Backgrounds unless specifically required

### Recommended ratio

Approximately:

```text
70% Black / dark background
20% White
10% Orange
```

The exact ratio may vary depending on the scene.

---

# 9. Backgrounds

Default background:

```text
#0B0B0B
```

Backgrounds should remain visually quiet.

Preferred:

- Solid black
- Dark gradient
- Subtle texture
- Dark cinematic footage
- Darkened stock footage
- Soft blur
- Minimal abstract motion

Avoid:

- Bright distracting backgrounds
- Busy patterns
- Excessive gradients
- High-saturation backgrounds
- Background elements competing with typography

---

# 10. Video Background Treatment

When using footage behind text:

Apply a dark overlay.

Recommended:

```text
Black overlay: 35–60%
```

For highly detailed footage:

```text
50–70%
```

Text must remain readable without requiring the viewer to focus.

---

# 11. Safe Area

All critical text must remain inside the central safe area.

Canvas:

```text
1080 × 1920
```

Recommended horizontal margins:

```text
Left: 80 px
Right: 80 px
```

Recommended top margin:

```text
120 px
```

Recommended bottom margin:

```text
250–320 px
```

The bottom area must remain relatively clear because platform UI may overlap it.

### Never place important text:

- Against the extreme edges
- Directly at the bottom
- Under platform UI regions
- Too close to the top edge

---

# 12. Text Width

Text should not span the entire screen.

Maximum recommended text width:

```text
880 px
```

Preferred:

```text
760–850 px
```

This improves readability and creates stronger visual hierarchy.

---

# 13. Line Length

Avoid extremely long lines.

Preferred:

```text
4–8 words per line
```

Maximum:

```text
10–11 words per line
```

If a sentence is too long, break it into multiple lines.

Example:

```text
YOU DON'T NEED
MORE MOTIVATION.

YOU NEED
A SYSTEM.
```

This is preferable to:

```text
YOU DON'T NEED MORE MOTIVATION YOU NEED A SYSTEM.
```

---

# 14. Text Alignment

Default:

```text
Left aligned
```

Use centered alignment for:

- Major hooks
- Final statements
- CTA cards
- Static title cards

Avoid excessive center alignment throughout the video.

### Default composition

```text
[visual space]

HOOK
Supporting text

[visual/content area]

                    accent
```

---

# 15. Hook Design

The first 1–2 seconds are critical.

The hook must immediately communicate:

- Curiosity
- Value
- Conflict
- Surprise
- Strong claim
- Problem
- Question

### Hook font

```text
League Spartan ExtraBold
```

### Hook color

Default:

```text
#FF6B00
```

Supporting words:

```text
#FFFFFF
```

### Example

```text
YOU'RE NOT
LAZY.

YOU'RE
OVERLOADED.
```

Orange should emphasize the strongest phrase rather than every word.

---

# 16. Keyword Highlight System

Important keywords may use Alex Brush.

Example:

```text
Your biggest problem
isn't discipline.

It's
CONSISTENCY.
```

Recommended visual treatment:

```text
"CONSISTENCY"
→ Alex Brush
→ 110 px
→ White or Orange
→ Minimum 1.2 seconds
```

### Keyword rules

Only highlight keywords that:

1. Carry the main meaning
2. Improve retention
3. Deserve emotional emphasis
4. Can stand visually on their own

Do not highlight every keyword.

Maximum recommended highlighted keywords:

```text
1–2 per scene
```

---

# 17. Caption System

Captions use:

```text
Inter Regular
48 px
#FFFFFF
```

Recommended:

```text
2–7 words per caption chunk
```

Captions should appear in sync with speech.

Avoid displaying an entire spoken sentence at once.

### Example

Instead of:

```text
Most people don't fail because they lack talent,
they fail because they quit before compounding starts.
```

Use:

```text
Most people
don't fail...

because they quit

before
compounding starts.
```

---

# 18. Caption Highlighting

Important spoken words may change color.

Default:

```text
Normal → White
Important → Orange
```

Do not change fonts randomly inside captions.

Captions remain:

```text
Inter Regular
```

unless the word is intentionally promoted to a major visual keyword.

---

# 19. Animation Philosophy

Animation must support attention, not become the content.

Preferred animation:

- Fade
- Slide
- Scale
- Slight upward movement
- Word reveal
- Mask reveal
- Subtle zoom
- Kinetic typography

Avoid:

- Excessive bouncing
- Random rotations
- Glitch effects everywhere
- Spinning text
- Large elastic effects
- Multiple simultaneous transitions

---

# 20. Hook Animation

Recommended sequence:

```text
0.00s
Background appears

0.05–0.15s
Main hook enters

0.15–0.35s
Supporting word/line appears

0.35–1.50s
Hook remains stable
```

Animation should be fast.

Recommended entrance duration:

```text
150–350 ms
```

---

# 21. Alex Brush Animation

Alex Brush should feel more organic than League Spartan.

Preferred:

```text
Fade + slight upward movement
```

Duration:

```text
250–500 ms
```

Do not use aggressive kinetic effects.

The word should settle and remain readable for:

```text
≥ 1.2 seconds
```

---

# 22. Caption Animation

Use subtle motion.

Recommended:

```text
Fade in
150–250 ms
```

or:

```text
Short upward slide
150–250 ms
```

Captions should never distract from speech.

---

# 23. Scene Transitions

Default transition:

```text
Hard cut
```

Alternative:

```text
Short fade
100–250 ms
```

Use hard cuts for:

- Fast educational content
- Strong statements
- Punchlines
- Contrasts

Use fades for:

- Emotional moments
- Section transitions
- Outro

---

# 24. Scene Duration

Default scene duration:

```text
1–4 seconds
```

Very short scenes:

```text
0.5–1.5 seconds
```

should contain only simple information.

Longer scenes:

```text
4–7 seconds
```

may contain:

- Explanation
- Supporting visuals
- Multiple caption chunks

Avoid keeping a static frame unchanged for too long.

---

# 25. Static Title Card

Static title cards use:

### Primary

```text
League Spartan ExtraBold
```

### Keyword

```text
Alex Brush
```

### Supporting text

```text
Inter Regular
```

Example:

```text
THE
PSYCHOLOGY
OF

DISCIPLINE
```

Where:

```text
THE PSYCHOLOGY OF
→ League Spartan ExtraBold

DISCIPLINE
→ Alex Brush
```

---

# 26. CTA Card

CTA cards should be simple.

Use:

```text
League Spartan ExtraBold
```

for the main CTA.

Use:

```text
Alex Brush
```

for one emotional/highlight word.

Use:

```text
Inter Regular
```

for supporting information.

Example:

```text
BUILD
BETTER
HABITS.

START
TODAY.
```

Possible CTA:

```text
FOLLOW FOR
MORE
```

Keep CTA cards visually clean.

---

# 27. CTA Timing

Final CTA should remain visible long enough to be understood.

Minimum:

```text
1.5 seconds
```

Preferred:

```text
2–3 seconds
```

Do not rush the CTA.

---

# 28. Logo / Brand Mark

If SkillGrox logo is available:

Place in:

```text
Top-left
```

or

```text
Top-right
```

Use a small, unobtrusive treatment.

Recommended size:

```text
60–100 px
```

Do not allow the logo to compete with the hook.

---

# 29. Visual Hierarchy Per Scene

Every scene should follow approximately:

```text
1. Primary message
2. Keyword
3. Supporting information
4. Branding
```

Example:

```text
        PRIMARY MESSAGE

             KEYWORD

      supporting explanation


                         SKILLGROX
```

Never create multiple Level-1 elements.

---

# 30. Information Density

Each frame should contain approximately:

```text
1 primary idea
1–2 supporting elements
1 visual focus
```

Avoid:

```text
5+ text elements
3+ colors
multiple competing animations
```

If a frame feels crowded, split it into multiple scenes.

---

# 31. Numbers and Statistics

Numbers should use:

```text
League Spartan ExtraBold
```

Example:

```text
73%
```

Recommended:

```text
100–150 px
```

Supporting explanation:

```text
Inter Regular
40–48 px
```

Example:

```text
73%

of people abandon
their goals too early.
```

---

# 32. Quotes

For short quotes:

```text
League Spartan ExtraBold
```

For the highlighted phrase:

```text
Alex Brush
```

Attribution:

```text
Inter Regular
```

Example:

```text
"DISCIPLINE
IS FREEDOM."

— JOCKO WILLINK
```

Do not use quotation marks excessively as decorative elements.

---

# 33. Emphasis Rules

Use emphasis in this order:

```text
1. Font size
2. Position
3. Color
4. Font family
5. Animation
```

Do not rely on animation alone to communicate importance.

---

# 34. Typography Don'ts

Never:

- Use more than the three approved fonts
- Use Alex Brush for paragraphs
- Use League Spartan for long captions
- Use random font weights
- Use tiny text
- Use more than 2 major text styles in one scene
- Highlight every word
- Use orange everywhere
- Put important text near platform UI
- Use excessive text shadows
- Use excessive outlines

---

# 35. Shadows and Effects

Default typography should be clean.

If background contrast is insufficient:

Use a subtle shadow.

Recommended:

```text
Opacity: 20–40%
Blur: 8–20 px
Y offset: 2–6 px
```

Avoid heavy glow effects.

---

# 36. Text Backgrounds

When footage is too busy, use a subtle dark text container.

Example:

```text
rgba(0,0,0,0.45)
```

with:

```text
8–20 px
```

corner radius.

Do not use containers when they are unnecessary.

---

# 37. Motion Graphics

Use simple graphic elements:

- Lines
- Dots
- Underlines
- Progress bars
- Arrows
- Circles
- Minimal geometric shapes

Preferred accent:

```text
SkillGrox Orange #FF6B00
```

Graphics should support the message.

They should never become the primary focus unless explicitly intended.

---

# 38. Underlines

Alex Brush keywords may use a subtle underline.

Example:

```text
DISCIPLINE
──────────
```

Use orange or white.

Underline animation:

```text
Left → Right
200–400 ms
```

Do not use underlines on every highlighted word.

---

# 39. Progress Indicator

For multi-section educational videos, an optional progress indicator may appear.

Example:

```text
●───────
```

or:

```text
01 / 05
```

Use:

```text
Inter Regular
28–32 px
```

Orange for the active state.

---

# 40. Content Structure

Recommended SkillGrox short-form structure:

```text
HOOK
↓
PROBLEM
↓
INSIGHT
↓
EXPLANATION
↓
KEY TAKEAWAY
↓
CTA
```

Typography mapping:

```text
HOOK
→ League Spartan ExtraBold

PROBLEM
→ League Spartan + Inter

INSIGHT
→ League Spartan + Alex Brush

EXPLANATION
→ Inter

KEY TAKEAWAY
→ League Spartan + Alex Brush

CTA
→ League Spartan + Alex Brush
```

---

# 41. Recommended Video Rhythm

Example 30-second video:

```text
0–2s
HOOK
League Spartan

2–6s
PROBLEM
League Spartan + Inter

6–12s
EXPLANATION
Inter

12–17s
KEY INSIGHT
League Spartan + Alex Brush

17–24s
SUPPORTING EXPLANATION
Inter

24–27s
BIG TAKEAWAY
League Spartan + Alex Brush

27–30s
CTA
League Spartan + Alex Brush
```

---

# 42. Automated Rendering Rules

HyperFrames should follow deterministic rules.

If text has:

```text
hook=true
```

use:

```text
League Spartan ExtraBold
```

If text has:

```text
keyword=true
```

use:

```text
Alex Brush
```

If text has:

```text
title=true
```

use:

```text
League Spartan ExtraBold
```

If text has:

```text
cta=true
```

use:

```text
League Spartan ExtraBold
```

with optional Alex Brush keyword.

If no style is specified:

```text
Inter Regular
```

---

# 43. Automatic Keyword Selection

When automatically selecting keywords:

Prioritize words representing:

1. Main concept
2. Emotional trigger
3. Contrasting idea
4. Important number
5. Action
6. Outcome
7. Strong claim

Do not highlight:

- Articles
- Prepositions
- Common filler words
- Pronouns
- Entire sentences

Example:

```text
You don't need more motivation.
You need a better system.
```

Highlight:

```text
MOTIVATION
SYSTEM
```

Not:

```text
YOU
DON'T
NEED
MORE
```

---

# 44. Text Overflow Rules

If text exceeds the maximum width:

### Priority 1

Reduce line length by creating additional lines.

### Priority 2

Reduce font size by up to:

```text
10%
```

### Priority 3

Split into multiple scenes.

Never compress typography excessively just to fit a sentence.

---

# 45. Long Sentence Rules

If a sentence contains more than approximately:

```text
12–15 words
```

consider splitting it into multiple visual beats.

Example:

```text
Most people aren't lacking motivation.

They're lacking
a clear system.
```

This improves retention and readability.

---

# 46. Scene-Level Decision Tree

For every text element:

```text
Is it the main hook?
    ↓ YES
League Spartan ExtraBold

Is it an important emotional/concept keyword?
    ↓ YES
Alex Brush

Is it a title?
    ↓ YES
League Spartan ExtraBold

Is it a CTA?
    ↓ YES
League Spartan ExtraBold

Is it explanatory/supporting text?
    ↓ YES
Inter Regular

Otherwise
    ↓
Inter Regular
```

---

# 47. Accessibility

Minimum requirements:

- Strong contrast
- Large typography
- Short text chunks
- Clear hierarchy
- No reliance on color alone
- Captions readable without audio

Orange text must be placed on sufficiently dark backgrounds.

White text should remain readable against footage.

---

# 48. Quality Control Checklist

Before rendering a video, verify:

### Typography

- [ ] Only approved fonts are used
- [ ] Hooks use League Spartan ExtraBold
- [ ] Keywords use Alex Brush
- [ ] Captions use Inter Regular
- [ ] Alex Brush keywords remain visible ≥1.2s

### Layout

- [ ] Text is inside safe areas
- [ ] Bottom UI region is protected
- [ ] No text touches screen edges
- [ ] Maximum text width is respected
- [ ] No unnecessary crowding

### Color

- [ ] Orange is used selectively
- [ ] Primary text is white
- [ ] Background is sufficiently dark
- [ ] Contrast is strong

### Animation

- [ ] Animations are short
- [ ] No distracting effects
- [ ] Important text remains readable
- [ ] Transitions do not interrupt comprehension

### Content

- [ ] One primary idea per scene
- [ ] Hook appears immediately
- [ ] Captions are synchronized
- [ ] CTA is visible for ≥1.5s

---

# 49. Default HyperFrames Configuration

Unless overridden by a specific template:

```yaml
canvas:
  width: 1080
  height: 1920
  aspect_ratio: "9:16"

fonts:
  headline:
    family: "League Spartan"
    weight: 800

  keyword:
    family: "Alex Brush"
    weight: 400
    minimum_duration: 1.2

  body:
    family: "Inter"
    weight: 400

colors:
  background: "#0B0B0B"
  surface: "#111111"
  primary: "#FFFFFF"
  secondary: "#B8B8B8"
  muted: "#777777"
  accent: "#FF6B00"

typography:
  hook_size: 100
  headline_size: 88
  keyword_size: 110
  caption_size: 48
  body_size: 40
  metadata_size: 30

layout:
  horizontal_margin: 80
  top_margin: 120
  bottom_safe_area: 300
  max_text_width: 850

animation:
  text_in_duration: 250
  text_out_duration: 200
  keyword_in_duration: 400
  transition_duration: 200

timing:
  keyword_min_duration: 1.2
  cta_min_duration: 1.5
```

---

# 50. Final Design Rule

SkillGrox should never look like a generic AI-generated video.

The visual language must consistently communicate:

```text
BOLD
+
INTELLIGENT
+
MINIMAL
+
FAST
+
HUMAN
```

The hierarchy is:

```text
LEAGUE SPARTAN
↓
ATTENTION

ALEX BRUSH
↓
EMOTION / EMPHASIS

INTER
↓
INFORMATION
```

When uncertain, choose **less design, larger typography, stronger contrast, and clearer hierarchy**.

The goal is not to make every frame visually impressive.

The goal is to make every frame **immediately understandable and difficult to ignore.**
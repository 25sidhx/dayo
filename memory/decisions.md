# Decisions

## Gemini Model Upgrade (March 2026)
- **Decision**: Upgraded from Gemini 2.5 to the Gemini 3.1 series.
- **Reasoning**: User requested "latest and most good" models for image understanding.
- **Models**: `gemini-3.1-flash` (primary) and `gemini-3.1-pro` (correction/high-accuracy).
- **Cost Aspect**: Implemented a tiered cost strategy; Flash is fast and cheap ($0.002/photo), Pro is for corrections ($0.007/photo).

## AI Fallback Strategy
- **Decision**: Implemented a "Intelligence Chain".
- **Sequence**: Gemini 3.1 -> NVIDIA (Llama 3.2 90B Vision) -> Minimax (pending key).
- **Reasoning**: Ensure high availability and robust extraction even if primary provider hits quotas.
- **Update (Mar 2026)**: Minimax now gracefully skips when key is empty.

## Fast vs Deep Extraction Mode (March 2026)
- **Decision**: Added user-facing mode selector (⚡ Fast / 🔬 Deep).
- **Fast**: Gemini 3.1 Flash (~5s, $0.002/photo) — for clean images.
- **Deep**: Gemini 3.1 Pro (~15-25s, $0.007/photo) — for blurry/complex schedules.
- **Reasoning**: User wanted explicit control over speed vs accuracy tradeoff.

## React Hydration Fixing
- **Decision**: Added `suppressHydrationWarning` to `<body>` tag.
- **Reasoning**: To prevent browser extensions (like password managers or ad blockers) from causing React hydration mismatch errors when they inject classes before React renders.

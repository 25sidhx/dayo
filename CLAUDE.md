# Agent Interaction Guide (Claude/Antigravity)

## Persistent Memory Protocol
This project uses a persistent memory system to maintain context across sessions.

### On Session Start:
**You MUST read the following files in the `memory/` directory to understand the project's history, user preferences, and recent decisions:**
- [memory/decisions.md](file:///c:/Users/Siddhant%20rahate/Downloads/Executables_and_Installers/smart-life-scheduler/memory/decisions.md)
- [memory/people.md](file:///c:/Users/Siddhant%20rahate/Downloads/Executables_and_Installers/smart-life-scheduler/memory/people.md)
- [memory/preferences.md](file:///c:/Users/Siddhant%20rahate/Downloads/Executables_and_Installers/smart-life-scheduler/memory/preferences.md)
- [memory/user.md](file:///c:/Users/Siddhant%20rahate/Downloads/Executables_and_Installers/smart-life-scheduler/memory/user.md)

### On Session End / Major Changes:
Update these files to reflect:
1. New significant architectural decisions.
2. Changes in user preferences or workflow.
3. Relevant information about people involved.

## Project Context: Smart Life Scheduler (SLS)
- **Primary stack**: Next.js 16, React 19, Tailwind 4, Supabase.
- **AI Core**: Gemini 3.1 Flash/Pro for image understanding.
- **Design Persona**: Cybercore / Premium Academic OS.

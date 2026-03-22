import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest } from 'next/server'
import { adminAuth } from '@/lib/firebase/firebaseAdmin'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(req: NextRequest) {
  
  console.log('CHECKPOINT 1: Route hit')
  
  // Auth
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'No auth token' }, { status: 401 })
    }
    const token = authHeader.split(' ')[1]
    const decoded = await adminAuth.verifyIdToken(token)
    const uid = decoded.uid
    
    console.log('CHECKPOINT 2: Auth OK, uid:', uid)
    
    // Parse body
    const body = await req.json()
    const image = body.image || body.base64str // handle both frontend versions just in case
    
    if (!image || typeof image !== 'string' || image.length < 100) {
      console.log('CHECKPOINT 3: No image')
      return Response.json({ error: 'No image data', classes: [] }, { status: 400 })
    }
    
    console.log('CHECKPOINT 3: Image OK, length:', image.length)
    
    // Clean base64 — remove prefix if present
    const cleanBase64 = image.includes(',') ? image.split(',')[1] : image
    
    console.log('CHECKPOINT 4: Calling Gemini 2.0 Flash...')
    
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
      }
    })
    
    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg' as const,
        data: cleanBase64
      }
    }
    
    const extractionPrompt = `You are reading a college timetable image.
Extract every class and return as JSON.

WHAT TO EXTRACT:
- Subject/course name (exactly as written)
- Day of week (full name: Monday not MON)  
- Start time (12-hour format: 9:00 AM)
- End time (12-hour format: 10:00 AM)
- Room number if visible
- Faculty name or initials if visible
- Theory or Practical

WHAT TO SKIP:
- Cells saying RECESS, BREAK, LUNCH, FREE
- Empty cells or cells with just a dash
- Header row with day names
- Header column with time labels

BATCH SPLITS:
If a cell has multiple subjects separated by / with group codes like (B1) (B2) or (A) (B) — create one entry per group.

IMPORTANT:
- Do NOT invent subjects not in the image
- Do NOT add subjects from memory
- Read ONLY what is visible in the image
- If you cannot read a cell mark it as uncertain: true

Return ONLY a JSON array, nothing else. No markdown. No explanation. Just JSON.

[{"subject":"","type":"Theory","startTime":"9:00 AM","endTime":"10:00 AM","days":["Monday"],"room":"","faculty":"","batch":"All","uncertain":false}]`
    
    let classes = null
    let passCount = 0
    
    // PASS 1
    try {
      const result1 = await model.generateContent([extractionPrompt, imagePart])
      const text1 = result1.response.text()
      
      console.log('CHECKPOINT 5: Gemini responded, length:', text1.length)
      console.log('CHECKPOINT 6: First 300 chars:', text1.substring(0, 300))
      
      classes = parseGeminiJSON(text1)
      passCount = 1
      
      console.log('CHECKPOINT 7: Pass 1 extracted:', classes?.length || 0, 'classes')
        
    } catch (e: any) {
      console.error('Pass 1 failed:', e.message)
    }
    
    // PASS 2 — only if pass 1 got < 3 classes
    if (!classes || classes.length < 3) {
      console.log('Running pass 2...')
      try {
        const result2 = await model.generateContent([
            extractionPrompt + 
            '\n\nThe previous attempt found ' + (classes?.length || 0) + 
            ' classes which seems too few. Please look more carefully at every cell in every row.',
            imagePart
          ])
        const text2 = result2.response.text()
        const classes2 = parseGeminiJSON(text2)
        
        if (classes2 && classes2.length > (classes?.length || 0)) {
          classes = classes2
          passCount = 2
        }
        
        console.log('Pass 2 got:', classes2?.length || 0, 'classes')
          
      } catch (e: any) {
        console.error('Pass 2 failed:', e.message)
      }
    }
    
    if (!classes || classes.length === 0) {
      console.log('CHECKPOINT 8: Zero classes extracted')
      return Response.json({
        classes: [],
        source: 'failed',
        message: 'Could not extract classes'
      })
    }
    
    // Deduplicate
    const seen = new Set<string>()
    const unique = classes.filter(
      (cls: any) => {
        const key = [
          cls.subject?.toLowerCase(),
          cls.startTime,
          (cls.days || []).sort().join(','),
          cls.batch || 'All'
        ].join('|')
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    
    console.log('CHECKPOINT 8: Returning', unique.length, 'unique classes, passes used:', passCount)
    
    return Response.json({
      classes: unique,
      source: 'gemini',
      count: unique.length,
      passes: passCount
    })
    
  } catch (error: any) {
    console.error('Route error:', error.message)
    return Response.json({ classes: [], source: 'error', error: error.message })
  }
}

function parseGeminiJSON(text: string) {
  try {
    let cleaned = text.replace(/```json/gi, '').replace(/```/gi, '').trim()
    
    // Find JSON array boundaries
    const start = cleaned.indexOf('[')
    const end = cleaned.lastIndexOf(']')
    
    if (start === -1 || end === -1) {
      console.error('No JSON array found in response')
      return null
    }
    
    const jsonStr = cleaned.slice(start, end+1)
    const parsed = JSON.parse(jsonStr)
    
    if (!Array.isArray(parsed)) {
      console.error('Not an array')
      return null
    }
    
    // Filter out invalid entries
    return parsed.filter((cls: any) => 
      cls.subject && cls.subject.trim().length > 0 &&
      cls.startTime && cls.startTime.trim().length > 0
    )
    
  } catch (e: any) {
    console.error('JSON parse error:', e.message)
    console.error('Failed text:', text.substring(0, 200))
    return null
  }
}

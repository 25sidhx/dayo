import { GoogleGenerativeAI } from '@google/generative-ai'

export async function GET() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash'
    })
    
    const result = await model.generateContent('Reply with exactly: {"status":"ok"}')
    const text = result.response.text()
    
    return Response.json({ 
      working: true, 
      response: text,
      keyPresent: !!process.env.GEMINI_API_KEY
    })
    
  } catch (e: any) {
    return Response.json({ 
      working: false, 
      error: e.message,
      keyPresent: !!process.env.GEMINI_API_KEY
    })
  }
}

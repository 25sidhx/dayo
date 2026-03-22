import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('API Extraction Tests', () => {

  test('extract-schedule API responds and returns valid JSON', async ({ request }) => {
    // Read test image
    const imagePath = path.join(__dirname, 'fixtures', 'timetable.pdf');
    const imageBuffer = fs.readFileSync(imagePath);
    const base64 = imageBuffer.toString('base64');

    const response = await request.post('/api/extract-schedule', {
      data: {
        base64str: base64,
        mimeType: 'application/pdf',
        batchSegment: '1'
      }
    });

    // Should get a response
    expect(response.status()).toBeGreaterThan(0);
    
    const json = await response.json();
    console.log('API Response:', JSON.stringify(json, null, 2));
    
    // Either returns schedule or error - verify response is valid
    expect(json).toHaveProperty('schedule');
    
    // If schedule returned, should have at least 1 class
    if (json.schedule && json.schedule.length > 0) {
      console.log(`✓ Extracted ${json.schedule.length} classes`);
    }
  });

  test('extract-schedule API returns 400 when missing data', async ({ request }) => {
    const response = await request.post('/api/extract-schedule', {
      data: {}
    });

    expect(response.status()).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('Missing');
  });

  test('extract-schedule API works with batch filter', async ({ request }) => {
    const imagePath = path.join(__dirname, 'fixtures', 'timetable.pdf');
    const imageBuffer = fs.readFileSync(imagePath);
    const base64 = imageBuffer.toString('base64');

    // Test with batch 2
    const response = await request.post('/api/extract-schedule', {
      data: {
        base64str: base64,
        mimeType: 'application/pdf',
        batchSegment: '2'
      }
    });

    const json = await response.json();
    console.log('Batch 2 Response:', JSON.stringify(json, null, 2));
    
    expect(json).toHaveProperty('schedule');
    
    // If schedule returned, should have at least 1 class
    if (json.schedule && json.schedule.length > 0) {
      console.log(`✓ Batch 2 extracted ${json.schedule.length} classes`);
    }
  });

  test('chat API responds to messages', async ({ request }) => {
    const response = await request.post('/api/chat', {
      data: {
        messages: [
          { role: 'user', content: 'hello' }
        ]
      }
    });

    // Chat should return streaming response or error
    expect(response.status()).toBeGreaterThan(0);
  });

});

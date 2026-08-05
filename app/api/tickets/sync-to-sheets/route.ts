import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { 
      ticketId, 
      date, 
      priority, 
      category, 
      status, 
      companyName, 
      buildingName,
      creatorName, 
      title, 
      description, 
      photos 
    } = data;

    const credentialsEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!credentialsEmail || !privateKey || !spreadsheetId) {
      console.error('Missing Google Sheets credentials');
      return NextResponse.json({ error: 'Missing credentials' }, { status: 500 });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: credentialsEmail,
        private_key: privateKey,
      },
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
      ],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const photoUrls = Array.isArray(photos) ? photos.join(', ') : '';

    const rowData = [
      ticketId || '',
      date || new Date().toISOString(),
      priority || '',
      category || '',
      status || '',
      companyName || '',
      buildingName || '',
      creatorName || '',
      title || '',
      description || '',
      photoUrls || ''
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'A1', // Appends to the first sheet starting from column A
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowData],
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error syncing to Google Sheets:', error);
    return NextResponse.json({ error: 'Failed to sync to Google Sheets' }, { status: 500 });
  }
}

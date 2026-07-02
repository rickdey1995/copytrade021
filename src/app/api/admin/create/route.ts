import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body.username || '').trim();
    const password = String(body.password || '');

    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'username and password are required' }, { status: 400 });
    }

    const hash = crypto.createHash('sha256').update(password).digest('hex');

    // check existing
    const rows = await query('SELECT id FROM admin_users WHERE username = ? LIMIT 1', [username]);
    if (rows && rows.length) {
      await query('UPDATE admin_users SET password_hash = ?, status = ? WHERE username = ?', [hash, 'active', username]);
    } else {
      await query('INSERT INTO admin_users (username, password_hash, display_name, status) VALUES (?, ?, ?, ?)', [username, hash, 'Administrator', 'active']);
    }

    return NextResponse.json({ success: true, username });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

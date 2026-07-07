import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAuthClient, createAdminClient } from '@/lib/appwrite-server';
import { signToken, SESSION_COOKIE } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return NextResponse.json(
        { error: 'email and password are required' },
        { status: 400 },
      );
    }

    // Validate credentials via Appwrite session creation
    const { account } = createAuthClient();
    let session;
    try {
      session = await account.createEmailPasswordSession(email, password);
    } catch {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 },
      );
    }

    const userId = session.userId;

    // Sign our HMAC session token
    const token = await signToken(userId, email);

    cookies().set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });

    // Fetch user name for response
    const { users } = createAdminClient();
    const user = await users.get(userId);

    return NextResponse.json({
      success: true,
      userId,
      email,
      name: user.name,
    });
  } catch (error: unknown) {
    console.error('[POST /api/auth/login]', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}

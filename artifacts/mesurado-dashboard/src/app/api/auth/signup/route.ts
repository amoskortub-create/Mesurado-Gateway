import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ID } from 'node-appwrite';
import { createAdminClient, DEFAULT_PREFS } from '@/lib/appwrite-server';
import { signToken, SESSION_COOKIE } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name } = body as {
      email?: string;
      password?: string;
      name?: string;
    };

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'email, password, and name are required' },
        { status: 400 },
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 },
      );
    }

    const { users } = createAdminClient();

    // Create user via admin SDK
    let user;
    try {
      user = await users.create(ID.unique(), email, undefined, password, name);
    } catch (err: unknown) {
      const msg = String(err instanceof Error ? err.message : err);
      if (msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('conflict')) {
        return NextResponse.json(
          { error: 'An account with this email already exists' },
          { status: 409 },
        );
      }
      throw err;
    }

    // Set default token prefs
    await users.updatePrefs(user.$id, DEFAULT_PREFS);

    // Sign our session token
    const token = await signToken(user.$id, email);

    cookies().set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    return NextResponse.json({
      success: true,
      userId: user.$id,
      email: user.email,
      name: user.name,
    });
  } catch (error: unknown) {
    console.error('[POST /api/auth/signup]', error);
    const msg = error instanceof Error ? error.message : 'Signup failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

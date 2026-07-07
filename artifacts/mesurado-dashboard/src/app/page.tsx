import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE } from '@/lib/auth';

export default function RootPage() {
  const session = cookies().get(SESSION_COOKIE);
  redirect(session ? '/overview' : '/login');
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export function useAdminGuard() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    async function checkRole() {
      // 1. Get currently logged in user
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      // 2. Fetch role from database
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      // 3. If not admin or officer -> Block access & bounce to student dashboard
      if (profile?.role !== 'admin' && profile?.role !== 'officer') {
        alert('Unauthorized access! Redirecting to student dashboard.');
        router.push('/student/dashboard');
      } else {
        setIsAuthorized(true);
      }
    }

    checkRole();
  }, [router]);

  return { isAuthorized };
}
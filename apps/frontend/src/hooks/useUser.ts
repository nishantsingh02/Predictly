import { useEffect, useState } from "react";
import { useSupabase } from "./useSupabase";

export function useUser() {
  const [claims, setClaims] = useState<any>(null);
  const supabase = useSupabase();

  useEffect(() => {
    // Check for existing session using getClaims
    (supabase.auth as any).getClaims().then(({ data }: any) => {
      if (data) {
        setClaims(data.claims);
      }
    });

    // // Listen for auth changes
    // const {
    //   data: { subscription },
    // } = supabase.auth.onAuthStateChange(() => {
    //   (supabase.auth as any).getClaims().then(({ data }: any) => {
    //     if (data) {
    //       setClaims(data.claims);
    //     }
    //   });
    // });

     // Listen for auth changes
    const {
      data: { subscription },
      } = supabase.auth.onAuthStateChange((event) => {
        // Immediately clear claims on sign out
        if (event === "SIGNED_OUT") {
          setClaims(null);
          return;
        }
        // Otherwise, update claims if available, or clear if missing
        (supabase.auth as any).getClaims().then(({ data }: any) => {
          if (data) {
            setClaims(data.claims);
          } else {
            setClaims(null);
          }
        });
      });

    return () => subscription.unsubscribe();
  }, [supabase]);

  return {
    claims,
  };
}



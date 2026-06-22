import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function useSupabase() {
  return supabase;
}


// import { createClient } from "@supabase/supabase-js";
// import { useState } from "react";

// export function useSupabase() {
//   const [supabase, setSupabase] = useState(createClient(
//     import.meta.env.VITE_SUPABASE_URL,
//     import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
//   ))
//   return supabase;
// }


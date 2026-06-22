import { useUser } from "./hooks/useUser";
import { useSupabase } from "./hooks/useSupabase";
import axios from "axios";

function App() {
  const { claims } = useUser();
  const supabase = useSupabase();

  return (
    <div>
      {!claims && (
        <button
          onClick={async () => {
            await supabase.auth.signInWithWeb3({
              chain: "solana",
              statement:
                "I accept the Predictly Terms of Service available at https://predictly.com/terms",
              wallet: (window as any).phantom.solana,
              // wallet: (window as any).salflare
            });
          }}
        >
          Sign in with Solana
        </button>
      )}

      {claims && (
        <button
          onClick={async () => {
            await supabase.auth.signOut();
          }}
        >
          Logout
        </button>
      )}

      {/* {JSON.stringify(claims)} */}

      {/* <button onClick={async () => {
        await supabase.auth.getSession().then(async r => {
          await axios.post("http://localhost:3000/buy", {}, {
            headers: {
              Authorization: r.data.session?.access_token
            }
          })
        })
      }}>Click to buy</button> */}

      <button
        onClick={async () => {
          const { data, error } = await supabase.auth.getSession();

          if (error || !data.session) {
            console.error("No active session");
            return;
          }

          await axios.post(
            "http://localhost:3000/buy",
            {},
            {
              headers: {
                Authorization: `Bearer ${data.session.access_token}`,
              },
            },
          );
        }}
      >
        Click to buy
      </button>

    </div>
  );
}

export default App;

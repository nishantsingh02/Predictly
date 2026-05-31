import { useUser } from "./hooks/useUser";
import { useSupabase } from "./hooks/useSupabase";

function App() {
  const {claims} = useUser();
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
           const { error } = await supabase.auth.signOut();
            console.log(error)
          }}
        >
          Logout
        </button>
      )}

      {/* {JSON.stringify(claims)} */}
      
    </div>
  );
}

export default App;


{/* <div>
      {!claims && (
        <button
          onClick={async () => {
            const provider = (window as any).phantom?.solana;
            if (!provider) {
              alert("Phantom wallet not found. Please install it.");
              return;
            }

            try {
              if (!provider.publicKey) {
                await provider.connect();
              }

              await supabase.auth.signInWithWeb3({
                chain: "solana",
                statement:
                  "I accept the Predictly Terms of Service available at https://predictly.com/terms",
                wallet: provider,
              });
            } catch (error) {
              console.error("Authentication failed:", error);
              alert("Sign in failed. Check console for details.");
            }
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

      {JSON.stringify(claims)}
      
    </div> */}
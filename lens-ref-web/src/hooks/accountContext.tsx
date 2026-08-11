import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { useAccountFlow, type AccountFlow } from "./useAccountFlow";

// One shared account-flow instance for the whole app, provided at the App
// root. This is load-bearing, not convenience: useAccountFlow consumes the
// /verify?token=... magic link on mount, and the token is single-use, so
// exactly ONE instance may ever exist. The NavBar (account menu, every page)
// and the referral page both read this context; never call useAccountFlow()
// directly from a component.
const AccountContext = createContext<AccountFlow | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const flow = useAccountFlow();
  return <AccountContext.Provider value={flow}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountFlow {
  const flow = useContext(AccountContext);
  if (!flow) throw new Error("useAccount must be used inside AccountProvider");
  return flow;
}

// localStorage key the react-query cache is persisted under (see App.tsx's
// PersistQueryClientProvider). Shared so AuthContext can hard-clear the persisted
// cache on account switch, preventing one user's cached data (e.g. ['lens-analysis'])
// from bleeding into the next account on the same browser.
export const QUERY_CACHE_KEY = 'lens-query-cache'

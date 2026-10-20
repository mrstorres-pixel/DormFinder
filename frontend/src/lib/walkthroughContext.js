import { createContext, useContext } from 'react'

export const WalkthroughContext = createContext(null)
export const useWalkthrough = () => useContext(WalkthroughContext)
